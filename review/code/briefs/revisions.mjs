import { stamp } from "./stamp.mjs";
const B = "http://127.0.0.1:8817/api";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
const cookie = r0.headers.get("set-cookie").split(";")[0];
const call = async (p, m = "GET", b) => { b = await stamp(B, cookie, p, m, b); const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", "content-type": "application/json" }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const get = async t => (await call(`/tournaments/${t}`)).d;
// EFC-01: an editor left open can't save over a newer correction
const t = (await call("/tournaments", "POST", { name: "Revisions", start_date: "2027-10-02", end_date: "2027-10-03" })).d.id;
const A = (await call(`/tournaments/${t}/families`, "POST", { name: "Adams" })).d.id;
await call(`/families/${A}/people`, "POST", { name: "Ava", is_fencer: true });
const ex = { description: "Dinner", category: "meal", basis: "person", amount_cents: 6000, paid_by: A, split: {} };
const e = (await call(`/tournaments/${t}/expenses`, "POST", ex)).d.id;
const opened = (await get(t)).expenses.find(x => x.id === e);           // parent B opens it
ok((await call(`/expenses/${e}`, "PATCH", { ...ex, amount_cents: 8000 })).s === 200, "parent A corrects the amount to $80");
ok((await call(`/expenses/${e}`, "PATCH", { ...ex, description: "Team dinner", rev: opened.rev, created_at: opened.created_at })).s === 409, "parent B's editor, opened before that, is refused");
ok((await get(t)).expenses.find(x => x.id === e).amount_cents === 8000, "the $80 correction stands");
ok((await call(`/expenses/${e}`, "DELETE", { rev: opened.rev, created_at: opened.created_at })).s === 409, "a stale editor can't delete it either");
// EFC-03: a reused person or family id can't be edited from an old screen
const t2 = (await call("/tournaments", "POST", { name: "Reuse", start_date: "2027-10-09", end_date: "2027-10-10" })).d.id;
const F = (await call(`/tournaments/${t2}/families`, "POST", { name: "Fox" })).d.id;
const alex = (await call(`/families/${F}/people`, "POST", { name: "Alex", is_fencer: true })).d.id;
const alexUid = (await get(t2)).families[0].people.find(p => p.id === alex).uid;
ok((await call(`/people/${alex}`, "DELETE")).s === 200, "Alex is removed");
const G = (await call(`/tournaments/${t2}/families`, "POST", { name: "Gray" })).d.id;
const sam = (await call(`/families/${G}/people`, "POST", { name: "Sam", is_fencer: true })).d.id;
console.log(`  (Sam got id ${sam}; Alex had ${alex}: ${sam === alex ? "reused" : "not reused"})`);
ok((await call(`/people/${sam}`, "PATCH", { is_fencer: false, uid: alexUid })).s === 409, "the old screen's untick of Alex doesn't reach Sam");
ok((await get(t2)).families.flatMap(f => f.people).find(p => p.id === sam).is_fencer === true, "Sam is still a fencer");
const gUid = (await get(t2)).families.find(f => f.id === G).uid;
ok((await call(`/families/${G}`, "PATCH", { pay_notes: "Venmo @gray" })).s === 200, "the right screen still saves");
ok((await call(`/families/${G}`, "PATCH", { pay_notes: "Old account", uid: "0000000000000000" })).s === 409 && (await get(t2)).families.find(f => f.id === G).pay_notes === "Venmo @gray", "a screen naming another family's tag is refused");
