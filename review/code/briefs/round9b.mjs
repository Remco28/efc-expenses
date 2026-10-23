// Round 9 follow-up (the peer-agent trial): corrected retries fix the first add instead of making a second
import { stamp } from "./stamp.mjs";
const B = "http://127.0.0.1:8817/api";
const r0 = await fetch(B + "/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "fence-local-test" }) });
const cookie = r0.headers.get("set-cookie").split(";")[0];
const raw = async (p, m = "GET", b) => { const r = await fetch(B + p, { method: m, headers: { cookie, "x-user-name": "T", "content-type": "application/json" }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json().catch(() => null) }; };
const call = async (p, m = "GET", b) => raw(p, m, await stamp(B, cookie, p, m, b));
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const get = async t => (await call(`/tournaments/${t}`)).d;
const D = ["2028-01-08", "2028-01-09"];
// trips: a corrected retry fixes the trip while it has no families
const tk = crypto.randomUUID();
const t = (await call("/tournaments", "POST", { name: "Winter Opne", start_date: D[0], end_date: D[1], client_key: tk })).d.id;
ok((await call("/tournaments", "POST", { name: "Winter Open", start_date: D[0], end_date: D[1], client_key: tk })).d.id === t && (await get(t)).tournament.name === "Winter Open", "a trip's typo, retried with the same key, is fixed in place");
// families
const fk = crypto.randomUUID(), F = (await call(`/tournaments/${t}/families`, "POST", { name: "Smth", client_key: fk })).d.id;
ok((await call(`/tournaments/${t}/families`, "POST", { name: "Smith", client_key: fk })).d.id === F && (await get(t)).families.map(f => f.name).join() === "Smith", "a family's typo, retried, is fixed in place (one family)");
ok((await call("/tournaments", "POST", { name: "Winter Open 2", start_date: D[0], end_date: D[1], client_key: tk })).s === 409 && (await get(t)).tournament.name === "Winter Open", "once a family is on the trip, a corrected trip retry is refused");
// people
const pk = crypto.randomUUID(), av = (await call(`/families/${F}/people`, "POST", { name: "Av", is_fencer: false, client_key: pk })).d.id;
ok((await call(`/families/${F}/people`, "POST", { name: "Ava", is_fencer: true, client_key: pk })).d.id === av, "\"Av\" retried as \"Ava\", fencer ticked, reaches the same person");
let p = (await get(t)).families[0].people;
ok(p.length === 1 && p[0].name === "Ava" && p[0].is_fencer && p[0].fencing_days.length === 2, "one person, now Ava, a fencer fencing both days");
await call(`/people/${av}`, "PATCH", { name: "Ava Smith" });
ok((await call(`/families/${F}/people`, "POST", { name: "Avah", is_fencer: true, client_key: pk })).s === 409 && (await get(t)).families[0].people[0].name === "Ava Smith", "a retry after someone else edited the person is refused, and their edit stands");
ok((await call(`/families/${F}/people`, "POST", { name: "Ava Smith", is_fencer: true, client_key: pk })).s === 409, "even when it happens to match");
