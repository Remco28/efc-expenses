import { BASES, CATEGORIES, tournamentDays, autoUnits, defaultSplit, shares, balances, unsplit, settle, money } from "./split.js";

const app = document.getElementById("app");
const S = { name: load("efc-name"), list: null, trip: null, draft: null, personEdit: null, adding: null };

// ---------- small helpers ----------
function load(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch {} }
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dayLabel = (iso, long) => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z"), wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return long ? `${wd}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : `${wd} ${d.getUTCDate()}`;
};
const range = t => {
  const a = new Date(t.start_date + "T12:00:00Z"), b = new Date(t.end_date + "T12:00:00Z");
  const o = { month: "short", day: "numeric", timeZone: "UTC" };
  return t.start_date === t.end_date ? a.toLocaleDateString("en-US", { ...o, year: "numeric" })
    : `${a.toLocaleDateString("en-US", o)} – ${b.toLocaleDateString("en-US", { ...o, year: "numeric" })}`;
};
const famName = id => S.trip?.families.find(f => f.id === Number(id))?.name || "?";
const final = () => S.trip?.tournament.status === "final";

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

class AuthError extends Error {}
async function api(path, opts = {}) {
  const headers = { "x-user-name": encodeURIComponent(S.name || ""), ...(opts.headers || {}) };
  let body = opts.body;
  if (body && !(body instanceof Blob)) { headers["content-type"] = "application/json"; body = JSON.stringify(body); }
  const res = await fetch("/api" + path, { method: opts.method || "GET", headers, body, credentials: "same-origin" });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (res.status === 401 && path !== "/login") throw new AuthError();
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { if (e instanceof AuthError) return renderLogin(); toast(e.message); throw e; }
}

// ---------- routing ----------
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.draft) route(); });

async function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  const q = new URLSearchParams(query || "");
  if (!S.name) return renderName();
  try {
    if (parts[0] === "t" && parts[1]) {
      await loadTrip(Number(parts[1]));
      if (parts[2] === "e") return renderEditor(parts[3] === "new" ? null : Number(parts[3]));
      S.draft = null;
      return renderTrip(q.get("tab") || "expenses");
    }
    S.draft = null;
    S.list = await api("/tournaments");
    renderHome();
  } catch (e) {
    if (e instanceof AuthError) return renderLogin();
    app.innerHTML = `<p class="empty">${esc(e.message)}<br><a href="#/">Back to all trips</a></p>`;
  }
}

async function loadTrip(id) { S.trip = await api(`/tournaments/${id}`); }
async function refresh(tab) { await loadTrip(S.trip.tournament.id); renderTrip(tab); }

// ---------- sign-in ----------
function renderLogin() {
  app.innerHTML = `
    <header class="top"><div class="grow"><h1>EFC Trip Expenses</h1></div></header>
    <form class="card" id="login">
      <p>Enter the access code the trip organizers shared with the team.</p>
      <label class="f" for="code">Access code</label>
      <input id="code" type="password" autocomplete="current-password" required>
      <div class="actions"><button>Continue</button></div>
    </form>`;
  document.getElementById("login").onsubmit = async ev => {
    ev.preventDefault();
    try { await api("/login", { method: "POST", body: { code: document.getElementById("code").value } }); route(); }
    catch (e) { toast(e.message); }
  };
}

function renderName() {
  app.innerHTML = `
    <header class="top"><div class="grow"><h1>EFC Trip Expenses</h1></div></header>
    <form class="card" id="nm">
      <p>What's your name? It's shown next to anything you add or change, so other parents know who to ask.</p>
      <label class="f" for="name">Your name</label>
      <input id="name" autocomplete="name" placeholder="e.g. Frank (Chen family)" value="${esc(S.name)}" required>
      <div class="actions"><button>Continue</button></div>
    </form>`;
  document.getElementById("nm").onsubmit = ev => {
    ev.preventDefault();
    S.name = document.getElementById("name").value.trim();
    if (!S.name) return;
    save("efc-name", S.name);
    route();
  };
}

// ---------- home: all trips ----------
function renderHome() {
  const cards = S.list.map(t => `
    <a class="card" href="#/t/${t.id}">
      <div class="row between"><strong>${esc(t.name)}</strong><span class="chip ${t.status}">${t.status === "final" ? "Final" : "Open"}</span></div>
      <div class="muted small">${esc(range(t))}${t.location ? " · " + esc(t.location) : ""}</div>
      <div class="faint small">${t.family_count} families · ${t.expense_count} expenses · <span class="num">${money(t.total_cents)}</span></div>
    </a>`).join("");
  app.innerHTML = `
    <header class="top"><div class="grow"><h1>EFC Trip Expenses</h1>
      <div class="sub">Signed in as ${esc(S.name)} · <button class="link" data-act="rename">change</button></div></div></header>
    ${S.list.length ? cards : `<p class="empty">No trips yet. Add the first one below.</p>`}
    <details class="card" ${S.list.length ? "" : "open"}><summary>New trip</summary>
      <form id="newtrip">
        <label class="f" for="tn">Tournament</label><input id="tn" placeholder="e.g. Summer Nationals" required>
        <label class="f" for="tl">Where</label><input id="tl" placeholder="City, state">
        <div class="two"><div><label class="f" for="ts">First day</label><input id="ts" type="date" required></div>
          <div><label class="f" for="te">Last day</label><input id="te" type="date" required></div></div>
        <div class="actions"><button>Create trip</button></div>
      </form></details>`;
  const ts = document.getElementById("ts"), te = document.getElementById("te");
  ts.onchange = () => { if (!te.value || te.value < ts.value) te.value = ts.value; };
  document.getElementById("newtrip").onsubmit = async ev => {
    ev.preventDefault();
    const r = await act(() => api("/tournaments", { method: "POST", body: {
      name: document.getElementById("tn").value, location: document.getElementById("tl").value, start_date: ts.value, end_date: te.value } }));
    location.hash = `#/t/${r.id}?tab=families`;
  };
}

// ---------- one trip ----------
function renderTrip(tab) {
  const { tournament: t } = S.trip;
  const tabs = [["expenses", "Expenses"], ["families", "Families"], ["settle", "Settle up"]]
    .map(([k, l]) => `<a href="#/t/${t.id}?tab=${k}" class="${k === tab ? "on" : ""}">${l}</a>`).join("");
  app.innerHTML = `
    <header class="top"><a class="back" href="#/" aria-label="All trips">‹</a>
      <div class="grow"><h1>${esc(t.name)}</h1><div class="sub">${esc(range(t))}${t.location ? " · " + esc(t.location) : ""}</div></div>
      <span class="chip ${t.status}">${t.status === "final" ? "Final" : "Open"}</span></header>
    <nav class="tabs">${tabs}</nav>
    ${final() ? `<div class="callout good" style="margin-bottom:12px">Finalized by ${esc(t.finalized_by)} on ${new Date(t.finalized_at).toLocaleDateString()}. Reopen it from Settle up to make changes.</div>` : ""}
    <div id="tab"></div>`;
  ({ expenses: tabExpenses, families: tabFamilies, settle: tabSettle })[tab]?.(document.getElementById("tab"));
}

function tabExpenses(el) {
  const { tournament: t, families, expenses } = S.trip;
  const { perExpense } = balances(expenses, families);
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const bad = new Set(unsplit(expenses, families).map(e => e.id));
  if (!families.length) {
    el.innerHTML = `<p class="empty">Add the families on this trip first.<br><br><a class="btn" href="#/t/${t.id}?tab=families">Add families</a></p>`;
    return;
  }
  const groups = new Map();
  for (const e of expenses) { const k = e.date || ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  const rows = [...groups.entries()].map(([d, list]) => `
    <div class="daylbl">${d ? esc(dayLabel(d, true)) : "Whole trip"}</div>
    ${list.map(e => { const s = perExpense[e.id]; return `
      <a class="xrow" href="#/t/${t.id}/e/${e.id}">
        <div class="grow"><div class="what">${esc(e.description)}</div>
          <div class="meta">${esc(famName(e.paid_by))} paid · ${BASES[e.basis].label} · ${s.total} ${s.total === 1 ? BASES[e.basis].unit : BASES[e.basis].units}
            ${e.receipt_key ? "" : ` · <span class="chip warn">no receipt</span>`}${bad.has(e.id) ? ` · <span class="chip warn">nobody included</span>` : ""}</div></div>
        <div class="amt">${money(e.amount_cents)}</div></a>`; }).join("")}`).join("");
  el.innerHTML = `
    <div class="card"><div class="total-line"><span>${expenses.length} shared expense${expenses.length === 1 ? "" : "s"}</span><span class="num">${money(total)}</span></div>
      ${expenses.length ? rows : `<p class="empty">Nothing yet. Whoever pays for something shared adds it here, with a photo of the receipt.</p>`}</div>
    <p class="hint">Shared costs only: team meals, the coach's travel and stay, transport, supplies. Your own flight and room stay off this list, and so do coaching fees.</p>
    ${final() ? "" : `<a class="btn block fab" href="#/t/${t.id}/e/new">+ Add expense</a>`}`;
}

// ---------- families & people ----------
function tabFamilies(el) {
  const { tournament: t, families } = S.trip;
  const days = tournamentDays(t.start_date, t.end_date);
  const ro = final();
  const personRow = p => {
    if (S.personEdit === p.id && !ro) return personForm(p, days);
    const fencing = p.is_fencer ? (p.fencing_days.length ? `fences ${p.fencing_days.map(d => dayLabel(d)).join(", ")}` : `<span class="chip warn">no fencing days</span>`) : "";
    const here = p.days.length === days.length ? "whole trip" : p.days.length ? p.days.map(d => dayLabel(d)).join(", ") : "no days ticked";
    return `<div class="person"><div class="who"><strong>${esc(p.name)}</strong>${p.is_fencer ? `<span class="chip fencer">Fencer</span>` : ""}
      ${ro ? "" : `<button class="link" data-act="edit-person" data-id="${p.id}">Edit</button>`}</div>
      <div class="when">There: ${esc(here)}${fencing ? " · " + fencing : ""}</div></div>`;
  };
  const famCard = f => `
    <div class="card">
      <div class="row between"><strong style="font-size:17px">${esc(f.name)}</strong>
        ${ro ? "" : `<span><button class="link" data-act="rename-family" data-id="${f.id}">Rename</button> · <button class="link danger" data-act="del-family" data-id="${f.id}">Remove</button></span>`}</div>
      <div class="faint small">${f.people.length} going · ${f.people.filter(p => p.is_fencer).length} fencing</div>
      ${f.people.map(personRow).join("")}
      ${S.adding === f.id ? personForm({ id: 0, family_id: f.id, name: "", is_fencer: true, days: [...days], fencing_days: [] }, days)
        : ro ? "" : `<div class="person"><button class="link" data-act="add-person" data-id="${f.id}">+ Add person</button></div>`}
    </div>`;
  el.innerHTML = `
    ${families.map(famCard).join("") || `<p class="empty">No families yet.</p>`}
    ${ro ? "" : `<form class="card" id="addfam"><label class="f" for="fname" style="margin-top:0">Add a family</label>
      <div class="row"><input id="fname" placeholder="Family name, e.g. Okafor" required><button>Add</button></div></form>`}
    ${ro ? "" : `<details class="card"><summary>Trip details</summary>
      <form id="tripedit">
        <label class="f" for="en">Tournament</label><input id="en" value="${esc(t.name)}" required>
        <label class="f" for="el">Where</label><input id="el" value="${esc(t.location)}">
        <div class="two"><div><label class="f" for="es">First day</label><input id="es" type="date" value="${t.start_date}" required></div>
          <div><label class="f" for="ee">Last day</label><input id="ee" type="date" value="${t.end_date}" required></div></div>
        <p class="hint">Shortening the trip drops days outside it from everyone's attendance.</p>
        <div class="actions"><button>Save details</button>${S.trip.expenses.length ? "" : `<button type="button" class="danger" data-act="del-trip">Delete trip</button>`}</div>
      </form></details>`}`;

  const af = document.getElementById("addfam");
  if (af) af.onsubmit = async ev => {
    ev.preventDefault();
    const r = await act(() => api(`/tournaments/${t.id}/families`, { method: "POST", body: { name: document.getElementById("fname").value } }));
    S.adding = r.id; // open "add person" on the new family straight away
    refresh("families");
  };
  const te = document.getElementById("tripedit");
  if (te) te.onsubmit = async ev => {
    ev.preventDefault();
    await act(() => api(`/tournaments/${t.id}`, { method: "PATCH", body: {
      name: document.getElementById("en").value, location: document.getElementById("el").value,
      start_date: document.getElementById("es").value, end_date: document.getElementById("ee").value } }), "Saved");
    refresh("families");
  };
  wirePersonForm(el, t);
}

function personForm(p, days) {
  const dayBtns = (list, kind) => days.map(d => `<button type="button" class="${list.includes(d) ? "on" : ""}" data-day="${d}" data-kind="${kind}">${esc(dayLabel(d))}</button>`).join("");
  return `<form class="person pform" data-id="${p.id}" data-family="${p.family_id}">
    <label class="f" style="margin-top:4px">Name</label><input name="name" value="${esc(p.name)}" placeholder="First name" required>
    <label class="row" style="margin:12px 0 0;gap:8px"><input type="checkbox" name="fencer" ${p.is_fencer ? "checked" : ""}> Competing at this tournament</label>
    <label class="f">Days at the trip</label><div class="days" data-list="days">${dayBtns(p.days, "days")}</div>
    <div class="fencebox" ${p.is_fencer ? "" : "hidden"}><label class="f">Days fencing</label><div class="days fence" data-list="fencing">${dayBtns(p.fencing_days, "fencing")}</div>
      <p class="hint">Only the days they compete. These decide their share of the coach's hotel and meals.</p></div>
    <div class="actions"><button>${p.id ? "Save" : "Add"}</button><button type="button" class="ghost" data-act="cancel-person">Cancel</button>
      ${p.id ? `<button type="button" class="danger" data-act="del-person" data-id="${p.id}">Remove</button>` : ""}</div>
  </form>`;
}

function wirePersonForm(el, t) {
  el.querySelectorAll("form.pform").forEach(form => {
    form.querySelector("[name=fencer]").onchange = ev => { form.querySelector(".fencebox").hidden = !ev.target.checked; };
    form.querySelectorAll(".days button").forEach(b => b.onclick = () => b.classList.toggle("on"));
    form.querySelector("[name=name]").focus();
    form.onsubmit = async ev => {
      ev.preventDefault();
      const pick = list => [...form.querySelectorAll(`[data-list=${list}] button.on`)].map(b => b.dataset.day);
      const body = { name: form.name.value, is_fencer: form.fencer.checked, days: pick("days"), fencing_days: pick("fencing") };
      const id = Number(form.dataset.id);
      await act(() => id ? api(`/people/${id}`, { method: "PATCH", body }) : api(`/families/${form.dataset.family}/people`, { method: "POST", body }));
      S.personEdit = null;
      if (!id) S.adding = Number(form.dataset.family); // ready for the next one in this family
      refresh("families");
    };
  });
}

// ---------- expense editor ----------
function renderEditor(id) {
  const { tournament: t, families, expenses } = S.trip;
  if (final()) { location.hash = `#/t/${t.id}`; return; }
  const e = id ? expenses.find(x => x.id === id) : null;
  if (id && !e) { location.hash = `#/t/${t.id}`; return; }
  if (!S.draft || S.draft.id !== (id || 0)) {
    const mine = families.find(f => S.name.toLowerCase().includes(f.name.toLowerCase()));
    S.draft = e ? { ...e, split: { ...e.split }, amount: (e.amount_cents / 100).toFixed(2), basisTouched: true }
      : { id: 0, description: "", vendor: "", date: null, category: "meal", basis: "person", amount: "", paid_by: mine?.id || "", split: {}, receipt_key: null, receipt_type: null, basisTouched: false };
    if (!e) S.draft.split = defaultSplit("person", families, null);
  }
  const d = S.draft;
  const days = tournamentDays(t.start_date, t.end_date);
  app.innerHTML = `
    <header class="top"><a class="back" href="#/t/${t.id}" aria-label="Back">‹</a>
      <div class="grow"><h1>${id ? "Edit expense" : "Add expense"}</h1><div class="sub">${esc(t.name)}</div></div></header>
    <form id="ex" class="card">
      <div id="rcpt"></div>
      <label class="f" for="amt">Amount</label><input id="amt" class="big" inputmode="decimal" placeholder="0.00" value="${esc(d.amount)}" required>
      <label class="f" for="desc">What was it</label><input id="desc" value="${esc(d.description)}" placeholder="e.g. Team lunch, Coach hotel 3 nights">
      <div class="two">
        <div><label class="f" for="paid">Paid by</label><select id="paid" required><option value="">Pick a family</option>
          ${families.map(f => `<option value="${f.id}" ${Number(d.paid_by) === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div>
        <div><label class="f" for="day">Day</label><select id="day"><option value="">Whole trip</option>
          ${days.map(x => `<option value="${x}" ${d.date === x ? "selected" : ""}>${esc(dayLabel(x, true))}</option>`).join("")}</select></div>
      </div>
      <label class="f" for="cat">Category</label><select id="cat">
        ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${d.category === k ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
      <label class="f" for="vend">Vendor</label><input id="vend" value="${esc(d.vendor)}" placeholder="Optional">
      <label class="f">Split</label>
      <div class="seg" id="basis">${Object.entries(BASES).map(([k, b]) => `<button type="button" data-basis="${k}" class="${d.basis === k ? "on" : ""}">${b.label}</button>`).join("")}</div>
      <div class="hint" id="basishint"></div>
      <label class="f">Who's included</label><div id="split"></div>
      <div class="actions"><button id="save">${id ? "Save changes" : "Save expense"}</button></div>
      ${id ? `<div class="actions"><button type="button" class="danger" data-act="del-expense" data-id="${id}">Delete expense</button></div>` : ""}
      ${e ? `<p class="hint">Added by ${esc(e.created_by)}${e.updated_by ? ` · last changed by ${esc(e.updated_by)}` : ""}</p>` : ""}
    </form>`;

  const $ = s => document.getElementById(s);
  const pull = () => { d.amount = $("amt").value; d.description = $("desc").value; d.vendor = $("vend").value; d.paid_by = $("paid").value; };
  ["amt", "desc", "vend", "paid"].forEach(k => $(k).addEventListener("input", () => { pull(); drawSplit(); }));
  $("day").onchange = () => { d.date = $("day").value || null; resetSplit(); };
  $("cat").onchange = () => {
    d.category = $("cat").value;
    if (!d.basisTouched) { d.basis = CATEGORIES[d.category].basis; markBasis(); resetSplit(); }
  };
  $("basis").onclick = ev => {
    const b = ev.target.closest("button[data-basis]"); if (!b) return;
    d.basis = b.dataset.basis; d.basisTouched = true; markBasis(); resetSplit();
  };
  function markBasis() { $("basis").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.basis === d.basis)); }
  function resetSplit() { d.split = defaultSplit(d.basis, families, d.date); drawSplit(); }
  $("ex").onsubmit = async ev => { ev.preventDefault(); pull(); await saveExpense(); };
  drawReceipt();
  drawSplit();
}

const BASIS_HINTS = {
  person: "Everyone who was there counts as one: fencers, parents, siblings. Change a count if someone skipped it.",
  fencer: "One share per fencer at the tournament, however many days they fence. Use for getting the coach there and back.",
  fencer_day: "One share per day each fencer competes. Use for the coach's hotel, meals and car.",
  family: "One equal share per family that used it.",
  custom: "Type each family's number of shares.",
};

function cents(v) { const n = Math.round(parseFloat(String(v).replace(/[$,\s]/g, "")) * 100); return Number.isFinite(n) ? n : 0; }

function drawSplit() {
  const d = S.draft, { families } = S.trip;
  const el = document.getElementById("split"); if (!el) return;
  document.getElementById("basishint").textContent = BASIS_HINTS[d.basis];
  const amount = cents(d.amount);
  const s = shares({ ...d, amount_cents: amount }, families);
  el.innerHTML = `<div class="incl">${families.map(f => {
    const inc = String(f.id) in d.split, set = d.split[f.id], auto = autoUnits(d.basis, f, d.date);
    const n = s.units[f.id] || 0;
    return `<div class="r ${inc && n ? "" : "off"}"><input type="checkbox" data-fam="${f.id}" ${inc ? "checked" : ""} aria-label="Include ${esc(f.name)}">
      <span class="nm">${esc(f.name)}</span>
      <input type="number" min="0" step="1" inputmode="numeric" data-units="${f.id}" value="${set ?? ""}" placeholder="${d.basis === "custom" ? "0" : auto}" ${inc ? "" : "disabled"} aria-label="${esc(BASES[d.basis].units)} for ${esc(f.name)}">
      <span class="amt">${inc && n && amount ? money(s.shares[f.id]) : "—"}</span></div>`;
  }).join("")}
    <div class="tot"><span>${s.total} ${s.total === 1 ? BASES[d.basis].unit : BASES[d.basis].units}${s.total && amount ? ` · ${money(Math.round(amount / s.total))} each` : ""}</span></div></div>
    ${d.basis === "custom" ? "" : `<p class="hint">Grey numbers are worked out from who's on the trip. Type over one to change it.</p>`}`;
  el.onchange = ev => {
    const c = ev.target.closest("[data-fam]");
    if (c) { if (c.checked) d.split[c.dataset.fam] = d.basis === "custom" ? 1 : null; else delete d.split[c.dataset.fam]; drawSplit(); }
  };
  el.oninput = ev => {
    const u = ev.target.closest("[data-units]"); if (!u) return;
    d.split[u.dataset.units] = u.value === "" ? null : Math.max(0, Number(u.value));
    const pos = u.selectionStart; drawSplit();
    const again = el.querySelector(`[data-units="${u.dataset.units}"]`); again.focus(); try { again.setSelectionRange(pos, pos); } catch {}
  };
}

function drawReceipt(state = "") {
  const d = S.draft, el = document.getElementById("rcpt"); if (!el) return;
  const t = S.trip.tournament;
  if (d.receipt_key) {
    const thumb = d.receipt_type === "application/pdf" ? `<div class="pdf">PDF</div>` : `<img src="/api/receipts/${d.receipt_key}" alt="Receipt">`;
    el.innerHTML = `<div class="receipt">${thumb}<div class="grow">
        <a href="/api/receipts/${d.receipt_key}" target="_blank" rel="noopener">View receipt</a><br>
        ${state === "reading" ? `<span class="muted small"><span class="spinner"></span> Reading the receipt…</span>` : `<button type="button" class="link danger" data-act="drop-receipt">Remove</button>`}
      </div></div>${d.aiNote ? `<div class="callout" style="margin-top:10px">${esc(d.aiNote)}</div>` : ""}`;
    return;
  }
  el.innerHTML = state === "uploading"
    ? `<p class="muted"><span class="spinner"></span> Uploading…</p>`
    : `<label class="btn ghost block" style="cursor:pointer">📷 Add receipt photo or PDF<input type="file" id="file" accept="image/*,application/pdf" hidden></label>
       <p class="hint">The receipt is read for you and the form filled in. Check it before saving. No receipt? Just fill in the form.</p>`;
  const input = document.getElementById("file");
  if (input) input.onchange = () => input.files[0] && uploadReceipt(input.files[0], t.id);
}

// Phone photos are big; shrink to about 1600px so upload, storage and the
// final PDF stay small. PDFs go up as they are.
async function shrink(file) {
  if (file.type === "application/pdf") return file;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Couldn't open that photo. Try a JPEG or a screenshot of it."); }
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
}

async function uploadReceipt(file, tid) {
  const d = S.draft;
  drawReceipt("uploading");
  try {
    if (file.size > 10 * 1024 * 1024 && file.type === "application/pdf") throw new Error("That PDF is over 10 MB");
    const blob = await shrink(file);
    const r = await api(`/tournaments/${tid}/receipts`, { method: "POST", body: blob, headers: { "content-type": blob.type } });
    d.receipt_key = r.key; d.receipt_type = r.type; d.aiNote = "";
    drawReceipt("reading");
    try {
      const f = await api(`/tournaments/${tid}/read-receipt`, { method: "POST", body: { key: r.key } });
      fillFromReceipt(f);
    } catch (e) {
      if (e instanceof AuthError) throw e;
      d.aiNote = e.message;
    }
  } catch (e) {
    if (e instanceof AuthError) return renderLogin();
    toast(e.message);
  }
  drawReceipt();
}

function fillFromReceipt(f) {
  const d = S.draft, $ = s => document.getElementById(s);
  const days = tournamentDays(S.trip.tournament.start_date, S.trip.tournament.end_date);
  if (f.total != null && !cents(d.amount)) { d.amount = f.total.toFixed(2); $("amt").value = d.amount; }
  if (f.description && !d.description) { d.description = f.description; $("desc").value = d.description; }
  if (f.vendor && !d.vendor) { d.vendor = f.vendor; $("vend").value = d.vendor; }
  if (f.category && CATEGORIES[f.category]) { d.category = f.category; $("cat").value = f.category; if (!d.basisTouched) d.basis = CATEGORIES[f.category].basis; }
  if (f.date && days.includes(f.date)) { d.date = f.date; $("day").value = f.date; }
  d.split = defaultSplit(d.basis, S.trip.families, d.date);
  document.querySelectorAll("#basis button").forEach(b => b.classList.toggle("on", b.dataset.basis === d.basis));
  const out = f.date && !days.includes(f.date) ? ` The receipt is dated ${f.date}, outside the trip.` : "";
  d.aiNote = `Filled in from the receipt. Check the amount and who was included.${out}${f.notes ? " Note: " + f.notes : ""}`;
  drawSplit();
}

async function saveExpense() {
  const d = S.draft, t = S.trip.tournament;
  const amount_cents = cents(d.amount);
  if (amount_cents <= 0) return toast("Enter the amount");
  if (!d.paid_by) return toast("Pick the family that paid");
  const s = shares({ ...d, amount_cents }, S.trip.families);
  if (!s.total) return toast("Include at least one family");
  const body = { description: d.description, vendor: d.vendor, date: d.date, category: d.category, basis: d.basis,
    amount_cents, paid_by: Number(d.paid_by), split: d.split, receipt_key: d.receipt_key, receipt_type: d.receipt_type };
  await act(() => d.id ? api(`/expenses/${d.id}`, { method: "PATCH", body }) : api(`/tournaments/${t.id}/expenses`, { method: "POST", body }), "Saved");
  S.draft = null;
  location.hash = `#/t/${t.id}`;
}

// ---------- settle up ----------
function tabSettle(el) {
  const { tournament: t, families, expenses, transfers, activity } = S.trip;
  const { rows, perExpense } = balances(expenses, families);
  const bad = unsplit(expenses, families);
  const noFence = families.flatMap(f => f.people.filter(p => p.is_fencer && !p.fencing_days.length));
  const preview = settle(rows);
  const list = final() ? transfers : preview;
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const famRows = families.map(f => {
    const r = rows[f.id];
    return `<tr><td>${esc(f.name)}</td><td class="n">${money(r.owed)}</td><td class="n">${money(r.paid)}</td>
      <td class="n ${r.net > 0 ? "get" : r.net < 0 ? "owe" : ""}"><strong>${r.net > 0 ? "+" : ""}${money(r.net)}</strong></td></tr>`;
  }).join("");
  const xfers = list.length ? list.map(x => `
    <div class="xfer ${x.paid_at ? "paid" : ""}" style="padding:10px 0;border-bottom:1px solid var(--line)">
      <div><strong>${esc(famName(x.from_family))} → ${esc(famName(x.to_family))}</strong>
        <div class="small ${x.paid_at ? "get" : "faint"}">${x.paid_at ? `✓ Paid · marked by ${esc(x.paid_marked_by)} ${new Date(x.paid_at).toLocaleDateString()}` : final() ? "Not paid yet" : "Preview"}</div></div>
      <div style="text-align:right"><div class="amt">${money(x.amount_cents)}</div>
        ${final() ? `<button class="link" data-act="toggle-paid" data-id="${x.id}" data-paid="${x.paid_at ? 0 : 1}">${x.paid_at ? "Undo" : "Mark paid"}</button>` : ""}</div>
    </div>`).join("") : `<p class="faint">Nobody owes anybody.</p>`;
  const statement = f => {
    const lines = expenses.filter(e => perExpense[e.id].shares[f.id]).map(e => {
      const s = perExpense[e.id];
      return `<tr><td>${esc(e.description)}<div class="faint small">${s.units[f.id]} of ${s.total} ${BASES[e.basis].units}</div></td><td class="n">${money(s.shares[f.id])}</td></tr>`;
    }).join("");
    const r = rows[f.id];
    return `<details><summary>${esc(f.name)}</summary><table class="t">${lines || `<tr><td class="faint">Not included in anything</td><td></td></tr>`}
      <tr><td>Share</td><td class="n">${money(r.owed)}</td></tr><tr><td>Paid</td><td class="n">${money(r.paid)}</td></tr>
      <tr><td><strong>${r.net < 0 ? "Owes" : "Is owed"}</strong></td><td class="n"><strong>${money(Math.abs(r.net))}</strong></td></tr></table></details>`;
  };
  el.innerHTML = `
    ${bad.length ? `<div class="callout warn" style="margin-bottom:10px">${bad.length} expense${bad.length > 1 ? "s have" : " has"} nobody included: ${bad.map(e => esc(e.description)).join(", ")}. Fix ${bad.length > 1 ? "them" : "it"} before finalizing.</div>` : ""}
    ${noFence.length ? `<div class="callout warn" style="margin-bottom:10px">${noFence.map(p => esc(p.name)).join(", ")} ${noFence.length > 1 ? "have" : "has"} no fencing days ticked, so they pay nothing toward the coach's stay. Check Families.</div>` : ""}
    <div class="card"><h2 style="margin-top:0">Balances</h2>
      <table class="t"><tr><th>Family</th><th class="n">Share</th><th class="n">Paid</th><th class="n">Balance</th></tr>${famRows}
        <tr><td><strong>Total</strong></td><td class="n"><strong>${money(total)}</strong></td><td class="n"><strong>${money(total)}</strong></td><td></td></tr></table>
      <p class="hint">Balance: + means the family paid more than its share and is owed money; − means it owes.</p></div>
    <div class="card"><h2 style="margin-top:0">${final() ? "Payments" : "Payments (preview)"}</h2>
      ${final() ? "" : `<p class="hint" style="margin-top:0">These change as expenses are added. Finalize when everything is in.</p>`}
      ${xfers}</div>
    <div class="card"><h2 style="margin-top:0">Each family's statement</h2>${families.map(statement).join("")}</div>
    <div class="actions">
      ${final() ? `<button data-act="export">Download PDF</button><button class="ghost" data-act="reopen">Reopen</button>`
        : `<button data-act="finalize" ${bad.length || !expenses.length ? "disabled" : ""}>Finalize trip</button>`}
    </div>
    ${activity.length ? `<details class="card" style="margin-top:16px"><summary>Recent changes</summary>
      ${activity.map(a => `<div class="small" style="padding:4px 0"><span class="faint">${new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> · ${esc(a.who)} ${esc(a.what)}</div>`).join("")}</details>` : ""}`;
}

// ---------- clicks ----------
app.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]"); if (!b) return;
  const t = S.trip?.tournament, id = Number(b.dataset.id);
  switch (b.dataset.act) {
    case "rename": S.name = ""; return renderName();
    case "add-person": S.adding = id; S.personEdit = null; return renderTrip("families");
    case "edit-person": S.personEdit = id; S.adding = null; return renderTrip("families");
    case "cancel-person": S.personEdit = null; S.adding = null; return renderTrip("families");
    case "del-person":
      if (!confirm("Remove this person from the trip?")) return;
      await act(() => api(`/people/${id}`, { method: "DELETE" })); S.personEdit = null; return refresh("families");
    case "rename-family": {
      const n = prompt("Family name", famName(id)); if (!n) return;
      await act(() => api(`/families/${id}`, { method: "PATCH", body: { name: n } })); return refresh("families");
    }
    case "del-family":
      if (!confirm(`Remove the ${famName(id)} family and everyone in it from this trip?`)) return;
      await act(() => api(`/families/${id}`, { method: "DELETE" })); return refresh("families");
    case "del-trip":
      if (!confirm("Delete this trip?")) return;
      await act(() => api(`/tournaments/${t.id}`, { method: "DELETE" })); location.hash = "#/"; return;
    case "del-expense":
      if (!confirm("Delete this expense?")) return;
      await act(() => api(`/expenses/${id}`, { method: "DELETE" }), "Deleted"); S.draft = null; location.hash = `#/t/${t.id}`; return;
    case "drop-receipt": S.draft.receipt_key = null; S.draft.receipt_type = null; S.draft.aiNote = ""; return drawReceipt();
    case "finalize": {
      const { rows } = balances(S.trip.expenses, S.trip.families);
      if (!confirm("Finalize this trip? Expenses lock, the payments are fixed, and families can start marking them paid.")) return;
      await act(() => api(`/tournaments/${t.id}/finalize`, { method: "POST", body: { transfers: settle(rows) } }), "Finalized");
      return refresh("settle");
    }
    case "reopen": {
      const paid = S.trip.transfers.some(x => x.paid_at);
      if (!confirm(paid ? "Reopen this trip? Payments already marked paid will be cleared and recalculated." : "Reopen this trip for changes?")) return;
      await act(() => api(`/tournaments/${t.id}/reopen`, { method: "POST" })); return refresh("settle");
    }
    case "toggle-paid":
      await act(() => api(`/transfers/${id}`, { method: "PATCH", body: { paid: b.dataset.paid === "1" } })); return refresh("settle");
    case "export": {
      b.disabled = true; b.innerHTML = `<span class="spinner"></span> Building PDF…`;
      try { const { exportPdf } = await import("./pdf.js"); await exportPdf(S.trip); }
      catch (e) { console.error(e); toast("Couldn't build the PDF: " + e.message); }
      b.disabled = false; b.textContent = "Download PDF"; return;
    }
  }
});

route();
