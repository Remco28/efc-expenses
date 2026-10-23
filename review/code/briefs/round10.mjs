// Saving on a bad connection (design v4): a resent key only ever says "already added"
import { stamp } from "./stamp.mjs";
const B = "http://127.0.0.1:8817/api";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
const cookie = r0.headers.get("set-cookie").split(";")[0];
const raw = async (p, m = "GET", b) => { const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", "content-type": "application/json" }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const call = async (p, m = "GET", b) => raw(p, m, await stamp(B, cookie, p, m, b));
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const get = async t => (await call(`/tournaments/${t}`)).d;
const D = ["2028-02-08", "2028-02-09"];
// trips, families, people: never changed by a resent key
const tk = crypto.randomUUID();
const t = (await call("/tournaments", "POST", { name: "Spring Opne", start_date: D[0], end_date: D[1], client_key: tk })).d.id;
let r = await call("/tournaments", "POST", { name: "Spring Open", start_date: D[0], end_date: D[1], client_key: tk });
ok(r.d.id === t && r.d.already && (await get(t)).tournament.name === "Spring Opne", "a resent trip key answers already-added and changes nothing");
const fk = crypto.randomUUID(), F = (await call(`/tournaments/${t}/families`, "POST", { name: "Smith", client_key: fk })).d.id;
r = await call(`/tournaments/${t}/families`, "POST", { name: "Coach Bo", kind: "staff", client_key: fk });
ok(r.d.id === F && r.d.already && (await get(t)).families.length === 1 && (await get(t)).families[0].kind === "family", "a coach add on a family's key leaves the family alone");
const pk = crypto.randomUUID(), ava = (await call(`/families/${F}/people`, "POST", { name: "Ava", is_fencer: true, client_key: pk })).d.id;
r = await call(`/families/${F}/people`, "POST", { name: "Ben", is_fencer: false, client_key: pk });
ok(r.d.id === ava && r.d.already && (await get(t)).families[0].people.map(p => p.name).join() === "Ava", "Ben on Ava's key can't rename Ava");
// expenses: the key is checked before the trip is checked as open
await call(`/families/${F}/people`, "POST", { name: "Sam", is_fencer: false });
const fam = (await get(t)).families[0];
const k = crypto.randomUUID(), ex = { description: "Dinner", category: "meal", basis: "person", amount_cents: 4500, paid_by: F, split: {}, client_key: k, paid_by_uid: fam.uid };
const e = (await call(`/tournaments/${t}/expenses`, "POST", ex)).d.id;
await call(`/tournaments/${t}/treasurer`, "PUT", { treasurer_name: "T", treasurer_family_id: F });
ok((await call(`/tournaments/${t}/finalize`, "POST")).s === 200, "finalized");
r = await call(`/tournaments/${t}/expenses`, "POST", ex);
ok(r.s === 200 && r.d.id === e && r.d.already && r.d.same, "after finalizing, a resend of an expense that landed before is already-added, not refused");
r = await call(`/tournaments/${t}/expenses`, "POST", { ...ex, client_key: crypto.randomUUID() });
ok(r.s === 409, "a new expense after finalizing is refused");
// the payer's tag
const t2 = (await call("/tournaments", "POST", { name: "Tags", start_date: D[0], end_date: D[1] })).d.id;
const G = (await call(`/tournaments/${t2}/families`, "POST", { name: "Gray" })).d.id;
await call(`/families/${G}/people`, "POST", { name: "g" });
r = await call(`/tournaments/${t2}/expenses`, "POST", { ...ex, paid_by: G, client_key: crypto.randomUUID(), paid_by_uid: "0000000000000000" });
ok(r.s === 409 && /removed/.test(r.d.error), "an expense whose payer's tag doesn't match is refused");
r = await call(`/tournaments/${t2}/expenses`, "POST", { ...ex, paid_by: G, client_key: crypto.randomUUID(), paid_by_uid: (await get(t2)).families[0].uid });
ok(r.s === 201, "with the right tag it's added");
// a route the server doesn't have is marked as such
r = await raw("/no-such-route", "POST", {});
ok(r.s === 404 && r.d.route === "unknown", "an unknown route says so");
r = await raw("/tournaments/999999/expenses", "POST", { ...ex, client_key: crypto.randomUUID() });
ok(r.s === 404 && r.d.route !== "unknown", "a missing trip is a refusal, not an unknown route");
// fencing days (since the opt-in split: no attendance days): one day per tap; unticking Fencer keeps them
{
  const D3 = ["2028-06-02", "2028-06-03", "2028-06-04"];
  const t3 = (await call("/tournaments", "POST", { name: "Fence", start_date: D3[0], end_date: D3[2] })).d.id;
  const L = (await call(`/tournaments/${t3}/families`, "POST", { name: "Lee" })).d.id;
  const pick = (await call(`/families/${L}/people`, "POST", { name: "Pick", is_fencer: true })).d.id;
  const fd = async id => (await get(t3)).families[0].people.find(p => p.id === id).fencing_days.join();
  ok(await fd(pick) === "", "a new fencer starts with no fencing days");
  await call(`/people/${pick}`, "PATCH", { is_fencer: false }); await call(`/people/${pick}`, "PATCH", { is_fencer: true });
  ok(await fd(pick) === "", "unticking and reticking Fencer doesn't fill in every day");
  await call(`/people/${pick}`, "PATCH", { fencing_days: D3 });
  await Promise.all([call(`/people/${pick}`, "PATCH", { fencing_day: D3[0], on: false }), call(`/people/${pick}`, "PATCH", { fencing_day: D3[2], on: false })]);
  ok(await fd(pick) === D3[1], `two taps at once each keep their change (${await fd(pick)})`);
  await call(`/people/${pick}`, "PATCH", { is_fencer: false });
  ok(await fd(pick) === "", "not a fencer: no fencing days count");
  await call(`/people/${pick}`, "PATCH", { is_fencer: true });
  ok(await fd(pick) === D3[1], "ticking Fencer again brings back the days picked");
  ok((await call(`/people/${pick}`, "PATCH", { fencing_day: "2030-01-01", on: true })).s === 400, "a day not on the trip is refused");
}
// finalize locks only the numbers the screen showed, even if an activity line is missing
{
  const t4 = (await call("/tournaments", "POST", { name: "Fp", start_date: "2028-07-01", end_date: "2028-07-01" })).d.id;
  const H = (await call(`/tournaments/${t4}/families`, "POST", { name: "Hart" })).d.id; await call(`/families/${H}/people`, "POST", { name: "h" });
  await call(`/tournaments/${t4}/treasurer`, "PUT", { treasurer_name: "T", treasurer_family_id: H });
  const fp = (await get(t4)).fingerprint;
  await call(`/tournaments/${t4}/expenses`, "POST", { description: "Late", category: "meal", basis: "person", amount_cents: 900, paid_by: H, split: {} });
  const act = Math.max(0, ...(await get(t4)).activity.map(a => a.id));
  ok((await raw(`/tournaments/${t4}/finalize`, "POST", { seen_activity: act, seen_fingerprint: fp })).s === 409, "finalize with the numbers from before an expense is refused, even with the newest activity");
  ok((await raw(`/tournaments/${t4}/finalize`, "POST", { seen_activity: act, seen_fingerprint: (await get(t4)).fingerprint })).s === 200, "with the numbers as they are, it finalizes");
}
// the opt-in split (billing-model.md): the kind fixes the split; who took part is ticked
{
  const t5 = (await call("/tournaments", "POST", { name: "Split", start_date: "2028-08-01", end_date: "2028-08-02" })).d.id;
  const X = (await call(`/tournaments/${t5}/families`, "POST", { name: "Xu" })).d.id, Y = (await call(`/tournaments/${t5}/families`, "POST", { name: "Yang" })).d.id;
  const S = (await call(`/tournaments/${t5}/families`, "POST", { name: "Coach Z", kind: "staff" })).d.id;
  for (const [f, n, fe] of [[X, "x1", true], [X, "x2", false], [Y, "y1", true]]) await call(`/families/${f}/people`, "POST", { name: n, is_fencer: fe });
  const post = b => raw(`/tournaments/${t5}/expenses`, "POST", { description: "d", amount_cents: 3000, paid_by: X, ...b });
  const tr = async () => (await get(t5));
  let r = await post({ category: "meal", basis: "per_fencer", split: { [X]: 2 } });
  ok(r.s === 201 && (await tr()).expenses.find(e => e.id === r.d.id).basis === "took_part", "a team meal is always who took part, whatever is sent");
  ok((await post({ category: "meal", basis: "took_part", split: {} })).s === 400, "a meal with nobody ticked is refused");
  ok((await post({ category: "meal", basis: "took_part", split: { [X]: 51 } })).s === 400, "a head count above 50 is refused");
  r = await post({ category: "meal", basis: "took_part", split: { [X]: 3, [S]: 2 } });
  ok(r.s === 201 && !(String(S) in (await tr()).expenses.find(e => e.id === r.d.id).split), "a coach ticked on a meal is left out: the families who went pay");
  const fams = (await tr()).families;
  ok((await post({ category: "meal", basis: "took_part", split: { [Y]: 1 }, split_uids: { [Y]: "0000000000000000" } })).s === 409, "a meal naming a family by a tag that isn't theirs is refused");
  ok((await post({ category: "meal", basis: "took_part", split: { [Y]: 1 }, split_uids: { [Y]: fams.find(f => f.id === Y).uid } })).s === 201, "with the right tags it's added");
  r = await post({ category: "coach_travel", basis: "took_part", split: { [X]: 5 } });
  const e1 = (await tr()).expenses.find(e => e.id === r.d.id);
  ok(e1.basis === "per_fencer" && JSON.stringify(e1.split) === "{}", "coach travel is equal per fencer, with nothing ticked");
  r = await post({ category: "other", basis: "fencer_day", split: {} });
  ok(r.s === 201 && (await tr()).expenses.find(e => e.id === r.d.id).basis === "fencer_day", "Other keeps the split chosen");
  ok((await post({ category: "supplies", basis: "per_fencer", split: {} })).s === 400, "team supplies isn't a kind any more");
}
// the practice trip seeds in the new model, meals ticked
{
  await call("/tournaments/50/reset-sandbox", "POST");
  const sb = await get(50);
  const meals = sb.expenses.filter(e => e.basis === "took_part");
  ok(sb.expenses.length === 5 && meals.length === 2 && meals.every(e => Object.keys(e.split).length >= 2), `the practice trip has its meals ticked (${meals.map(e => JSON.stringify(e.split))})`);
  ok(sb.families.flatMap(f => f.people).filter(p => p.is_fencer).map(p => p.fencing_days.length).join() === "2,1,2", "and its fencers' days");
}
