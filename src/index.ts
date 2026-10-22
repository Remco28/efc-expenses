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

const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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

// Remove a trip for good: its receipts in R2, then its rows (children first,
// because expenses point at families).
async function purgeTrip(env: Env, tid: number) {
  let cursor: string | undefined;
  do {
    const list = await env.RECEIPTS.list({ prefix: `t${tid}/`, cursor });
    if (list.objects.length) await env.RECEIPTS.delete(list.objects.map(o => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM expenses WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM families WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM activity WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM tournaments WHERE id = ?").bind(tid),
  ]);
}

// Trips deleted more than 30 days ago go for good. Runs when the trip list is
// opened (no scheduler needed); one per request keeps each request light.
async function purgeExpired(env: Env) {
  const cutoff = new Date(Date.now() - KEEP_DELETED_DAYS * 864e5).toISOString();
  const old = await env.DB.prepare("SELECT id FROM tournaments WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 1").bind(cutoff).first<any>();
  if (old) await purgeTrip(env, old.id);
}

async function openTournament(env: Env, id: number) {
  const t = await tournament(env, id);
  if (t.status === "final") throw new HttpError(409, "This tournament is finalized. Reopen it to make changes.");
  return t;
}

async function familyTournament(env: Env, familyId: number) {
  const row = await env.DB.prepare("SELECT tournament_id FROM families WHERE id = ?").bind(familyId).first<any>();
  if (!row) throw new HttpError(404, "No such family");
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
  return out;
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
  const people = (ppl.results as any[]).map(p => ({ ...p, is_fencer: !!p.is_fencer, own_days: !!p.own_days, days: JSON.parse(p.days), fencing_days: JSON.parse(p.fencing_days) }));
  const families = (fam.results as any[]).map(f => ({ ...f, days: JSON.parse(f.days), people: people.filter(p => p.family_id === f.id) }));
  const expenses = (exp.results as any[]).map(e => ({ ...e, split: JSON.parse(e.split) }));
  return { tournament: t, families, expenses, payments: pay.results, activity: act.results };
}

async function familyIds(env: Env, tid: number) {
  const { results } = await env.DB.prepare("SELECT id FROM families WHERE tournament_id = ?").bind(tid).all<any>();
  return new Set(results.map(r => r.id as number));
}

async function expenseInput(env: Env, tid: number, b: any) {
  const ids = await familyIds(env, tid);
  const amount = Math.round(Number(b.amount_cents));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Amount must be more than zero");
  if (!(b.basis in BASES)) throw new HttpError(400, "Unknown split");
  if (!(b.category in CATEGORIES)) throw new HttpError(400, "Unknown category");
  if (!ids.has(Number(b.paid_by))) throw new HttpError(400, "Pick the family that paid");
  const split: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(b.split || {})) {
    if (!ids.has(Number(k))) continue;
    split[k] = v == null ? null : Math.max(0, Number(v) || 0);
  }
  if (!Object.keys(split).length) throw new HttpError(400, "Include at least one family");
  return {
    description: str(b.description) || CATEGORIES[b.category].label,
    vendor: str(b.vendor),
    date: isDate(b.date) ? b.date : null,
    category: b.category,
    basis: b.basis,
    amount_cents: amount,
    paid_by: Number(b.paid_by),
    split: JSON.stringify(split),
    receipt_key: typeof b.receipt_key === "string" && b.receipt_key.startsWith(`t${tid}/`) ? b.receipt_key : null,
    receipt_type: str(b.receipt_type, 60) || null,
  };
}

// Put the practice trip back to its starting state: everything people added,
// changed or uploaded is removed, then the seed families and expenses go back in.
async function resetSandbox(env: Env, req: Request, tid: number, name: string) {
  const t = await tournament(env, tid);
  if (!t.is_sandbox) throw new HttpError(403, "Only the practice trip can be reset");
  // Receipts people uploaded to this trip
  let cursor: string | undefined;
  do {
    const list = await env.RECEIPTS.list({ prefix: `t${tid}/`, cursor });
    if (list.objects.length) await env.RECEIPTS.delete(list.objects.map(o => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM expenses WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM families WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM activity WHERE tournament_id = ?").bind(tid),
    env.DB.prepare(`UPDATE tournaments SET name = ?, location = ?, start_date = ?, end_date = ?, status = 'open', finalized_at = NULL, finalized_by = NULL,
      treasurer_name = NULL, treasurer_family_id = NULL, treasurer_notes = '' WHERE id = ?`)
      .bind(SANDBOX.name, SANDBOX.location, SANDBOX.start_date, SANDBOX.end_date, tid),
  ]);
  const fid: Record<string, number> = {};
  for (const [fname, pay, people] of SANDBOX.families) {
    const famDays = [...new Set(people.flatMap(([, , days]: [string, number, string[], string[]]) => days))].sort();
    const f = await env.DB.prepare("INSERT INTO families (tournament_id, name, pay_notes, days) VALUES (?, ?, ?, ?) RETURNING id").bind(tid, fname, pay, JSON.stringify(famDays)).first<any>();
    fid[fname] = f.id;
    await env.DB.batch(people.map(([pn, fencer, days, fdays]: [string, number, string[], string[]]) =>
      env.DB.prepare("INSERT INTO people (family_id, name, is_fencer, days, fencing_days, own_days) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(f.id, pn, fencer, JSON.stringify(days), JSON.stringify(fdays), days.length === famDays.length ? 0 : 1)));
  }
  const everyone = JSON.stringify(Object.fromEntries(Object.values(fid).map(id => [id, null])));
  const stamp = now();
  const rows = [];
  for (const [desc, vendor, date, cat, basis, cents, payer, image] of SANDBOX.expenses) {
    let key: string | null = null;
    if (image) {
      const img = await env.ASSETS.fetch(new URL(image, req.url));
      if (img.ok) { key = `t${tid}/${crypto.randomUUID()}`; await env.RECEIPTS.put(key, img.body, { httpMetadata: { contentType: "image/jpeg" } }); }
    }
    rows.push(env.DB.prepare(`INSERT INTO expenses (tournament_id, description, vendor, date, category, basis, amount_cents, paid_by, split, receipt_key, receipt_type, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Practice trip')`).bind(tid, desc, vendor, date, cat, basis, cents, fid[payer], everyone, key, key ? "image/jpeg" : null, stamp));
  }
  await env.DB.batch(rows);
  await log(env, tid, name, "reset the practice trip to its starting point");
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
- description: a few words for a list of team expenses, like "Team lunch" or "Coach hotel, 2 nights"
- total: the final amount charged, including tax and tip, as a number in dollars
- date: the date of purchase as YYYY-MM-DD (assume the trip's year if the receipt omits it)
- category, one of:
${categories}
  (A hotel, flight or meal for one person is usually the coach's.)
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
              (SELECT COUNT(*) FROM families f WHERE f.tournament_id = t.id) AS family_count,
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
    const r = await env.DB.prepare(
      "INSERT INTO tournaments (name, location, start_date, end_date, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(str(b.name), str(b.location), b.start_date, b.end_date, now(), name).first<any>();
    await log(env, r.id, name, `created the tournament`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/tournaments\/(\d+)$/))) {
    const tid = Number(m[1]);
    if (method === "GET") return json(await loadTrip(env, tid));
    if (method === "PATCH") {
      const t = await openTournament(env, tid);
      const b = await body(req);
      const start = isDate(b.start_date) ? b.start_date : t.start_date;
      const end = isDate(b.end_date) ? b.end_date : t.end_date;
      if (end < start) throw new HttpError(400, "Check the dates");
      await env.DB.prepare("UPDATE tournaments SET name = ?, location = ?, start_date = ?, end_date = ? WHERE id = ?")
        .bind(str(b.name) || t.name, b.location == null ? t.location : str(b.location), start, end, tid).run();
      await log(env, tid, name, "edited the tournament details");
      return json({ ok: true });
    }
    if (method === "DELETE") {
      const t = await tournament(env, tid);
      if (t.is_sandbox) throw new HttpError(409, "The practice trip can't be deleted. Reset it instead.");
      if (t.status === "final") throw new HttpError(409, "This trip is finalized. Reopen it first if you really want to delete it.");
      await env.DB.prepare("UPDATE tournaments SET deleted_at = ?, deleted_by = ? WHERE id = ?").bind(now(), name, tid).run();
      await log(env, tid, name, `deleted the trip (it can be restored for ${KEEP_DELETED_DAYS} days)`);
      return json({ ok: true });
    }
  }
  if ((m = path.match(/^\/tournaments\/(\d+)\/finalize$/)) && method === "POST") {
    const tid = Number(m[1]);
    const t = await openTournament(env, tid);
    if (!t.treasurer_name) throw new HttpError(409, "Someone needs to be the treasurer before the trip can be finalized");
    const trip = await loadTrip(env, tid);
    const { rows, perExpense } = balances(trip.expenses, trip.families);
    if (trip.expenses.some((e: any) => perExpense[e.id].total === 0)) throw new HttpError(409, "An expense has nobody included. Fix it first.");
    const plan = treasurerPlan(rows, t.treasurer_family_id);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
      ...plan.map((x: any) => env.DB.prepare("INSERT INTO payments (tournament_id, family_id, direction, amount_cents) VALUES (?, ?, ?, ?)")
        .bind(tid, x.family_id, x.direction, x.amount_cents)),
      env.DB.prepare("UPDATE tournaments SET status = 'final', finalized_at = ?, finalized_by = ? WHERE id = ?").bind(now(), name, tid),
    ]);
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
    await env.DB.batch([
      env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
      env.DB.prepare("UPDATE tournaments SET status = 'open', finalized_at = NULL, finalized_by = NULL WHERE id = ?").bind(tid),
    ]);
    await log(env, tid, name, "reopened the tournament; payments will be recalculated");
    return json({ ok: true });
  }
  if ((m = path.match(/^\/payments\/(\d+)$/)) && method === "PATCH") {
    const id = Number(m[1]);
    const x = await env.DB.prepare("SELECT x.*, f.name AS family FROM payments x JOIN families f ON f.id = x.family_id WHERE x.id = ?").bind(id).first<any>();
    if (!x) throw new HttpError(404, "No such payment");
    const paid = !!(await body(req)).paid;
    await env.DB.prepare("UPDATE payments SET paid_at = ?, paid_marked_by = ? WHERE id = ?").bind(paid ? now() : null, paid ? name : null, id).run();
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
    if (fid != null && !(await familyIds(env, tid)).has(fid)) throw new HttpError(400, "Pick a family on this trip");
    await env.DB.prepare("UPDATE tournaments SET treasurer_name = ?, treasurer_family_id = ?, treasurer_notes = ? WHERE id = ?")
      .bind(tname || null, tname ? fid : null, tname ? notes : "", tid).run();
    await log(env, tid, name, tname ? (tname === t.treasurer_name ? "updated the treasurer details" : `set ${tname} as treasurer`) : "removed the treasurer");
    return json({ ok: true });
  }

  // Families and people. Days are set per family; everyone follows them unless
  // they have their own (own_days). Fencing days always stay within the days a
  // person is there. people.days stays the source of truth for every split.
  if ((m = path.match(/^\/tournaments\/(\d+)\/families$/)) && method === "POST") {
    const tid = Number(m[1]);
    await openTournament(env, tid);
    const b = await body(req);
    if (!str(b.name)) throw new HttpError(400, "Give the family a name");
    const all = await allowedDays(env, tid);
    const days = b.days == null ? [...all].sort() : cleanDays(b.days, all);
    const r = await env.DB.prepare("INSERT INTO families (tournament_id, name, days) VALUES (?, ?, ?) RETURNING id").bind(tid, str(b.name), JSON.stringify(days)).first<any>();
    await log(env, tid, name, `added the ${str(b.name)} family`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/families\/(\d+)$/))) {
    const fid = Number(m[1]);
    const tid = await familyTournament(env, fid);
    if (method === "PATCH") {
      const b = await body(req);
      const f = await env.DB.prepare("SELECT * FROM families WHERE id = ?").bind(fid).first<any>();
      if (b.pay_notes != null && str(b.pay_notes, 300) !== f.pay_notes) {
        // How to pay this family; editable after finalizing, since that's when it's needed.
        await env.DB.prepare("UPDATE families SET pay_notes = ? WHERE id = ?").bind(str(b.pay_notes, 300), fid).run();
        await log(env, tid, name, `updated how to pay the ${f.name} family`);
      }
      if (b.name != null && str(b.name) !== f.name) {
        await openTournament(env, tid);
        if (!str(b.name)) throw new HttpError(400, "Give the family a name");
        await env.DB.prepare("UPDATE families SET name = ? WHERE id = ?").bind(str(b.name), fid).run();
        await log(env, tid, name, `renamed the ${f.name} family to ${str(b.name)}`);
      }
      if (b.days != null) {
        await openTournament(env, tid);
        const days = cleanDays(b.days, await allowedDays(env, tid));
        const { results: ppl } = await env.DB.prepare("SELECT * FROM people WHERE family_id = ? AND own_days = 0").bind(fid).all<any>();
        await env.DB.batch([
          env.DB.prepare("UPDATE families SET days = ? WHERE id = ?").bind(JSON.stringify(days), fid),
          ...ppl.map(p => env.DB.prepare("UPDATE people SET days = ?, fencing_days = ? WHERE id = ?")
            .bind(JSON.stringify(days), JSON.stringify(JSON.parse(p.fencing_days).filter((d: string) => days.includes(d))), p.id)),
        ]);
        await log(env, tid, name, `set the ${f.name} family's days`);
      }
      return json({ ok: true });
    }
    await openTournament(env, tid);
    if (method === "DELETE") {
      const paid = await env.DB.prepare("SELECT COUNT(*) AS n FROM expenses WHERE paid_by = ?").bind(fid).first<any>();
      if (paid.n > 0) throw new HttpError(409, "This family paid for an expense. Change who paid first.");
      const f = await env.DB.prepare("SELECT name FROM families WHERE id = ?").bind(fid).first<any>();
      const { results } = await env.DB.prepare("SELECT id, split FROM expenses WHERE tournament_id = ?").bind(tid).all<any>();
      const updates = results.filter(e => String(fid) in JSON.parse(e.split)).map(e => {
        const s = JSON.parse(e.split); delete s[String(fid)];
        return env.DB.prepare("UPDATE expenses SET split = ? WHERE id = ?").bind(JSON.stringify(s), e.id);
      });
      await env.DB.batch([...updates, env.DB.prepare("DELETE FROM families WHERE id = ?").bind(fid)]);
      await log(env, tid, name, `removed the ${f.name} family`);
      return json({ ok: true });
    }
  }
  if ((m = path.match(/^\/families\/(\d+)\/people$/)) && method === "POST") {
    const fid = Number(m[1]);
    const tid = await familyTournament(env, fid);
    await openTournament(env, tid);
    const b = await body(req);
    if (!str(b.name)) throw new HttpError(400, "Give the person a name");
    const all = await allowedDays(env, tid);
    const f = await env.DB.prepare("SELECT days FROM families WHERE id = ?").bind(fid).first<any>();
    const own = !!b.own_days;
    const days = own ? cleanDays(b.days, all) : JSON.parse(f.days);
    const fencer = !!b.is_fencer;
    // A new fencer starts fencing every day they're there; it's one tap to take days off.
    const fencing = !fencer ? [] : b.fencing_days == null ? days : cleanDays(b.fencing_days, all).filter((d: string) => days.includes(d));
    const r = await env.DB.prepare("INSERT INTO people (family_id, name, is_fencer, days, fencing_days, own_days) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(fid, str(b.name), fencer ? 1 : 0, JSON.stringify(days), JSON.stringify(fencing), own ? 1 : 0).first<any>();
    await log(env, tid, name, `added ${str(b.name)}${fencer ? " (fencer)" : ""}`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/people\/(\d+)$/))) {
    const pid = Number(m[1]);
    const p = await env.DB.prepare("SELECT p.*, f.tournament_id, f.days AS family_days FROM people p JOIN families f ON f.id = p.family_id WHERE p.id = ?").bind(pid).first<any>();
    if (!p) throw new HttpError(404, "No such person");
    await openTournament(env, p.tournament_id);
    if (method === "PATCH") {
      const b = await body(req);
      const all = await allowedDays(env, p.tournament_id);
      const own = b.own_days == null ? !!p.own_days : !!b.own_days;
      // Back to family days, or own days as given (or as they were).
      const days: string[] = !own ? JSON.parse(p.family_days) : b.days == null ? JSON.parse(p.days) : cleanDays(b.days, all);
      const fencer = b.is_fencer == null ? !!p.is_fencer : !!b.is_fencer;
      const wasFencing: string[] = JSON.parse(p.fencing_days);
      const fencing = !fencer ? [] : (b.fencing_days == null ? (!p.is_fencer ? days : wasFencing) : cleanDays(b.fencing_days, all)).filter(d => days.includes(d));
      await env.DB.prepare("UPDATE people SET name = ?, is_fencer = ?, days = ?, fencing_days = ?, own_days = ? WHERE id = ?").bind(
        str(b.name) || p.name, fencer ? 1 : 0, JSON.stringify(days), JSON.stringify(fencing), own ? 1 : 0, pid).run();
      await log(env, p.tournament_id, name, `updated ${str(b.name) || p.name}`);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM people WHERE id = ?").bind(pid).run();
      await log(env, p.tournament_id, name, `removed ${p.name}`);
      return json({ ok: true });
    }
  }

  // Expenses
  if ((m = path.match(/^\/tournaments\/(\d+)\/expenses$/)) && method === "POST") {
    const tid = Number(m[1]);
    await openTournament(env, tid);
    const e = await expenseInput(env, tid, await body(req));
    const r = await env.DB.prepare(
      `INSERT INTO expenses (tournament_id, description, vendor, date, category, basis, amount_cents, paid_by, split, receipt_key, receipt_type, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(tid, e.description, e.vendor, e.date, e.category, e.basis, e.amount_cents, e.paid_by, e.split, e.receipt_key, e.receipt_type, now(), name).first<any>();
    await log(env, tid, name, `added ${e.description}, $${(e.amount_cents / 100).toFixed(2)}`);
    return json({ id: r.id }, 201);
  }
  if ((m = path.match(/^\/expenses\/(\d+)$/))) {
    const id = Number(m[1]);
    const old = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first<any>();
    if (!old) throw new HttpError(404, "No such expense");
    await openTournament(env, old.tournament_id);
    if (method === "PATCH") {
      const e = await expenseInput(env, old.tournament_id, await body(req));
      await env.DB.prepare(
        `UPDATE expenses SET description = ?, vendor = ?, date = ?, category = ?, basis = ?, amount_cents = ?, paid_by = ?, split = ?,
         receipt_key = ?, receipt_type = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
        .bind(e.description, e.vendor, e.date, e.category, e.basis, e.amount_cents, e.paid_by, e.split, e.receipt_key, e.receipt_type, now(), name, id).run();
      if (old.receipt_key && old.receipt_key !== e.receipt_key) await env.RECEIPTS.delete(old.receipt_key);
      await log(env, old.tournament_id, name, `edited ${e.description}`);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
      if (old.receipt_key) await env.RECEIPTS.delete(old.receipt_key);
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
    const size = Number(req.headers.get("content-length") || 0);
    if (size > MAX_RECEIPT_BYTES) throw new HttpError(413, "That file is over 10 MB");
    const key = `t${tid}/${crypto.randomUUID()}`;
    await env.RECEIPTS.put(key, req.body, { httpMetadata: { contentType: type } });
    return json({ key, type }, 201);
  }
  if ((m = path.match(/^\/receipts\/(t\d+\/[0-9a-f-]+)$/)) && method === "GET") {
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

  throw new HttpError(404, "Not found");
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
