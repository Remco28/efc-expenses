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
// fencing days: rest days are remembered, so a day put back comes back as it was
{
  const D3 = ["2028-06-02", "2028-06-03", "2028-06-04"];
  const t3 = (await call("/tournaments", "POST", { name: "Fence", start_date: D3[0], end_date: D3[2] })).d.id;
  const L = (await call(`/tournaments/${t3}/families`, "POST", { name: "Lee" })).d.id;
  const pick = (await call(`/families/${L}/people`, "POST", { name: "Pick", is_fencer: true })).d.id;
  const all = (await call(`/families/${L}/people`, "POST", { name: "All", is_fencer: true })).d.id;
  const own = (await call(`/families/${L}/people`, "POST", { name: "Own", is_fencer: true })).d.id;
  const fd = async id => (await get(t3)).families[0].people.find(p => p.id === id).fencing_days.join();
  await call(`/people/${pick}`, "PATCH", { fencing_day: D3[2], on: false });            // rests Sun
  await call(`/families/${L}`, "PATCH", { day: D3[1], on: false });
  await call(`/families/${L}`, "PATCH", { day: D3[1], on: true });
  ok(await fd(pick) === D3.slice(0, 2).join(), `Sat off and on keeps Pick's Sat fencing and Sun rest (${await fd(pick)})`);
  ok(await fd(all) === D3.join(), "an every-day fencer still fences all three");
  await call(`/people/${pick}`, "PATCH", { fencing_day: D3[1], on: false });            // rests Sat too
  await call(`/families/${L}`, "PATCH", { day: D3[1], on: false });
  await call(`/families/${L}`, "PATCH", { day: D3[1], on: true });
  ok(await fd(pick) === D3[0], `a rested Sat stays rested after Sat off and on (${await fd(pick)})`);
  // own days: an every-day fencer with a day added to their own days fences it
  await call(`/families/${L}`, "PATCH", { day: D3[2], on: false });
  await call(`/people/${own}`, "PATCH", { own_day: D3[2], on: true });
  ok(await fd(own) === D3.join(), `an own day added is fenced (${await fd(own)})`);
  await call(`/people/${own}`, "PATCH", { own_days: false });
  ok(await fd(own) === D3.slice(0, 2).join(), "back to the family's days");
  await call(`/families/${L}`, "PATCH", { day: D3[2], on: true });
  ok(await fd(own) === D3.join(), "and the family's day added back is fenced");
  // unticking Fencer keeps the picks
  await call(`/people/${pick}`, "PATCH", { is_fencer: false }); await call(`/people/${pick}`, "PATCH", { is_fencer: true });
  ok(await fd(pick) === D3[0], "re-ticking Fencer brings back the picks");
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
