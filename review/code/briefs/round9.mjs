import { stamp } from "./stamp.mjs";
const B = "http://127.0.0.1:8817/api";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
const cookie = r0.headers.get("set-cookie").split(";")[0];
const raw = async (p, m = "GET", b) => { const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", "content-type": "application/json" }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const call = async (p, m = "GET", b) => raw(p, m, await stamp(B, cookie, p, m, b));
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const get = async t => (await call(`/tournaments/${t}`)).d;
const D = ["2027-12-04", "2027-12-05", "2027-12-06"];
// 1. a new expense retried with a correction after a lost reply
const tk = crypto.randomUUID();
const t1 = (await call("/tournaments", "POST", { name: "R9", start_date: D[0], end_date: D[1], client_key: tk })).d.id;
ok((await call("/tournaments", "POST", { name: "R9", start_date: D[0], end_date: D[1], client_key: tk })).d.id === t1, "a new trip sent twice is made once");
const t = t1;
const fk = crypto.randomUUID(), A = (await call(`/tournaments/${t}/families`, "POST", { name: "Adams", client_key: fk })).d.id;
ok((await call(`/tournaments/${t}/families`, "POST", { name: "Adams", client_key: fk })).d.id === A && (await get(t)).families.length === 1, "a new family sent twice is added once");
const pk = crypto.randomUUID(), ava = (await call(`/families/${A}/people`, "POST", { name: "Ava", is_fencer: true, client_key: pk })).d.id;
ok((await call(`/families/${A}/people`, "POST", { name: "Ava", is_fencer: true, client_key: pk })).d.id === ava && (await get(t)).families[0].people.length === 1, "a new person sent twice is added once");
const k = crypto.randomUUID(), ex = { description: "Lunch", category: "meal", basis: "person", amount_cents: 2000, paid_by: A, split: {}, client_key: k };
const e = (await call(`/tournaments/${t}/expenses`, "POST", ex)).d.id;
// (since the saving design: a resent key never changes anything, it says "already added" and whether this copy matches)
const re = await call(`/tournaments/${t}/expenses`, "POST", { ...ex, amount_cents: 6500 });
ok(re.s === 200 && re.d.id === e && re.d.already && re.d.same === false && (await get(t)).expenses.find(x => x.id === e).amount_cents === 2000, "a resent key with different content is answered already-added, not same, and changes nothing");
// 2. (adding a day to a family: retired with attendance days, see billing-model.md)
const t2 = (await call("/tournaments", "POST", { name: "R9 days", start_date: D[0], end_date: D[2] })).d.id;
const F = (await call(`/tournaments/${t2}/families`, "POST", { name: "Fox" })).d.id;
await call(`/families/${F}/people`, "POST", { name: "All", is_fencer: true, fencing_days: D });
// 3. finalize refuses numbers the screen didn't see
await call(`/tournaments/${t2}/treasurer`, "PUT", { treasurer_name: "T", treasurer_family_id: F });
const seen = Math.max(0, ...(await get(t2)).activity.map(a => a.id));
await call(`/families/${F}`, "PATCH", { pay_notes: "Venmo @fox" });
ok((await raw(`/tournaments/${t2}/finalize`, "POST", { seen_activity: seen })).s === 409, "finalizing numbers from before a change is refused");
ok((await call(`/tournaments/${t2}/finalize`, "POST")).s === 200, "finalizing what the screen shows works");
