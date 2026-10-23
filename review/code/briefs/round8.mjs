import { stamp } from "./stamp.mjs";
const B = "http://127.0.0.1:8817/api";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
const cookie = r0.headers.get("set-cookie").split(";")[0];
const raw = async (p, m = "GET", b) => { const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", "content-type": "application/json" }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const call = async (p, m = "GET", b) => raw(p, m, await stamp(B, cookie, p, m, b));
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const get = async t => (await call(`/tournaments/${t}`)).d;
const D = ["2027-11-06", "2027-11-07", "2027-11-08", "2027-11-09"];
const t = (await call("/tournaments", "POST", { name: "R8", start_date: D[0], end_date: D[2] })).d.id;
const A = (await call(`/tournaments/${t}/families`, "POST", { name: "Adams" })).d.id;
const kid = (await call(`/families/${A}/people`, "POST", { name: "Ava", is_fencer: true })).d.id;
// 1. removing a family is a new revision of every expense whose split it was in
const Bf = (await call(`/tournaments/${t}/families`, "POST", { name: "Brooks" })).d.id;
const e = (await call(`/tournaments/${t}/expenses`, "POST", { description: "Dinner", category: "meal", basis: "person", amount_cents: 6000, paid_by: A, split: { [Bf]: 3 } })).d.id;
const before = (await get(t)).expenses.find(x => x.id === e);
await call(`/families/${Bf}`, "DELETE");
ok((await get(t)).expenses.find(x => x.id === e).rev === before.rev + 1, "removing a family bumps the revision of an expense that listed it");
const N = (await call(`/tournaments/${t}/families`, "POST", { name: "Nash" })).d.id;
console.log(`  (Nash got id ${N}; Brooks had ${Bf}: ${N === Bf ? "reused" : "not reused"})`);
ok((await raw(`/expenses/${e}`, "PATCH", { description: "Dinner", category: "meal", basis: "person", amount_cents: 6000, paid_by: A, split: { [Bf]: 3 }, rev: before.rev, created_at: before.created_at })).s === 409, "an editor opened before the removal can't hand Brooks's 3 shares to Nash");
ok(!(String(N) in (await get(t)).expenses.find(x => x.id === e).split), "Nash is on automatic for that expense, not 3 shares");
await call(`/families/${N}`, "DELETE");
// 2. a trip-details form opened before the dates changed can't put the old ones back
await call(`/tournaments/${t}`, "PATCH", { end_date: D[3] });
await call(`/families/${A}`, "PATCH", { day: D[3], on: true });
ok((await raw(`/tournaments/${t}`, "PATCH", { name: "R8 renamed", start_date: D[0], end_date: D[2], seen_start: D[0], seen_end: D[2] })).s === 409, "a stale trip-details form is refused");
const tr = await get(t);
ok(tr.tournament.end_date === D[3] && tr.families.find(f => f.id === A).days.includes(D[3]), "the new end date and the ticks on it stand");
ok((await call(`/tournaments/${t}`, "PATCH", { name: "R8 renamed" })).s === 200, "renaming alone still works");
// 3. a retried save after a lost reply
const key = crypto.randomUUID(), ex = { description: "Lunch", category: "meal", basis: "person", amount_cents: 2000, paid_by: A, split: {}, client_key: key };
const n1 = (await call(`/tournaments/${t}/expenses`, "POST", ex)).d.id, n2 = (await call(`/tournaments/${t}/expenses`, "POST", ex));
ok(n2.d.id === n1 && (await get(t)).expenses.filter(x => x.description === "Lunch").length === 1, "the same new expense sent twice is saved once");
const l = (await get(t)).expenses.find(x => x.id === n1), edit = { ...ex, client_key: undefined, amount_cents: 2500, rev: l.rev, created_at: l.created_at };
ok((await raw(`/expenses/${n1}`, "PATCH", edit)).s === 200 && (await raw(`/expenses/${n1}`, "PATCH", edit)).s === 200, "the same edit sent twice is accepted both times");
ok((await raw(`/expenses/${n1}`, "PATCH", { ...edit, amount_cents: 3000 })).s === 409, "a different edit from that old revision is still refused");
// 4. unticking and re-ticking Fencer keeps the days that were picked
await call(`/people/${kid}`, "PATCH", { fencing_day: D[1], on: false });
const picked = (await get(t)).families.find(f => f.id === A).people[0].fencing_days.join();
await call(`/people/${kid}`, "PATCH", { is_fencer: false }); await call(`/people/${kid}`, "PATCH", { is_fencer: true });
ok((await get(t)).families.find(f => f.id === A).people[0].fencing_days.join() === picked, `re-ticking Fencer brings back the days picked (${picked})`);
// 5. reopen won't clear ticks this screen didn't see
await call(`/tournaments/${t}/treasurer`, "PUT", { treasurer_name: "T", treasurer_family_id: A });
const C = (await call(`/tournaments/${t}/families`, "POST", { name: "Cole" })).d.id; await call(`/families/${C}/people`, "POST", { name: "c" });
ok((await call(`/tournaments/${t}/finalize`, "POST")).s === 200, "finalize");
const pay = (await get(t)).payments[0]; await call(`/payments/${pay.id}`, "PATCH", { paid: true, family_id: pay.family_id, direction: pay.direction, amount_cents: pay.amount_cents });
ok((await raw(`/tournaments/${t}/reopen`, "POST", { ticked: 0 })).s === 409, "a reopen that saw no ticks is refused when one exists");
ok((await call(`/tournaments/${t}/reopen`, "POST")).s === 200, "a reopen that saw it goes ahead");
