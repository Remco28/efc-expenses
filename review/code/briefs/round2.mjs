import { stamp } from "./stamp.mjs";
import { balances } from "/home/frank/Dev/efc-expenses/public/split.js";
const B = "http://127.0.0.1:8817/api"; let cookie = "";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
cookie = r0.headers.get("set-cookie").split(";")[0];
const call = async (p, m = "GET", b) => { b = await stamp(B, cookie, p, m, b); const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", "content-type": "application/json" }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const D = ["2027-06-01", "2027-06-02", "2027-06-03"];
ok((await call("/tournaments", "POST", { name: "Bad", start_date: "2026-13-45", end_date: "2026-13-46" })).s === 400, "impossible dates are rejected");
ok((await call("/tournaments", "POST", { name: "Long", start_date: "2027-01-01", end_date: "2037-01-01" })).s === 400, "a 10-year trip is rejected");
const t = (await call("/tournaments", "POST", { name: "R2", start_date: D[0], end_date: D[2] })).d.id;
const A = (await call(`/tournaments/${t}/families`, "POST", { name: "A" })).d.id, Bf = (await call(`/tournaments/${t}/families`, "POST", { name: "B" })).d.id;
const coach = (await call(`/tournaments/${t}/families`, "POST", { name: "Mike", kind: "staff", role: "Coach" })).d.id;
await call(`/families/${A}/people`, "POST", { name: "a", is_fencer: true }); await call(`/families/${Bf}/people`, "POST", { name: "b", is_fencer: false });
await call(`/tournaments/${t}/expenses`, "POST", { description: "Dinner", category: "meal", basis: "person", amount_cents: 6000, paid_by: Bf, date: D[0], split: {} });
ok((await call(`/tournaments/${t}/treasurer`, "PUT", { treasurer_name: "Mike", treasurer_family_id: coach })).s === 400, "a coach can't be the treasurer's family");
// one change at a time; a stale whole-list save can't undo another phone's change
let trip = (await call(`/tournaments/${t}`)).d;
const pa = trip.families.find(f => f.id === A).people[0];
await call(`/people/${pa.id}`, "PATCH", { fencing_days: D });          // a new fencer starts with none
await call(`/people/${pa.id}`, "PATCH", { fencing_day: D[0], on: false });
trip = (await call(`/tournaments/${t}`)).d;
ok(trip.families.find(f => f.id === A).people[0].fencing_days.join() === [D[1], D[2]].join(), "a single fencing-day tap removes just that day");
// payments only on a final trip
await call(`/tournaments/${t}/treasurer`, "PUT", { treasurer_name: "T", treasurer_family_id: A });
// two finalizes at once: one wins, the other is told; payments intact
const [f1, f2] = await Promise.all([call(`/tournaments/${t}/finalize`, "POST"), call(`/tournaments/${t}/finalize`, "POST")]);
trip = (await call(`/tournaments/${t}`)).d;
ok([f1.s, f2.s].sort().join() === "200,409" && trip.tournament.status === "final" && trip.payments.length > 0, `two finalizes at once: one wins (${f1.s}, ${f2.s}), payments kept (${trip.payments.length})`);
ok((await call(`/tournaments/${t}/expenses`, "POST", { description: "Late", category: "meal", basis: "person", amount_cents: 100, paid_by: A, split: {} })).s === 409, "no expense can be added to a final trip");
await call(`/tournaments/${t}/reopen`, "POST");
const pay = (await call(`/tournaments/${t}`)).d;
ok(pay.payments.length === 0, "reopen clears payments");
// two practice-trip resets at once leave exactly one copy of the seed
await Promise.all([call("/tournaments/50/reset-sandbox", "POST"), call("/tournaments/50/reset-sandbox", "POST")]);
const sb = (await call("/tournaments/50")).d;
ok(sb.families.length === 4 && sb.expenses.length === 5 && sb.expenses.filter(e => e.receipt_key).length === 1, `two resets at once: ${sb.families.length} families, ${sb.expenses.length} expenses`);
const rows = balances(sb.expenses, sb.families).rows;
ok(Object.values(rows).reduce((s, r) => s + r.net, 0) === 0, "practice trip still nets to zero");
