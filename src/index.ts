import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
// @ts-ignore - plain JS module shared with the browser
import { BASES, CATEGORIES, balances, treasurerPlan } from "../public/split.js";
// @ts-ignore - plain JS module shared with the seeding script
import { SANDBOX } from "./sandbox.js";

interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_CODE: string;
  ANTHROPIC_API_KEY: string;
  RECEIPT_MODEL?: string;
}

// Which Claude model reads receipts is set in wrangler.jsonc (vars.RECEIPT_MODEL);
// this is only the fallback if that setting is missing.
const DEFAULT_RECEIPT_MODEL = "claude-haiku-5-5";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const COOKIE = "efc_access";

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

const now = () => new Date().toISOString();

async function accessToken(env: Env) {
  const bytes = new TextEncoder().encode("efc-expenses:" + env.ACCESS_CODE);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authed(req: Request, env: Env) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${COOKIE}=([0-9a-f]+)`));
  return !!m && !!env.ACCESS_CODE && m[1] === (await accessToken(env));
}

// The name each person types once; it signs everything they change.
function who(req: Request) {
  try { return decodeURIComponent(req.headers.get("x-user-name") || "").slice(0, 60) || "someone"; }
  catch { return "someone"; }
}

async function body(req: Request): Promise<any> {
  try { return await req.json(); } catch { throw new HttpError(400, "Body must be JSON"); }
}

// A real calendar date (2026-13-45 matches the pattern but isn't one).
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s + "T12:00:00Z")) && new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
const MAX_TRIP_DAYS = 60;
const tripDays = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5) + 1;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function dropReceipt(env: Env, key: string | null) {
  if (!key) return;
  const used = await env.DB.prepare("SELECT 1 FROM expenses WHERE receipt_key = ? LIMIT 1").bind(key).first();
  if (!used) await env.RECEIPTS.delete(key);
}

async function log(env: Env, tid: number | null, name: string, what: string) {
  await env.DB.prepare("INSERT INTO activity (tournament_id, at, who, what) VALUES (?, ?, ?, ?)")
    .bind(tid, now(), name, what).run();
}

const KEEP_DELETED_DAYS = 30;

// A deleted trip is invisible to everything except "Recently deleted" and restore.
async function tournament(env: Env, id: number, { includeDeleted = false } = {}) {
  const t = await env.DB.prepare("SELECT * FROM tournaments WHERE id = ?").bind(id).first<any>();
  if (!t || (t.deleted_at && !includeDeleted)) throw new HttpError(404, "This trip doesn't exist or was deleted");
  return t;
}

// Remove a trip for good. Every delete is conditional on the trip still being
// deleted (a restore may land at any moment), all in one all-or-nothing batch;
// receipt files go only once the rows are really gone.
async function purgeTrip(env: Env, tid: number, deletedBefore: string) {
  const still = "EXISTS (SELECT 1 FROM tournaments WHERE id = ?1 AND deleted_at IS NOT NULL AND deleted_at < ?2)";
  const res = await env.DB.batch([
    env.DB.prepare(`DELETE FROM payments WHERE tournament_id = ?1 AND ${still}`).bind(tid, deletedBefore),
    env.DB.prepare(`DELETE FROM expenses WHERE tournament_id = ?1 AND ${still}`).bind(tid, deletedBefore),
    env.DB.prepare(`DELETE FROM families WHERE tournament_id = ?1 AND ${still}`).bind(tid, deletedBefore),
    env.DB.prepare(`DELETE FROM activity WHERE tournament_id = ?1 AND ${still}`).bind(tid, deletedBefore),
    env.DB.prepare(`DELETE FROM tournaments WHERE id = ?1 AND deleted_at IS NOT NULL AND deleted_at < ?2`).bind(tid, deletedBefore),
  ]);
  if (!res[res.length - 1].meta.changes) return;       // restored in time: nothing was removed
  await dropOrphanReceipts(env, tid);
}

// Receipt files under a trip that no expense refers to any more.
async function dropOrphanReceipts(env: Env, tid: number) {
  const { results } = await env.DB.prepare("SELECT receipt_key FROM expenses WHERE tournament_id = ? AND receipt_key IS NOT NULL").bind(tid).all<any>();
  const used = new Set(results.map(r => r.receipt_key));
  let cursor: string | undefined;
  do {
    const list = await env.RECEIPTS.list({ prefix: `t${tid}/`, cursor });
    // An upload from the last hour may belong to a save or reset still in flight.
    const gone = list.objects.filter(o => !used.has(o.key) && Date.now() - o.uploaded.getTime() > 36e5).map(o => o.key);
    if (gone.length) await env.RECEIPTS.delete(gone);
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

// Trips deleted more than 30 days ago go for good. Runs when the trip list is
// opened (no scheduler needed); one per request keeps each request light.
async function purgeExpired(env: Env) {
  const cutoff = new Date(Date.now() - KEEP_DELETED_DAYS * 864e5).toISOString();
  const old = await env.DB.prepare("SELECT id FROM tournaments WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 1").bind(cutoff).first<any>();
  if (old) await purgeTrip(env, old.id, cutoff);
}

// Everything a trip's money depends on, as one string, computed by the database.
const FINGERPRINT_SQL = `
  (SELECT COALESCE(group_concat(x, ';'), '') FROM (SELECT id || '|' || amount_cents || '|' || paid_by || '|' || basis || '|' || COALESCE(date, '') || '|' || split AS x FROM expenses WHERE tournament_id = ? ORDER BY id))
  || '#' || (SELECT COALESCE(group_concat(x, ';'), '') FROM (SELECT p.id || '|' || p.family_id || '|' || p.is_fencer || '|' || CASE WHEN p.is_fencer = 1 THEN p.fencing_days ELSE '' END AS x FROM people p JOIN families f ON f.id = p.family_id WHERE f.tournament_id = ? ORDER BY p.id))
  || '#' || (SELECT COALESCE(group_concat(x, ';'), '') FROM (SELECT id || '|' || kind AS x FROM families WHERE tournament_id = ? ORDER BY id))
  || '#' || (SELECT COALESCE(treasurer_family_id, '') || '|' || COALESCE(treasurer_name, '') FROM tournaments WHERE id = ?)`;
async function fingerprint(env: Env, tid: number): Promise<string> {
  const r = await env.DB.prepare(`SELECT ${FINGERPRINT_SQL} AS f`).bind(tid, tid, tid, tid).first<any>();
  return r.f;
}

// A write that changes the money only applies while the trip is open; checked in
// the same statement, so it can't slip in after a finalize.
const OPEN = "EXISTS (SELECT 1 FROM tournaments WHERE id = ? AND status = 'open' AND deleted_at IS NULL)";
const OPEN3 = "EXISTS (SELECT 1 FROM tournaments WHERE id = ?3 AND status = 'open' AND deleted_at IS NULL)";
// A screen opened before someone changed or replaced what it shows.
const stale = () => new HttpError(409, "This screen is out of date: something changed on another phone. Reload to see the current version.");
const closed = () => new HttpError(409, "This trip just changed on another phone (finalized, deleted or new dates). Reload to see it.");
// The trip's dates are still the ones the allowed days were worked out from.
const SAME_SPAN = "(SELECT start_date || '/' || end_date FROM tournaments WHERE id = ?) = ?";

async function openTournament(env: Env, id: number) {
  const t = await tournament(env, id);
  if (t.status === "final") throw new HttpError(409, "This tournament is finalized. Reopen it to make changes.");
  return t;
}

async function familyTournament(env: Env, familyId: number) {
  const row = await env.DB.prepare("SELECT tournament_id FROM families WHERE id = ?").bind(familyId).first<any>();
  if (!row) throw new HttpError(404, "No such family");
  await tournament(env, row.tournament_id);          // 404s for a deleted trip
  return row.tournament_id as number;
}

function cleanDays(v: unknown, allowed: Set<string>) {
  return Array.isArray(v) ? [...new Set(v.filter(d => typeof d === "string" && allowed.has(d)))].sort() : [];
}

async function allowedDays(env: Env, tid: number) {
  const t = await tournament(env, tid);
  const out = new Set<string>();
  const d = new Date(t.start_date + "T12:00:00Z");
  const end = new Date(t.end_date + "T12:00:00Z");
  while (d <= end && out.size < 60) { out.add(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return Object.assign(out, { span: `${t.start_date}/${t.end_date}` });
}

async function loadTrip(env: Env, tid: number) {
  const t = await tournament(env, tid);
  const [fam, ppl, exp, pay, act] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM families WHERE tournament_id = ? ORDER BY name COLLATE NOCASE").bind(tid),
    env.DB.prepare("SELECT p.* FROM people p JOIN families f ON f.id = p.family_id WHERE f.tournament_id = ? ORDER BY p.is_fencer DESC, p.id").bind(tid),
    env.DB.prepare("SELECT * FROM expenses WHERE tournament_id = ? ORDER BY date IS NULL, date, id").bind(tid),
    env.DB.prepare("SELECT * FROM payments WHERE tournament_id = ? ORDER BY direction, amount_cents DESC").bind(tid),
    env.DB.prepare("SELECT * FROM activity WHERE tournament_id = ? ORDER BY id DESC LIMIT 50").bind(tid),
  ]);
  // A person's fencing days count only while they're a fencer (unticking Fencer keeps them,
  // so ticking it again brings them back). Every screen, the money and finalize read them here.
  // `days` stays empty for a page from before families stopped having days.
  const people = (ppl.results as any[]).map(({ days: _d, own_days: _o, rest_days: _r, ...p }) =>
    ({ ...p, is_fencer: !!p.is_fencer, days: [], fencing_days: p.is_fencer ? JSON.parse(p.fencing_days) : [] }));
  const families = (fam.results as any[]).map(f => ({ ...f, days: [], people: people.filter(p => p.family_id === f.id) }));
  const expenses = (exp.results as any[]).map(e => ({ ...e, split: JSON.parse(e.split) }));
  return { tournament: t, families, expenses, payments: pay.results, activity: act.results };
}

async function familyIds(env: Env, tid: number) {
  const { results } = await env.DB.prepare("SELECT id FROM families WHERE tournament_id = ?").bind(tid).all<any>();
  return new Set(results.map(r => r.id as number));
}

// A key the phone made for something it's adding, so a retry finds the first one.
const clientKey = (b: any) => typeof b.client_key === "string" && /^[0-9a-f-]{36}$/.test(b.client_key) ? b.client_key as string : null;
const has = (o: object, k: unknown) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// What makes two saves of an expense the same save.
const EXPENSE_FIELDS = ["description", "vendor", "date", "category", "basis", "amount_cents", "paid_by", "split", "receipt_key"] as const;

async function expenseInput(env: Env, tid: number, b: any) {
  const ids = await familyIds(env, tid);
  const { results: staffRows } = await env.DB.prepare("SELECT id FROM families WHERE tournament_id = ? AND kind = 'staff'").bind(tid).all<any>();
  const staffIds = new Set(staffRows.map(x => x.id as number));
  const amount = Math.round(Number(b.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Amount must be more than zero");
  if (!has(CATEGORIES, b.category)) throw new HttpError(400, "Unknown category");
  // The kind fixes the split; only Other lets whoever enters it choose.
  const cat = (CATEGORIES as any)[b.category];
  const basis = cat.choose ? b.basis : cat.basis;
  if (!has(BASES, basis)) throw new HttpError(400, "Unknown split");
  if (!ids.has(Number(b.paid_by))) throw new HttpError(400, "Pick the family that paid");
  // Who took part: a head count per family ticked. The other splits follow the fencers.
  const split: Record<string, number> = {};
  if (basis === "took_part") {
    // Family numbers can be reused after a delete: a form sends each ticked family's tag.
    const tags = b.split_uids && typeof b.split_uids === "object" ? b.split_uids : null;
    const { results: famRows } = tags ? await env.DB.prepare("SELECT id, uid FROM families WHERE tournament_id = ?").bind(tid).all<any>() : { results: [] };
    for (const [k, v] of Object.entries(b.split || {})) {
      if (k !== String(Number(k)) || staffIds.has(Number(k))) continue;   // "01" or " 1" would be stored but never read; staff never pay
      const n = Number(v);
      if (v == null || n === 0) continue;
      if (!Number.isInteger(n) || n < 0 || n > 50) throw new HttpError(400, "A head count is a whole number from 1 to 50");
      if (!ids.has(Number(k)) || (tags && famRows.find(f => f.id === Number(k))?.uid !== tags[k]))
        throw new HttpError(409, "A family ticked on this was removed from the trip. Check who took part, then save again.");
      split[k] = n;
    }
    if (!Object.keys(split).length) throw new HttpError(400, "Tick who took part");
  }
  return {
    description: str(b.description) || CATEGORIES[b.category].label,
    vendor: str(b.vendor),
    date: isDate(b.date) ? b.date : null,
    category: b.category,
    basis,
    amount_cents: amount,
    paid_by: Number(b.paid_by),
    split: JSON.stringify(split),
    receipt_key: typeof b.receipt_key === "string" && new RegExp(`^t${tid}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`).test(b.receipt_key) ? b.receipt_key : null,
    receipt_type: RECEIPT_TYPES.includes(b.receipt_type) ? b.receipt_type : null,
  };
}

// Put the practice trip back to its starting state: everything people added,
// changed or uploaded is removed and the seed goes back in, all in one
// all-or-nothing batch, so two resets at once can't leave duplicates.
async function resetSandbox(env: Env, req: Request, tid: number, name: string) {
  const t = await tournament(env, tid);
  if (!t.is_sandbox) throw new HttpError(403, "Only the practice trip can be reset");
  const famId = "(SELECT id FROM families WHERE tournament_id = ? AND name = ? ORDER BY id DESC LIMIT 1)";
  const stmts = [
    env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM expenses WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM families WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM activity WHERE tournament_id = ?").bind(tid),
    env.DB.prepare(`UPDATE tournaments SET name = ?, location = ?, start_date = ?, end_date = ?, status = 'open', finalized_at = NULL, finalized_by = NULL,
      treasurer_name = NULL, treasurer_family_id = NULL, treasurer_notes = '' WHERE id = ?`)
      .bind(SANDBOX.name, SANDBOX.location, SANDBOX.start_date, SANDBOX.end_date, tid),
  ];
  for (const [fname, pay, people] of SANDBOX.families) {
    stmts.push(env.DB.prepare("INSERT INTO families (tournament_id, name, pay_notes, days) VALUES (?, ?, ?, '[]')").bind(tid, fname, pay));
    for (const [pn, fencer, fdays] of people as [string, number, string[]][])
      stmts.push(env.DB.prepare(`INSERT INTO people (family_id, name, is_fencer, days, fencing_days) VALUES (${famId}, ?, ?, '[]', ?)`)
        .bind(tid, fname, pn, fencer, JSON.stringify(fdays)));
  }
  for (const [sname, role, pay] of SANDBOX.staff || [])
    stmts.push(env.DB.prepare("INSERT INTO families (tournament_id, name, pay_notes, days, kind, role) VALUES (?, ?, ?, '[]', 'staff', ?)").bind(tid, sname, pay, role));
  const stamp = now();
  for (const [desc, vendor, date, cat, cents, payer, image, took] of SANDBOX.expenses as any[]) {
    let key: string | null = null;
    if (image) {
      const img = await env.ASSETS.fetch(new URL(image, req.url));
      if (img.ok) { key = `t${tid}/${crypto.randomUUID()}`; await env.RECEIPTS.put(key, img.body, { httpMetadata: { contentType: "image/jpeg" } }); }
    }
    // Who took part names families; their ids are only known inside the batch.
    const parts = Object.entries(took || {}) as [string, number][];
    const split = parts.length ? `json_object(${parts.map(() => `CAST(${famId} AS TEXT), ?`).join(", ")})` : "'{}'";
    stmts.push(env.DB.prepare(`INSERT INTO expenses (tournament_id, description, vendor, date, category, basis, amount_cents, paid_by, split, receipt_key, receipt_type, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ${famId}, ${split}, ?, ?, ?, 'Practice trip')`)
      .bind(tid, desc, vendor, date, cat, (CATEGORIES as any)[cat].basis, cents, tid, payer, ...parts.flatMap(([f, n]) => [tid, f, n]), key, key ? "image/jpeg" : null, stamp));
  }
  stmts.push(env.DB.prepare("INSERT INTO activity (tournament_id, at, who, what) VALUES (?, ?, ?, ?)").bind(tid, stamp, name, "reset the practice trip to its starting point"));
  await env.DB.batch(stmts);
  await dropOrphanReceipts(env, tid);
}

const ReceiptFields = z.object({
  vendor: z.string().nullable(),
  description: z.string(),
  total: z.number().nullable(),
  date: z.string().nullable(),
  category: z.enum(Object.keys(CATEGORIES) as [string, ...string[]]),
  notes: z.string().nullable(),
});

async function readReceipt(env: Env, key: string, t: any) {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, "Receipt reading isn't set up yet. Enter it by hand.");
  const obj = await env.RECEIPTS.get(key);
  if (!obj) throw new HttpError(404, "Receipt not found");
  const type = obj.httpMetadata?.contentType || "";
  // Encoding a big file for the model costs CPU the free plan doesn't have; photos
  // are shrunk in the browser first, so this only stops large PDFs.
  if (obj.size > 2_500_000) throw new HttpError(413, "That file is too large to read automatically. Enter it by hand.");
  const data = Buffer.from(await obj.arrayBuffer()).toString("base64");
  const file: Anthropic.ContentBlockParam = type === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/webp", data } };
  const categories = Object.entries(CATEGORIES).map(([k, c]: [string, any]) => `${k}: ${c.label}`).join("\n");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const res = await client.messages.parse({
    model: env.RECEIPT_MODEL || DEFAULT_RECEIPT_MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(ReceiptFields) },
    messages: [{
      role: "user",
      content: [file, {
        type: "text",
        text: `This is a receipt from a youth fencing team's trip to ${t.name}${t.location ? " in " + t.location : ""}, ${t.start_date} to ${t.end_date}.
Read it and fill in:
- vendor: the business name
- description: a few words for a list of team expenses, like "Team dinner" or "Coach hotel, 2 nights"
- total: the final amount charged, including tax and tip, as a number in dollars
- date: the date of purchase as YYYY-MM-DD (assume the trip's year if the receipt omits it)
- category, one of:
${categories}
  (A hotel, flight, rental car, gas or ride is usually the coach's. A meal for one person,
  coffee or breakfast is usually the coach's own meal; a meal for several people is a team meal.)
- notes: anything a parent checking this should know, such as a handwritten tip or a total you weren't sure of; otherwise null
Use null for anything you can't read.`,
      }],
    }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new HttpError(422, "Couldn't read that receipt. Enter it by hand.");
  return res.parsed_output;
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, "");
  const method = req.method;
  const name = who(req);
  let m: RegExpMatchArray | null;

  if (path === "/login" && method === "POST") {
    const b = await body(req);
    if (!env.ACCESS_CODE || str(b.code, 200) !== env.ACCESS_CODE) {
      await new Promise(r => setTimeout(r, 800)); // slows down guessing
      throw new HttpError(401, "That code isn't right");
    }
    const cookie = `${COOKIE}=${await accessToken(env)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }
  if (!(await authed(req, env))) throw new HttpError(401, "Enter the access code");
  if (path === "/me") return json({ ok: true });

  // Tournaments
  if (path === "/tournaments" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT t.*, (SELECT COALESCE(SUM(amount_cents), 0) FROM expenses e WHERE e.tournament_id = t.id) AS total_cents,
              (SELECT COUNT(*) FROM expenses e WHERE e.tournament_id = t.id) AS expense_count,
              (SELECT COUNT(*) FROM families f WHERE f.tournament_id = t.id AND f.kind = 'family') AS family_count,
              (SELECT COUNT(*) FROM payments p WHERE p.tournament_id = t.id) AS pay_total,
              (SELECT COUNT(*) FROM payments p WHERE p.tournament_id = t.id AND p.paid_at IS NOT NULL) AS pay_done
       FROM tournaments t WHERE t.deleted_at IS NULL ORDER BY t.start_date DESC, t.id DESC`).all();
    await purgeExpired(env);
    return json(results);
  }
  if (path === "/tournaments/deleted" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT id, name, location, start_date, end_date, deleted_at, deleted_by,
              (SELECT COUNT(*) FROM expenses e WHERE e.tournament_id = t.id) AS expense_count
       FROM tournaments t WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`).all();
    return json({ keep_days: KEEP_DELETED_DAYS, trips: results });
  }
  if (path === "/tournaments" && method === "POST") {
    const b = await body(req);
    if (!str(b.name)) throw new HttpError(400, "Give the tournament a name");
    if (!isDate(b.start_date) || !isDate(b.end_date) || b.end_date < b.start_date) throw new HttpError(400, "Check the dates");
    if (tripDays(b.start_date, b.end_date) > MAX_TRIP_DAYS) throw new HttpError(400, `A trip can be at most ${MAX_TRIP_DAYS} days`);
    // A key names one thing being added. Seen before: already added, and nothing changes.
    const key = clientKey(b);
    const made = key && await env.DB.prepare("SELECT id FROM tournaments WHERE client_key = ?").bind(key).first<any>();
    if (made) return json({ id: made.id, already: true }, 200);
    const r = await env.DB.prepare(
      "INSERT INTO tournaments (name, location, start_date, end_date, created_at, created_by, client_key) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id")
      .bind(str(b.name), str(b.location), b.start_date, b.end_date, now(), name, key).first<any>();
    if (!r) {                              // the same add, landing twice at once
      const again = await env.DB.prepare("SELECT id FROM tournaments WHERE client_key = ?").bind(key).first<any>();
      return json({ id: again.id, already: true }, 200);
    }
    await log(env, r.id, name, `created the tournament`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/tournaments\/(\d+)$/))) {
    const tid = Number(m[1]);
    // The fingerprint of the numbers this screen shows: finalize locks only those.
    if (method === "GET") { const [trip, fp] = await Promise.all([loadTrip(env, tid), fingerprint(env, tid)]); return json({ ...trip, fingerprint: fp }); }
    if (method === "PATCH") {
      const t = await openTournament(env, tid);
      const b = await body(req);
      const start = isDate(b.start_date) ? b.start_date : t.start_date;
      const end = isDate(b.end_date) ? b.end_date : t.end_date;
      if (end < start) throw new HttpError(400, "Check the dates");
      const moved = start !== t.start_date || end !== t.end_date;
      // A form sending dates names the dates it was opened with; a form opened before
      // someone else changed them would otherwise put the old ones back.
      const seenStart = b.start_date == null && b.end_date == null ? t.start_date : b.seen_start;
      const seenEnd = b.start_date == null && b.end_date == null ? t.end_date : b.seen_end;
      if (seenStart !== t.start_date || seenEnd !== t.end_date) throw stale();
      if (moved && tripDays(start, end) > MAX_TRIP_DAYS) throw new HttpError(400, `A trip can be at most ${MAX_TRIP_DAYS} days`);
      // Days outside new dates come off everyone's fencing days (fencers and not), so
      // no split keeps counting a day nobody can see or untick any more. The
      // database trims each list as it stands, so a tap landing meanwhile is kept.
      const datesNow = "EXISTS (SELECT 1 FROM tournaments WHERE id = ?3 AND status = 'open' AND deleted_at IS NULL AND start_date = ?1 AND end_date = ?2)";
      const keep = (col: string) => `(SELECT json_group_array(value) FROM json_each(${col}) WHERE value BETWEEN ?1 AND ?2)`;
      const res = await env.DB.batch([
        // Only from the dates we read: two phones changing the dates at once can't each trim to a different range.
        env.DB.prepare("UPDATE tournaments SET name = ?4, location = ?5, start_date = ?1, end_date = ?2 WHERE id = ?3 AND status = 'open' AND deleted_at IS NULL AND start_date = ?6 AND end_date = ?7")
          .bind(start, end, tid, str(b.name) || t.name, b.location == null ? t.location : str(b.location), seenStart, seenEnd),
        // The trims apply only if the dates above did.
        env.DB.prepare(`UPDATE people SET fencing_days = ${keep("people.fencing_days")}
          WHERE family_id IN (SELECT id FROM families WHERE tournament_id = ?3) AND ${datesNow}`).bind(start, end, tid),
      ]);
      if (!res[0].meta.changes) throw new HttpError(409, "The trip was just finalized, or its dates changed on another phone. Reload and check.");
      await log(env, tid, name, "edited the tournament details");
      return json({ ok: true });
    }
    if (method === "DELETE") {
      const t = await tournament(env, tid);
      if (t.is_sandbox) throw new HttpError(409, "The practice trip can't be deleted. Reset it instead.");
      if (t.status === "final") throw new HttpError(409, "This trip is finalized. Reopen it first if you really want to delete it.");
      const d = await env.DB.prepare("UPDATE tournaments SET deleted_at = ?, deleted_by = ? WHERE id = ? AND status = 'open' AND deleted_at IS NULL").bind(now(), name, tid).run();
      if (!d.meta.changes) throw closed();
      await log(env, tid, name, `deleted the trip (it can be restored for ${KEEP_DELETED_DAYS} days)`);
      return json({ ok: true });
    }
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/finalize$/)) && method === "POST") {
    const tid = Number(m[1]);
    await openTournament(env, tid);
    // Finalize the numbers the person was looking at: if anything changed on the trip
    // since their screen loaded, they look again first.
    const b = await body(req).catch(() => ({}));
    const seen = Number(b.seen_activity);
    if (!Number.isInteger(seen)) throw stale();
    const last = await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM activity WHERE tournament_id = ?").bind(tid).first<any>();
    if (last.n > seen) throw new HttpError(409, "Something on this trip changed since your screen loaded. Look over the numbers, then finalize again.");
    const seenFp = typeof b.seen_fingerprint === "string" ? b.seen_fingerprint : null;
    // Payments are worked out from a snapshot, then written in one all-or-nothing
    // batch that only applies if the trip is still open and nothing that affects
    // the money changed since the snapshot (two finalizes, or a save landing in
    // between, can't leave payments that disagree with the expenses).
    const snap = await fingerprint(env, tid);
    // The numbers themselves, as the screen showed them: a change whose activity line
    // isn't written yet is still caught. (A screen from before this check sends none.)
    if (seenFp != null && seenFp !== snap) throw new HttpError(409, "Something on this trip changed since your screen loaded. Look over the numbers, then finalize again.");
    const trip = await loadTrip(env, tid);
    if ((await fingerprint(env, tid)) !== snap) throw new HttpError(409, "Someone changed the trip while you were finalizing. Check it and finalize again.");
    const t = trip.tournament;                       // read inside the snapshot, treasurer included
    if (!t.treasurer_name) throw new HttpError(409, "Someone needs to be the treasurer before the trip can be finalized");
    const { rows, perExpense } = balances(trip.expenses, trip.families);
    if (trip.expenses.some((e: any) => perExpense[e.id].total === 0)) throw new HttpError(409, "An expense has nobody included. Fix it first.");
    const plan = treasurerPlan(rows, t.treasurer_family_id);
    const ok = `EXISTS (SELECT 1 FROM tournaments WHERE id = ? AND status = 'open' AND deleted_at IS NULL) AND (${FINGERPRINT_SQL}) = ?`;
    const okBinds = [tid, tid, tid, tid, tid, snap];
    const res = await env.DB.batch([
      env.DB.prepare(`DELETE FROM payments WHERE tournament_id = ? AND ${ok}`).bind(tid, ...okBinds),
      ...plan.map((x: any) => env.DB.prepare(`INSERT INTO payments (tournament_id, family_id, direction, amount_cents) SELECT ?, ?, ?, ? WHERE ${ok}`)
        .bind(tid, x.family_id, x.direction, x.amount_cents, ...okBinds)),
      env.DB.prepare(`UPDATE tournaments SET status = 'final', finalized_at = ?, finalized_by = ? WHERE id = ? AND ${ok}`).bind(now(), name, tid, ...okBinds),
    ]);
    if (!res[res.length - 1].meta.changes) {
      const now2 = await tournament(env, tid);
      throw new HttpError(409, now2.status === "final" ? "This trip was just finalized by someone else." : "Someone changed the trip while you were finalizing. Check it and finalize again.");
    }
    await log(env, tid, name, `finalized ${t.name}`);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/restore$/)) && method === "POST") {
    const tid = Number(m[1]);
    const t = await tournament(env, tid, { includeDeleted: true });
    if (!t.deleted_at) return json({ ok: true });
    await env.DB.prepare("UPDATE tournaments SET deleted_at = NULL, deleted_by = NULL WHERE id = ?").bind(tid).run();
    await log(env, tid, name, "restored the trip");
    return json({ ok: true });
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/reset-sandbox$/)) && method === "POST") {
    await resetSandbox(env, req, Number(m[1]), name);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/reopen$/)) && method === "POST") {
    const tid = Number(m[1]);
    await tournament(env, tid);
    // The screen warns about the ticks it can see; if another phone ticked more since,
    // reopening would clear them unannounced.
    const seen = Number((await body(req).catch(() => ({}))).ticked);
    if (!Number.isInteger(seen)) throw stale();
    const fewer = "(SELECT COUNT(*) FROM payments WHERE tournament_id = ?1 AND paid_at IS NOT NULL) <= ?2";
    const res = await env.DB.batch([
      env.DB.prepare(`DELETE FROM payments WHERE tournament_id = ?1 AND ${fewer}`).bind(tid, seen),
      env.DB.prepare(`UPDATE tournaments SET status = 'open', finalized_at = NULL, finalized_by = NULL WHERE id = ?1 AND ${fewer}`).bind(tid, seen),
    ]);
    if (!res[1].meta.changes) throw new HttpError(409, "Someone ticked off a payment since this screen loaded. Reload to see it before reopening.");
    await log(env, tid, name, "reopened the tournament; payments will be recalculated");
    return json({ ok: true });
  }
  if ((m = path.match(/^\/payments\/(\d+)$/)) && method === "PATCH") {
    const id = Number(m[1]);
    const x = await env.DB.prepare("SELECT x.*, f.name AS family FROM payments x JOIN families f ON f.id = x.family_id WHERE x.id = ?").bind(id).first<any>();
    if (!x) throw new HttpError(404, "No such payment");
    const pt = await tournament(env, x.tournament_id);   // 404s for a deleted trip
    if (pt.status !== "final") throw new HttpError(409, "Payments can only be ticked off on a finalized trip.");
    const pb = await body(req);
    const paid = !!pb.paid;
    // Payment ids can be reused after a reopen and finalize, so the screen says which payment it saw.
    if (pb.family_id != null && (Number(pb.family_id) !== x.family_id || pb.direction !== x.direction || Number(pb.amount_cents) !== x.amount_cents))
      throw new HttpError(409, "The payment list changed on another phone. Reload to see it.");
    const pu = await env.DB.prepare(`UPDATE payments SET paid_at = ?, paid_marked_by = ? WHERE id = ? AND family_id = ? AND direction = ? AND amount_cents = ?
      AND EXISTS (SELECT 1 FROM tournaments WHERE id = payments.tournament_id AND status = 'final' AND deleted_at IS NULL)`)
      .bind(paid ? now() : null, paid ? name : null, id, x.family_id, x.direction, x.amount_cents).run();
    if (!pu.meta.changes) throw new HttpError(409, "The payment list changed on another phone. Reload to see it.");
    const what = x.direction === "in" ? `${x.family}'s payment to the treasurer` : `the treasurer's payment to ${x.family}`;
    await log(env, x.tournament_id, name, paid ? `marked ${what} as done` : `marked ${what} as not done`);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/treasurer$/)) && method === "PUT") {
    const tid = Number(m[1]);
    const t = await tournament(env, tid);
    const b = await body(req);
    const notes = str(b.treasurer_notes, 1000);
    if (t.status === "final") {
      // Once final the treasurer is fixed; only where-to-send notes can change.
      await env.DB.prepare("UPDATE tournaments SET treasurer_notes = ? WHERE id = ?").bind(notes, tid).run();
      await log(env, tid, name, "updated the treasurer's payment notes");
      return json({ ok: true });
    }
    const tname = str(b.treasurer_name, 80);
    const fid = b.treasurer_family_id == null || b.treasurer_family_id === "" ? null : Number(b.treasurer_family_id);
    if (fid != null) {
      const fam = await env.DB.prepare("SELECT kind FROM families WHERE id = ? AND tournament_id = ?").bind(fid, tid).first<any>();
      if (!fam || fam.kind !== "family") throw new HttpError(400, "Pick a family on this trip");
    }
    const u = await env.DB.prepare("UPDATE tournaments SET treasurer_name = ?, treasurer_family_id = ?, treasurer_notes = ? WHERE id = ? AND status = 'open' AND deleted_at IS NULL")
      .bind(tname || null, tname ? fid : null, tname ? notes : "", tid).run();
    if (!u.meta.changes) throw closed();
    await log(env, tid, name, tname ? (tname === t.treasurer_name ? "updated the treasurer details" : `set ${tname} as treasurer`) : "removed the treasurer");
    return json({ ok: true });
  }

  // Families and people. A family and its people are on the whole trip; the only
  // per-day fact is which days each fencer fences.
  if ((m = path.match(/^\/tournaments\/(\d+)\/families$/)) && method === "POST") {
    const tid = Number(m[1]);
    const b = await body(req);
    const key = clientKey(b);
    const made = key && await env.DB.prepare("SELECT id FROM families WHERE client_key = ? AND tournament_id = ?").bind(key, tid).first<any>();
    if (made) return json({ id: made.id, already: true }, 200);
    await openTournament(env, tid);
    const staff = b.kind === "staff";
    if (!str(b.name)) throw new HttpError(400, staff ? "Give their name" : "Give the family a name");
    const role = staff ? str(b.role, 40) || "Coach" : "";
    const r = await env.DB.prepare(`INSERT INTO families (tournament_id, name, days, kind, role, pay_notes, client_key) SELECT ?, ?, '[]', ?, ?, ?, ? WHERE ${OPEN} ON CONFLICT DO NOTHING RETURNING id`)
      .bind(tid, str(b.name), staff ? "staff" : "family", role, str(b.pay_notes, 300), key, tid).first<any>();
    if (!r && key) {
      const again = await env.DB.prepare("SELECT id FROM families WHERE client_key = ? AND tournament_id = ?").bind(key, tid).first<any>();
      if (again) return json({ id: again.id, already: true }, 200);
    }
    if (!r) throw closed();
    if (staff) {
      await log(env, tid, name, `added ${str(b.role, 40) || "Coach"} ${str(b.name)} to coaches & staff`);
      return json({ id: r.id }, 201);
    }
    // A family that joins late shares the coach's costs from now on (they follow the
    // fencers); it isn't in any meal until someone ticks it (see unitsFor in split.js).
    await log(env, tid, name, `added the ${str(b.name)} family`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/families\/(\d+)$/))) {
    const fid = Number(m[1]);
    const tid = await familyTournament(env, fid);
    // Ids can be reused after a delete, so a change names the family it saw by its tag.
    const b = method === "PATCH" || method === "DELETE" ? await body(req).catch(() => ({})) : {};
    const f = await env.DB.prepare("SELECT * FROM families WHERE id = ?").bind(fid).first<any>();
    if ((method === "PATCH" || method === "DELETE") && b.uid !== f.uid) throw stale();
    if (method === "PATCH") {
      if (b.pay_notes != null && str(b.pay_notes, 300) !== f.pay_notes) {
        // How to pay this family; editable after finalizing, since that's when it's needed.
        await env.DB.prepare("UPDATE families SET pay_notes = ? WHERE id = ? AND uid = ?").bind(str(b.pay_notes, 300), fid, f.uid).run();
        await log(env, tid, name, `updated how to pay the ${f.name} family`);
      }
      if (b.role != null && f.kind === "staff" && str(b.role, 40) !== f.role) {
        await env.DB.prepare("UPDATE families SET role = ? WHERE id = ? AND uid = ?").bind(str(b.role, 40) || "Coach", fid, f.uid).run();
      }
      if (b.name != null && str(b.name) !== f.name) {
        await openTournament(env, tid);
        if (!str(b.name)) throw new HttpError(400, "Give the family a name");
        await env.DB.prepare(`UPDATE families SET name = ? WHERE id = ? AND uid = ? AND ${OPEN}`).bind(str(b.name), fid, f.uid, tid).run();
        await log(env, tid, name, `renamed the ${f.name} family to ${str(b.name)}`);
      }
      return json({ ok: true });
    }
    await openTournament(env, tid);
    if (method === "DELETE") {
      const paid = await env.DB.prepare("SELECT COUNT(*) AS n FROM expenses WHERE paid_by = ?").bind(fid).first<any>();
      if (paid.n > 0) throw new HttpError(409, "This family paid for an expense. Change who paid first.");
      // Each expense's split loses this family as it stands now, so an edit landing meanwhile is kept.
      const can = `NOT EXISTS (SELECT 1 FROM expenses WHERE paid_by = ?1) AND ${OPEN3} AND (SELECT uid FROM families WHERE id = ?1) = ?4`;
      const res = await env.DB.batch([
        // ?2 is the family id as text: the JSON key, not a number.
        env.DB.prepare(`UPDATE expenses SET split = json_remove(split, '$."' || ?2 || '"'), rev = rev + 1 WHERE tournament_id = ?3 AND json_type(split, '$."' || ?2 || '"') IS NOT NULL AND ${can}`).bind(fid, String(fid), tid, f.uid),
        env.DB.prepare(`DELETE FROM families WHERE id = ?1 AND ${can}`).bind(fid, null, tid, f.uid),
      ]);
      if (!res[1].meta.changes) throw new HttpError(409, "This family paid for an expense or the trip was just finalized. Reload and check.");
      await log(env, tid, name, `removed the ${f.name} family`);
      return json({ ok: true });
    }
  }
  if ((m = path.match(/^\/families\/(\d+)\/people$/)) && method === "POST") {
    const fid = Number(m[1]);
    const tid = await familyTournament(env, fid);
    const b = await body(req);
    const key = clientKey(b);
    const made = key && await env.DB.prepare("SELECT id FROM people WHERE client_key = ? AND family_id = ?").bind(key, fid).first<any>();
    if (made) return json({ id: made.id, already: true }, 200);
    await openTournament(env, tid);
    const fam = await env.DB.prepare("SELECT uid FROM families WHERE id = ?").bind(fid).first<any>();
    if (b.uid !== fam.uid) throw stale();
    if (!str(b.name)) throw new HttpError(400, "Give the person a name");
    const all = await allowedDays(env, tid);
    const fencer = !!b.is_fencer;
    // A new fencer starts with no fencing days (Frank): the days actually fenced are ticked,
    // and until they are, the app says so, rather than charging every day unnoticed.
    const fdays = !fencer || b.fencing_days == null ? [] : cleanDays(b.fencing_days, all);
    const r = await env.DB.prepare(`INSERT INTO people (family_id, name, is_fencer, days, fencing_days, client_key)
      SELECT ?1, ?2, ?3, '[]', ?4, ?5
      WHERE EXISTS (SELECT 1 FROM tournaments WHERE id = ?6 AND status = 'open' AND deleted_at IS NULL AND start_date || '/' || end_date = ?7) ON CONFLICT DO NOTHING RETURNING id`)
      .bind(fid, str(b.name), fencer ? 1 : 0, JSON.stringify(fdays), key, tid, all.span).first<any>();
    if (!r && key) {
      const again = await env.DB.prepare("SELECT id FROM people WHERE client_key = ? AND family_id = ?").bind(key, fid).first<any>();
      if (again) return json({ id: again.id, already: true }, 200);
    }
    if (!r) throw closed();
    await log(env, tid, name, `added ${str(b.name)}${fencer ? " (fencer)" : ""}`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/people\/(\d+)$/))) {
    const pid = Number(m[1]);
    const p = await env.DB.prepare("SELECT p.*, f.tournament_id FROM people p JOIN families f ON f.id = p.family_id WHERE p.id = ?").bind(pid).first<any>();
    if (!p) throw new HttpError(404, "No such person");
    await openTournament(env, p.tournament_id);
    // Ids can be reused after a delete, so a change names the person it saw by its tag.
    const b = method === "PATCH" || method === "DELETE" ? await body(req).catch(() => ({})) : {};
    if ((method === "PATCH" || method === "DELETE") && b.uid !== p.uid) throw stale();
    if (method === "PATCH") {
      const all = await allowedDays(env, p.tournament_id);
      const guard = `id = ? AND uid = ? AND ${OPEN} AND ${SAME_SPAN}`, gb = [pid, p.uid, p.tournament_id, p.tournament_id, all.span];
      if (b.fencing_day != null) {
        // One day at a time, applied to the list as it stands, so two phones ticking at
        // once each keep their tick. Only a fencer has fencing days to tick.
        if (!all.has(b.fencing_day)) throw new HttpError(400, "That day isn't on the trip");
        const u = await env.DB.prepare(`UPDATE people SET fencing_days = CASE WHEN ?2 = 1
            THEN (SELECT json_group_array(value) FROM (SELECT value FROM json_each(people.fencing_days) WHERE value != ?1 UNION SELECT ?1 ORDER BY 1))
            ELSE (SELECT json_group_array(value) FROM (SELECT value FROM json_each(people.fencing_days) WHERE value != ?1 ORDER BY 1)) END
          WHERE is_fencer = 1 AND id = ?3 AND uid = ?4
            AND EXISTS (SELECT 1 FROM tournaments WHERE id = ?5 AND status = 'open' AND deleted_at IS NULL AND start_date || '/' || end_date = ?6)`)
          .bind(b.fencing_day, b.on ? 1 : 0, pid, p.uid, p.tournament_id, all.span).run();
        if (!u.meta.changes) throw new HttpError(409, "That changed on another phone a moment ago. Reload and try again.");
      } else {
        // Name and Fencer. Unticking Fencer keeps the days, so ticking it again brings them back.
        const fencer = b.is_fencer == null ? !!p.is_fencer : !!b.is_fencer;
        const fdays = b.fencing_days != null ? JSON.stringify(cleanDays(b.fencing_days, all)) : null;
        const u = await env.DB.prepare(`UPDATE people SET name = ?, is_fencer = ?, fencing_days = COALESCE(?, fencing_days) WHERE ${guard}`)
          .bind(str(b.name) || p.name, fencer ? 1 : 0, fdays, ...gb).run();
        if (!u.meta.changes) throw new HttpError(409, "That changed on another phone a moment ago. Reload and try again.");
      }
      await log(env, p.tournament_id, name, `updated ${str(b.name) || p.name}`);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      const d = await env.DB.prepare(`DELETE FROM people WHERE id = ? AND uid = ? AND ${OPEN}`).bind(pid, p.uid, p.tournament_id).run();
      if (!d.meta.changes) throw closed();
      await log(env, p.tournament_id, name, `removed ${p.name}`);
      return json({ ok: true });
    }
  }

  // Expenses
  if ((m = path.match(/^\/tournaments\/(\d+)\/expenses$/)) && method === "POST") {
    const tid = Number(m[1]);
    const b = await body(req);
    // The phone names each new expense. A key seen before is answered first, before
    // the trip is checked as open: the expense is already added, and nothing changes,
    // even if the trip has been finalized since. "same" says whether this copy matches it.
    const key = typeof b.client_key === "string" && /^[0-9a-f-]{36}$/.test(b.client_key) ? b.client_key : null;
    const made = key && await env.DB.prepare("SELECT * FROM expenses WHERE client_key = ? AND tournament_id = ?").bind(key, tid).first<any>();
    if (made) {
      const e = await expenseInput(env, tid, b).catch(() => null);
      return json({ id: made.id, already: true, same: !!e && EXPENSE_FIELDS.every(k => (e as any)[k] === made[k]) }, 200);
    }
    await openTournament(env, tid);
    const e = await expenseInput(env, tid, b);
    // Family numbers can be reused after a delete: an expense sent late names its payer's tag too.
    if (b.paid_by_uid != null) {
      const f = await env.DB.prepare("SELECT uid FROM families WHERE id = ?").bind(e.paid_by).first<any>();
      if (f?.uid !== b.paid_by_uid) throw new HttpError(409, "The family that paid was removed from the trip.");
    }
    if (e.receipt_key && !(await env.RECEIPTS.head(e.receipt_key))) throw new HttpError(409, "That receipt upload has expired. Add the photo again.");
    const r = await env.DB.prepare(
      `INSERT INTO expenses (tournament_id, description, vendor, date, category, basis, amount_cents, paid_by, split, receipt_key, receipt_type, created_at, created_by, client_key)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${OPEN} ON CONFLICT DO NOTHING RETURNING id`)
      .bind(tid, e.description, e.vendor, e.date, e.category, e.basis, e.amount_cents, e.paid_by, e.split, e.receipt_key, e.receipt_type, now(), name, key, tid).first<any>();
    if (!r && key) {                       // the same save, landing twice at once
      const again = await env.DB.prepare("SELECT id FROM expenses WHERE client_key = ? AND tournament_id = ?").bind(key, tid).first<any>();
      if (again) return json({ id: again.id, already: true, same: true }, 200);
    }
    if (!r) throw closed();
    await log(env, tid, name, `added ${e.description}, $${(e.amount_cents / 100).toFixed(2)}`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/expenses\/(\d+)$/))) {
    const id = Number(m[1]);
    const old = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first<any>();
    if (!old) throw new HttpError(404, "No such expense");
    await openTournament(env, old.tournament_id);
    // Ids can be reused once the newest expense is deleted; the screen names the expense it opened by when it was made.
    const b = method === "GET" ? {} : await body(req).catch(() => ({}));
    if (b.created_at != null && b.created_at !== old.created_at) throw new HttpError(409, "That expense was deleted on another phone. Reload to see the list.");
    // And the revision it opened: an editor left open can't save over a newer correction.
    const e = method === "PATCH" ? await expenseInput(env, old.tournament_id, b) : null;
    if ((method === "PATCH" || method === "DELETE") && b.rev !== old.rev) {
      // The same edit sent again because its reply was lost: it's already saved.
      const same = e && b.rev === old.rev - 1 && EXPENSE_FIELDS.every(k => (e as any)[k] === old[k]);
      if (same) return json({ ok: true });
      throw new HttpError(409, "This expense changed after you opened it, on another phone or by an earlier save of yours that went through. Go back and open it again to see it as it is.");
    }
    if (method === "PATCH" && e) {
      // A new receipt must really be there: an editor left open from before someone
      // else replaced the receipt would otherwise point the expense at a deleted file.
      if (e.receipt_key && e.receipt_key !== old.receipt_key && !(await env.RECEIPTS.head(e.receipt_key)))
        throw new HttpError(409, "That receipt was replaced on another phone. Reload the expense and try again.");
      const u = await env.DB.prepare(
        `UPDATE expenses SET description = ?, vendor = ?, date = ?, category = ?, basis = ?, amount_cents = ?, paid_by = ?, split = ?,
         receipt_key = ?, receipt_type = ?, updated_at = ?, updated_by = ?, rev = rev + 1 WHERE id = ? AND created_at = ? AND rev = ? AND ${OPEN}`)
        .bind(e.description, e.vendor, e.date, e.category, e.basis, e.amount_cents, e.paid_by, e.split, e.receipt_key, e.receipt_type, now(), name, id, old.created_at, old.rev, old.tournament_id).run();
      if (!u.meta.changes) throw new HttpError(409, "This expense or the trip just changed on another phone. Reload and try again.");
      if (old.receipt_key !== e.receipt_key) await dropReceipt(env, old.receipt_key);
      await log(env, old.tournament_id, name, `edited ${e.description}`);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      const d = await env.DB.prepare(`DELETE FROM expenses WHERE id = ? AND created_at = ? AND rev = ? AND ${OPEN}`).bind(id, old.created_at, old.rev, old.tournament_id).run();
      if (!d.meta.changes) throw closed();
      await dropReceipt(env, old.receipt_key);
      await log(env, old.tournament_id, name, `deleted ${old.description}, $${(old.amount_cents / 100).toFixed(2)}`);
      return json({ ok: true });
    }
  }

  // Receipts: the browser shrinks photos first, then uploads the bytes as-is.
  if ((m = path.match(/^\/tournaments\/(\d+)\/receipts$/)) && method === "POST") {
    const tid = Number(m[1]);
    await openTournament(env, tid);
    const type = (req.headers.get("content-type") || "").split(";")[0];
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(type)) throw new HttpError(415, "Upload a photo (JPEG or PNG) or a PDF");
    const size = Number(req.headers.get("content-length"));
    if (!size) throw new HttpError(411, "Upload needs a file size");
    if (size > MAX_RECEIPT_BYTES) throw new HttpError(413, "That file is over 10 MB");
    const key = `t${tid}/${crypto.randomUUID()}`;
    await env.RECEIPTS.put(key, req.body, { httpMetadata: { contentType: type } });
    return json({ key, type }, 201);
  }
  if ((m = path.match(/^\/receipts\/(t(\d+)\/[0-9a-f-]+)$/)) && method === "GET") {
    await tournament(env, Number(m[2]));               // 404s for a deleted trip
    const obj = await env.RECEIPTS.get(m[1]);
    if (!obj) throw new HttpError(404, "Receipt not found");
    return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" } });
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/read-receipt$/)) && method === "POST") {
    const tid = Number(m[1]);
    const t = await openTournament(env, tid);
    const b = await body(req);
    if (typeof b.key !== "string" || !b.key.startsWith(`t${tid}/`)) throw new HttpError(400, "Bad receipt");
    return json(await readReceipt(env, b.key, t));
  }

  // Not a route this server has (an old page after a release, say): not a refusal of what was sent.
  return json({ error: "Not found", route: "unknown" }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof Anthropic.APIError) {
        console.error("Claude API error", env.RECEIPT_MODEL || DEFAULT_RECEIPT_MODEL, err.status, err.message);
        return json({ error: "Couldn't read that receipt right now. Enter it by hand." }, 502);
      }
      console.error(err);
      return json({ error: "Something went wrong on the server" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
