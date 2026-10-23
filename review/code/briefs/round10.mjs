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
