import { stamp } from "./stamp.mjs";
import { balances } from "/home/frank/Dev/efc-expenses/public/split.js";
const B = "http://127.0.0.1:8817/api"; let cookie = "";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
cookie = r0.headers.get("set-cookie").split(";")[0];
const call = async (p, m = "GET", b, extra = {}) => { b = await stamp(B, cookie, p, m, b); const isBin = b instanceof Uint8Array; const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", ...(isBin ? {} : { "content-type": "application/json" }), ...extra }, body: isBin ? b : b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const D = ["2027-05-01", "2027-05-02", "2027-05-03"];
const t = (await call("/tournaments", "POST", { name: "Regress", start_date: D[0], end_date: D[2] })).d.id;
const A = (await call(`/tournaments/${t}/families`, "POST", { name: "A" })).d.id, Bf = (await call(`/tournaments/${t}/families`, "POST", { name: "B" })).d.id;
await call(`/families/${A}/people`, "POST", { name: "a", is_fencer: true }); await call(`/families/${Bf}/people`, "POST", { name: "b", is_fencer: true });
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), c => c.charCodeAt(0));
const up = (await call(`/tournaments/${t}/receipts`, "POST", png, { "content-type": "image/png" })).d;
// receipt key injection
const bad = (await call(`/tournaments/${t}/expenses`, "POST", { description: "x", category: "meal", basis: "person", amount_cents: 100, paid_by: A, split: {}, receipt_key: `t${t}/missing" onerror="alert(1)`, receipt_type: "image/jpeg" })).d.id;
let trip = (await call(`/tournaments/${t}`)).d;
ok(trip.expenses.find(e => e.id === bad).receipt_key === null, "a crafted receipt reference is refused (stored as none)");
// prototype names
ok((await fetch(B + `/tournaments/${t}/expenses`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ description: "x", category: "other", basis: "toString", amount_cents: 100, paid_by: A, split: {} }) })).status === 400, "basis 'toString' is rejected");
ok((await call(`/tournaments/${t}/expenses`, "POST", { description: "x", category: "constructor", basis: "person", amount_cents: 100, paid_by: A, split: {} })).s === 400, "category 'constructor' is rejected");
// huge shares
ok((await call(`/tournaments/${t}/expenses`, "POST", { description: "x", category: "other", basis: "custom", amount_cents: 100, paid_by: A, split: { [A]: 1e308, [Bf]: 1e308 } })).s === 400, "share counts over 1000 are rejected");
// shared receipt: two expenses, delete one, the other's receipt survives
const e1 = (await call(`/tournaments/${t}/expenses`, "POST", { description: "r1", category: "meal", basis: "person", amount_cents: 100, paid_by: A, split: {}, receipt_key: up.key, receipt_type: "image/png" })).d.id;
await call(`/tournaments/${t}/expenses`, "POST", { description: "r2", category: "meal", basis: "person", amount_cents: 100, paid_by: A, split: {}, receipt_key: up.key, receipt_type: "image/png" });
await call(`/expenses/${e1}`, "DELETE");
ok((await fetch(B + "/receipts/" + up.key, { headers: { cookie } })).status === 200, "deleting one expense keeps a receipt another still uses");
// upload without a size
const stream = new ReadableStream({ start(c) { c.enqueue(png); c.close(); } });
const noLen = await fetch(B + `/tournaments/${t}/receipts`, { method: "POST", headers: { cookie, "content-type": "image/png" }, body: stream, duplex: "half" });
ok(noLen.status === 411, `upload without a size is refused (${noLen.status})`);
// (since the opt-in split) a family added later is not in a meal it didn't take part in
const meal = (await call(`/tournaments/${t}/expenses`, "POST", { description: "Lunch", category: "meal", basis: "person", amount_cents: 3000, paid_by: A, date: D[1], split: { [A]: null, [Bf]: null } })).d.id;
const C = (await call(`/tournaments/${t}/families`, "POST", { name: "C" })).d.id; await call(`/families/${C}/people`, "POST", { name: "c", is_fencer: false });
trip = (await call(`/tournaments/${t}`)).d;
const s = balances(trip.expenses, trip.families).perExpense[meal];
ok(!(String(C) in trip.expenses.find(e => e.id === meal).split) && !s.units[C], "a family added later doesn't share a meal it didn't take part in");
// shortening the trip prunes days
await call(`/tournaments/${t}`, "PATCH", { end_date: D[1] });
trip = (await call(`/tournaments/${t}`)).d;
ok(trip.families.every(f => !f.days.includes(D[2]) && f.people.every(p => !p.days.includes(D[2]) && !p.fencing_days.includes(D[2]))), "shortening the trip removes the dropped day everywhere");
// deleted trip: no writes, no receipts
await call(`/tournaments/${t}`, "DELETE");
ok((await call(`/families/${A}`, "PATCH", { pay_notes: "changed" })).s === 404, "a deleted trip's family can't be edited");
ok((await fetch(B + "/receipts/" + up.key, { headers: { cookie } })).status === 404, "a deleted trip's receipts aren't served");
await call(`/tournaments/${t}/restore`, "POST");
// finalize still works, and every expense nobody shares blocks it
await call(`/tournaments/${t}/treasurer`, "PUT", { treasurer_name: "T", treasurer_family_id: A });
const fin = await call(`/tournaments/${t}/finalize`, "POST");
ok(fin.s === 200, `finalize works after all that (${fin.s} ${fin.d?.error || ""})`);
trip = (await call(`/tournaments/${t}`)).d;
const { rows } = balances(trip.expenses, trip.families);
ok(Object.values(rows).reduce((x, r) => x + r.net, 0) === 0, "balances net to zero");
