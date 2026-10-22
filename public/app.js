import { BASES, CATEGORIES, tournamentDays, autoUnits, defaultSplit, shares, balances, unsplit, treasurerPlan, money } from "./split.js";

const app = document.getElementById("app");
const S = { name: load("efc-name"), list: null, trip: null, draft: null };

// ---------- small helpers ----------
function load(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
function save(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const utc = iso => new Date(iso + "T12:00:00Z");
const wd = iso => utc(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const dayShort = iso => `${wd(iso)} ${utc(iso).getUTCDate()}`;
const dayLong = iso => iso ? `${wd(iso)}, ${utc(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : "";
const range = t => {
  const o = { month: "short", day: "numeric", timeZone: "UTC" };
  return t.start_date === t.end_date ? utc(t.start_date).toLocaleDateString("en-US", { ...o, year: "numeric" })
    : `${utc(t.start_date).toLocaleDateString("en-US", o)} – ${utc(t.end_date).toLocaleDateString("en-US", { ...o, year: "numeric" })}`;
};
const famName = id => S.trip?.families.find(f => f.id === Number(id))?.name || "?";
const final = () => S.trip?.tournament.status === "final";
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Icons: simple strokes, drawn inline so the app has no outside requests.
const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', nore: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M4 4l16 16"/>',
  meal: '<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 0-3 2-3 6h3v12"/>', plane: '<path d="M2 16l20-6-20-6 3 6-3 6zM5 10h9"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 00-3-3h-8v3"/><circle cx="6.5" cy="10.5" r="1.5"/>',
  car: '<path d="M5 16h14v-4l-2-5H7l-2 5z"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M22 20c0-3-2-5.5-5-6"/>',
  wallet: '<path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H3z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1.3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', sword: '<path d="M14 4h6v6L9 21l-2-2-2 2-2-2 2-2-2-2L14 4z"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  whistle: '<circle cx="8" cy="14" r="5"/><path d="M11 10l10-4v5l-8 3"/><circle cx="8" cy="14" r="1.3"/>',
};
const icon = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const CAT_ICON = { meal: "meal", coach_travel: "plane", coach_stay: "whistle", transport: "car", supplies: "box", other: "tag" };
const MARK = `<span class="mark"><img src="/logo.png" alt="Elite FC"></span>`;

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
  let res;
  try { res = await fetch("/api" + path, { method: opts.method || "GET", headers, body, credentials: "same-origin" }); }
  catch { throw new Error("No connection. Check your signal and try again."); }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (res.status === 401 && path !== "/login") throw new AuthError();
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status})`);
  return data;
}

async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { if (e instanceof AuthError) { renderLogin(); throw e; } toast(e.message); throw e; }
}

// ---------- bottom sheets: every edit and every "are you sure" ----------
// Resolves with the form's values (or true) on the main action, null if dismissed.
function sheet({ title, lead = "", body = "", ok = "Save", okClass = "btn-primary", cancel = "Cancel", extra = "", onOpen }) {
  return new Promise(resolve => {
    const back = document.createElement("div");
    back.className = "sheet-back";
    back.innerHTML = `<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t" novalidate>
      <div class="grip"></div><h2 id="sh-t">${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ""}
      <div class="body">${body}</div>
      <div class="row-actions">${cancel ? `<button type="button" class="btn-ghost" data-x>${cancel}</button>` : ""}<button class="${okClass}">${ok}</button></div>${extra}</form>`;
    const form = back.firstElementChild;
    const prev = document.activeElement;
    const done = v => { back.remove(); document.removeEventListener("keydown", onKey); prev?.focus?.(); resolve(v); };
    const onKey = e => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    let dirty = false;
    form.addEventListener("input", () => { dirty = true; });
    // A tap outside closes the panel only if nothing has been typed; Cancel always does.
    back.addEventListener("click", e => { if (e.target.closest("[data-x]") || (e.target === back && !dirty)) done(null); });
    form.addEventListener("submit", e => {
      e.preventDefault();
      const bad = [...form.querySelectorAll("[required]")].find(i => !i.value.trim());
      if (bad) { bad.focus(); toast("Please fill this in"); return; }
      const out = Object.fromEntries(new FormData(form));
      form.querySelectorAll("[data-value]").forEach(el => { out[el.dataset.value] = el._value(); });
      done(Object.keys(out).length ? out : true);
    });
    form.addEventListener("click", e => { const b = e.target.closest("[data-sheet-act]"); if (b) done({ action: b.dataset.sheetAct }); });
    document.body.appendChild(back);
    onOpen?.(form);
    (form.querySelector("input:not([type=checkbox]), textarea, select") || form.querySelector("button:not([data-x])"))?.focus();
  });
}
const confirmSheet = (title, lead, ok = "Yes", danger = false) => sheet({ title, lead, ok, okClass: danger ? "btn-danger" : "btn-primary" });

// ---------- routing ----------
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.draft && !document.querySelector(".sheet-back")) route(); });

let lastScreen = null;
async function route() {
  await show();
  // On a new screen, start keyboard and screen-reader users at its heading.
  const screen = location.hash.split("?")[0];
  if (screen !== lastScreen) {
    lastScreen = screen;
    const h1 = document.querySelector("h1");
    if (h1 && !document.querySelector(".sheet-back") && document.activeElement === document.body) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  }
}

async function show() {
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
    app.innerHTML = `${bar({ title: "EFC Trip Expenses" })}<div class="wrap"><div class="card empty"><b>Couldn't load this page</b>${esc(e.message)}<div class="row-actions"><a class="btn btn-ghost" href="#/">Back to all trips</a></div></div></div>`;
  }
}

async function loadTrip(id) { S.trip = await api(`/tournaments/${id}`); }
const tabNow = () => new URLSearchParams(location.hash.split("?")[1] || "").get("tab") || "expenses";
async function refresh(tab = tabNow()) { const f = focusKey(); await loadTrip(S.trip.tournament.id); renderTrip(tab, f); }

function bar({ back, title, sub, right = "" }) {
  return `<header class="bar"><div class="bar-in">
    ${back ? `<a class="back" href="${back}" aria-label="Back">${icon("back")}</a>` : MARK}
    <div class="title"><h1 class="t">${esc(title)}</h1>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div>${right}</div></header>`;
}

// ---------- sign-in ----------
function renderLogin() {
  app.innerHTML = `<div class="wrap narrow"><div class="hero">${MARK}<h1>Elite FC Trip Expenses</h1><p>Shared costs for team travel, split fairly.</p></div>
    <form class="card" id="login">
      <label class="f" for="code" style="margin-top:0">Team access code</label>
      <input id="code" type="password" autocomplete="current-password" required>
      <p class="hint">The trip organizers shared this with the team. You only need to enter it once on this device.</p>
      <div class="row-actions"><button class="btn-primary">Continue</button></div>
    </form></div>`;
  document.getElementById("login").onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector("button");
    btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Checking…`;
    try { await api("/login", { method: "POST", body: { code: document.getElementById("code").value } }); await route(); }
    catch (e) { toast(e.message); btn.disabled = false; btn.textContent = "Continue"; }
  };
  document.getElementById("code").focus();
}

function renderName() {
  app.innerHTML = `<div class="wrap narrow"><div class="hero">${MARK}<h1>Welcome</h1><p>One quick question before you start.</p></div>
    <form class="card" id="nm">
      <label class="f" for="name" style="margin-top:0">What's your name?</label>
      <input id="name" autocomplete="name" placeholder="e.g. Lisa Chen" value="${esc(S.name)}" required>
      <p class="hint">It's shown next to anything you add or change, so other parents know who to ask.</p>
      <div class="row-actions"><button class="btn-primary">Continue</button></div>
    </form></div>`;
  const i = document.getElementById("name"); i.focus();
  document.getElementById("nm").onsubmit = ev => {
    ev.preventDefault();
    S.name = i.value.trim(); if (!S.name) return;
    save("efc-name", S.name); route();
  };
}

// ---------- home ----------
function tripStatus(t) {
  if (t.is_sandbox) return `<span class="chip gold">Practice trip</span>`;
  if (t.status === "final") return t.pay_total && t.pay_done < t.pay_total
    ? `<span class="chip gold">Final · ${t.pay_done} of ${t.pay_total} paid</span>` : `<span class="chip ok">${icon("check")} Final · all paid</span>`;
  if (!t.family_count) return `<span class="chip">Setting up</span>`;
  if (!t.treasurer_name && t.expense_count) return `<span class="chip warn">Needs a treasurer</span>`;
  return `<span class="chip navy">Open</span>`;
}

function renderHome() {
  const cards = S.list.map(t => `
    <a class="card" href="#/t/${t.id}">
      <div class="head" style="margin-bottom:4px"><h2>${esc(t.name)}</h2>${icon("chev")}</div>
      <div class="muted small">${esc(range(t))}${t.location ? " · " + esc(t.location) : ""}</div>
      <div class="head" style="margin:10px 0 0"><span class="faint small">${plural(t.expense_count, "expense", "expenses")} · <span class="num">${money(t.total_cents)}</span></span>${tripStatus(t)}</div>
    </a>`).join("");
  app.innerHTML = `${bar({ title: "EFC Trip Expenses", sub: "Team travel costs", right: `<button class="who-btn" data-act="rename" title="Change your name">${esc(S.name)}</button>` })}
    <div class="wrap"><div class="stack">
      <div class="head"><h2>Trips</h2><button class="btn-primary btn-small" data-act="new-trip">${icon("plus")} New trip</button></div>
      ${S.list.length ? cards : `<div class="card empty"><div class="ic">${icon("flag")}</div><b>No trips yet</b>Start one for the next tournament. Anyone on the team can.
        <div class="row-actions"><button class="btn-primary" data-act="new-trip">${icon("plus")} New trip</button></div></div>`}
    </div></div>`;
}

async function newTrip() {
  const v = await sheet({
    title: "New trip", ok: "Create trip",
    body: `<label class="f" for="tn" style="margin-top:0">Tournament</label><input id="tn" name="name" placeholder="e.g. Summer Nationals" required>
      <label class="f" for="tl">Where <span class="opt">(optional)</span></label><input id="tl" name="location" placeholder="City, state">
      <div class="two"><div><label class="f" for="ts">First day</label><input id="ts" name="start_date" type="date" required></div>
        <div><label class="f" for="te">Last day</label><input id="te" name="end_date" type="date" required></div></div>`,
    onOpen: f => { const s = f.querySelector("#ts"), e = f.querySelector("#te"); s.onchange = () => { if (!e.value || e.value < s.value) e.value = s.value; }; },
  });
  if (!v) return;
  const r = await act(() => api("/tournaments", { method: "POST", body: v }));
  location.hash = `#/t/${r.id}?tab=families`;
}

// ---------- one trip ----------
function steps() {
  const { tournament: t, families, expenses, payments } = S.trip;
  const list = [
    { label: "Families", done: families.some(f => f.people.length), tab: "families", go: "Add families",
      next: "Add the families going", why: "List who's coming and which kids are fencing." },
    { label: "Expenses", done: expenses.length > 0, tab: "expenses", go: "Add expense",
      next: "Add shared costs as they happen", why: "Whoever pays adds it, with a photo of the receipt." },
    { label: "Treasurer", done: !!t.treasurer_name, tab: "treasurer", go: "Volunteer",
      next: "Pick a treasurer", why: "One person collects what's owed and pays out the rest." },
    { label: "Finalize", done: final(), tab: "settle", go: "Review",
      next: "Finalize when every expense is in", why: "This fixes who pays what. Keep adding expenses until then." },
    { label: "Payments", done: final() && payments.every(p => p.paid_at), tab: "treasurer", go: "Checklist",
      next: "Everyone pays the treasurer", why: "The treasurer ticks off payments as they arrive." },
  ];
  const now = list.findIndex(s => !s.done);
  return { list, now };
}

function stepsCard() {
  const { list, now } = steps();
  const t = S.trip.tournament;
  const cur = list[now];
  return `<div class="card">
    <ol class="steps" aria-label="Trip progress">${list.map((s, i) => `<li class="${s.done ? "done" : i === now ? "now" : ""}"><div class="b"></div>${s.label}</li>`).join("")}</ol>
    ${cur ? `<div class="next"><div class="txt"><b>Next: ${cur.next}</b>${cur.why}</div>
      ${cur.tab === "expenses" ? `<a class="btn btn-ghost btn-small" href="#/t/${t.id}/e/new">${cur.go}</a>` : `<a class="btn btn-ghost btn-small" href="#/t/${t.id}?tab=${cur.tab}">${cur.go}</a>`}</div>`
      : `<div class="next"><div class="txt"><b>${icon("check")} All settled</b>Every payment is done. Download the PDF for the club's records.</div></div>`}
  </div>`;
}

// Which family is this phone? Remembered per trip, so "you" can lead the page.
const myKey = () => `efc-fam-${S.trip.tournament.id}`;
const myFamily = () => { const v = load(myKey()); return v === "none" ? "none" : S.trip.families.find(f => f.id === Number(v)) || null; };

function youCard() {
  const { tournament: t, families, expenses } = S.trip;
  if (!families.length) return "";
  const me = myFamily();
  if (!me) return `<div class="card you"><div class="eyebrow">Your family</div>
    <p style="margin:6px 0 4px">Which family are you? Pick one and we'll show what you owe right here.</p>
    <p class="hint" style="margin:0 0 10px">This only changes what this phone shows you. It doesn't change anything for anyone else.</p>
    <div class="pills">${families.map(f => `<button data-act="pick-me" data-id="${f.id}">${esc(f.name)}</button>`).join("")}
      <button data-act="pick-me" data-id="none">Not on this trip</button></div></div>`;
  const change = `<button class="link small tap" data-act="pick-me" data-id="">Change family</button>`;
  if (me === "none") return `<div class="card you"><div class="head" style="margin:0"><span class="muted">You're not on this trip.</span>${change}</div></div>`;
  const r = balances(expenses, families).rows[me.id];
  const head = `<div class="head" style="margin-bottom:4px"><span class="eyebrow">${esc(me.name)} family</span>${change}</div>`;
  if (t.treasurer_name && t.treasurer_family_id === me.id) {
    const p = S.trip.payments, left = p.filter(x => !x.paid_at).length;
    return `<div class="card you">${head}<div class="big">You're the treasurer</div>
      <p class="muted" style="margin:4px 0 12px">${final() ? (left ? `${plural(left, "payment", "payments")} still to tick off.` : "Every payment is done.") : "Once the trip is finalized, everyone pays you and you pay out."}</p>
      <a class="btn btn-primary btn-block" href="#/t/${t.id}?tab=treasurer">${icon("wallet")} Open treasurer checklist</a></div>`;
  }
  if (final()) {
    const x = S.trip.payments.find(p => p.family_id === me.id);
    if (!x) return `<div class="card you">${head}<div class="big">All square</div><p class="muted" style="margin:4px 0 0">Your family doesn't owe or get anything.</p></div>`;
    const done = x.paid_at ? `<span class="chip ok">${icon("check")} Done</span>` : `<span class="chip">Waiting</span>`;
    if (x.direction === "in") return `<div class="card you">${head}
      <div class="head" style="margin:0"><div><div class="muted small">Pay ${esc(t.treasurer_name)}</div><div class="big">${money(x.amount_cents)}</div></div>${done}</div>
      <div class="sendto"><b>Send to</b><div class="handle">${t.treasurer_notes ? esc(t.treasurer_notes) : `<span class="faint">${esc(t.treasurer_name)} hasn't added payment details yet.</span>`}</div></div>
      ${x.paid_at ? "" : `<p class="hint">${esc(t.treasurer_name)} ticks it off when your payment arrives.</p>`}
      <a class="link small tap" href="#/t/${t.id}?tab=settle&open=${me.id}">How was this worked out?</a></div>`;
    return `<div class="card you">${head}
      <div class="head" style="margin:0"><div><div class="muted small">${esc(t.treasurer_name)} pays you</div><div class="big get">${money(x.amount_cents)}</div></div>${done}</div>
      <div class="sendto"><b>How to pay you:</b> ${me.pay_notes ? esc(me.pay_notes) : `<span class="faint">not added yet</span>`} <button class="link small" data-act="pay-notes" data-id="${me.id}">${me.pay_notes ? "Edit" : "Add"}</button></div>
      <p class="hint">${x.paid_at ? `${esc(t.treasurer_name)} marked this as sent. If it hasn't arrived, message them.` : `Nothing for you to do. ${esc(t.treasurer_name)} sends it once the other families have paid, and ticks it off here. If it doesn't arrive, message them.`}</p></div>`;
  }
  const line = r.net < 0 ? `You'd owe <b class="owe">${money(-r.net)}</b>` : r.net > 0 ? `You'd get back <b class="get">${money(r.net)}</b>` : "You'd be all square";
  return `<div class="card you">${head}<div class="muted small">If the trip ended now</div><div class="big" style="font-size:22px">${line}</div>
    <div class="figures"><div>Your share<b>${money(r.owed)}</b></div><div>You've paid<b>${money(r.paid)}</b></div></div>
    <a class="link small tap" href="#/t/${t.id}?tab=settle&open=${me.id}">How was this worked out?</a></div>`;
}

// Re-rendering replaces the page, which would drop keyboard focus to the top.
// Remember the focused control by what it does, and focus its replacement.
function focusKey() {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const sel = ["act", "id", "day", "kind", "basis", "fam", "inc", "units"].filter(k => a.dataset?.[k] != null).map(k => `[data-${k}="${a.dataset[k]}"]`).join("");
  return sel || (a.id ? "#" + a.id : null);
}
function restoreFocus(sel, fallback) {
  const el = (sel && document.querySelector(sel)) || (fallback && document.querySelector(fallback));
  if (el) el.focus({ preventScroll: !!sel && !!document.querySelector(sel) });
}

function renderTrip(tab, focusSel = focusKey()) {
  const { tournament: t } = S.trip;
  const tabs = [["expenses", "Expenses"], ["families", "Families"], ["settle", "Settle up"], ["treasurer", "Treasurer"]]
    .map(([k, l]) => `<a href="#/t/${t.id}?tab=${k}" class="${k === tab ? "on" : ""}" ${k === tab ? 'aria-current="page"' : ""}>${l}</a>`).join("");
  app.innerHTML = `${bar({ back: "#/", title: t.name, sub: `${range(t)}${t.location ? " · " + t.location : ""}`, right: final() ? `<span class="chip gold">Final</span>` : "" })}
    <div class="wrap wide">${t.is_sandbox ? `<div class="practice"><div><b>Practice trip.</b> Nothing here is real money. Try anything: add expenses, finalize, tick payments. Reset puts it all back.</div>
      <button class="btn-ghost btn-small" data-act="reset-sandbox">Reset practice trip</button></div>` : ""}<div class="trip">
      <aside class="side stack">${youCard()}${stepsCard()}</aside>
      <div class="main stack"><nav class="tabs" aria-label="Sections">${tabs}</nav><div id="tab" class="stack ${S.lastTab === tab ? "" : "enter"}"></div></div>
    </div></div>`;
  ({ expenses: tabExpenses, families: tabFamilies, settle: tabSettle, treasurer: tabTreasurer })[tab]?.(document.getElementById("tab"));
  if (focusSel) restoreFocus(focusSel);
  S.lastTab = tab;
}

// ---------- expenses ----------
function tabExpenses(el) {
  const { tournament: t, families, expenses } = S.trip;
  const { perExpense } = balances(expenses, families);
  const bad = new Set(unsplit(expenses, families).map(e => e.id));
  if (!families.some(f => f.people.length)) {
    el.innerHTML = `<div class="card empty"><div class="ic">${icon("users")}</div><b>Add families first</b>Expenses are split between the families on the trip, so start by adding them.
      <div class="row-actions"><a class="btn btn-primary" href="#/t/${t.id}?tab=families">Add families</a></div></div>`;
    return;
  }
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const groups = new Map();
  for (const e of expenses) { const k = e.date || ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  const rows = [...groups.entries()].map(([d, list]) => `
    <div class="dayhead">${d ? esc(dayLong(d)) : "Whole trip"}</div>
    ${list.map(e => { const s = perExpense[e.id]; return `
      <a class="xrow" href="#/t/${t.id}/e/${e.id}">
        <div class="ic">${icon(CAT_ICON[e.category] || "tag")}</div>
        <div class="grow"><div class="what">${esc(e.description)}</div>
          <div class="meta">${esc(famName(e.paid_by))} paid · ${bad.has(e.id) ? `<span class="owe">nobody included</span>` : `${BASES[e.basis].label.toLowerCase()}, ${plural(s.total, BASES[e.basis].unit, BASES[e.basis].units)}`}</div></div>
        <div><div class="amt">${money(e.amount_cents)}</div>
          <div class="rc ${e.receipt_key ? "has" : ""}">${icon(e.receipt_key ? "receipt" : "nore")}${e.receipt_key ? "Receipt" : "No receipt"}</div></div></a>`; }).join("")}`).join("");
  el.innerHTML = `
    ${!t.treasurer_name && expenses.length && !final() ? needTreasurerCallout(t) : ""}
    <div class="card ledger">
      <div class="total"><span class="muted">${plural(expenses.length, "shared expense", "shared expenses")}</span><span class="v">${money(total)}</span></div>
      ${expenses.length ? rows : `<div class="empty"><div class="ic">${icon("receipt")}</div><b>Nothing added yet</b>Whoever pays for something shared adds it here, ideally with a photo of the receipt.</div>`}
    </div>
    <p class="hint" style="padding:0 4px">Shared costs only: team meals, the coach's travel and stay, transport and supplies. Your own flight and room aren't included, and neither are coaching fees.</p>
    ${final() ? "" : `<a class="btn btn-primary fab" href="#/t/${t.id}/e/new">${icon("plus")} Add expense</a>`}`;
}

// ---------- families & attendance ----------
function tabFamilies(el) {
  const { tournament: t, families } = S.trip;
  const days = tournamentDays(t.start_date, t.end_date);
  const ro = final();
  const famCard = f => `
    <div class="card">
      <div class="head" style="margin-bottom:2px"><h2>${esc(f.name)}</h2>
        <button class="btn-ghost btn-small" data-act="edit-family" data-id="${f.id}" aria-label="${ro ? "Payment details for" : "Edit"} the ${esc(f.name)} family">${icon("edit")} ${ro ? "Payment details" : "Edit"}</button></div>
      <div class="paynote">How to pay this family: ${f.pay_notes ? esc(f.pay_notes) : `<span class="faint">not added yet</span>`}</div>
      <div style="margin-top:10px">${f.people.map(p => `
        <button class="member" data-act="edit-person" data-id="${p.id}" ${ro ? "disabled" : ""}>
          <div class="grow"><div class="nm">${esc(p.name)} ${p.is_fencer ? `<span class="chip fencer">Fencer</span>` : ""}</div>
            <div class="when">${p.days.length === days.length ? "Whole trip" : p.days.length ? p.days.map(dayShort).join(", ") : `<span class="owe">No days ticked</span>`}${p.is_fencer ? ` · ${p.fencing_days.length ? `fences ${p.fencing_days.map(dayShort).join(", ")}` : `<span class="owe">no fencing days</span>`}` : ""}</div></div>
          ${ro ? "" : icon("chev")}</button>`).join("") || `<p class="faint small" style="margin:8px 0 0">Nobody added yet.</p>`}
      ${ro ? "" : `<button class="btn-ghost btn-small" style="margin-top:8px" data-act="add-person" data-id="${f.id}">${icon("plus")} Add person</button>`}</div>
    </div>`;
  const people = families.flatMap(f => f.people.map(p => ({ ...p, fam: f.name })));
  const grid = (fence) => {
    const rows = families.map(f => {
      const ps = f.people.filter(p => !fence || p.is_fencer);
      if (!ps.length) return "";
      return `<tr class="fam"><td class="who" colspan="${days.length + 1}">${esc(f.name)}</td></tr>` + ps.map(p => `<tr><td class="who">${esc(p.name)}</td>${days.map(d => {
        const on = (fence ? p.fencing_days : p.days).includes(d);
        return `<td><button class="cell ${fence ? "fence" : ""} ${on ? "on" : ""}" data-act="cell" data-id="${p.id}" data-day="${d}" data-kind="${fence ? "fencing" : "days"}" ${ro ? "disabled" : ""}
          aria-pressed="${on}" aria-label="${esc(p.name)} ${fence ? "fencing" : "there"} ${dayLong(d)}">${icon("check")}</button></td>`;
      }).join("")}</tr>`).join("");
    }).join("");
    return `<div class="grid-wrap"><table class="grid"><thead><tr><th class="who"></th>${days.map(d => `<th>${wd(d)}<br>${utc(d).getUTCDate()}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  el.innerHTML = `
    ${families.map(famCard).join("") || `<div class="card empty"><div class="ic">${icon("users")}</div><b>No families yet</b>Add each family going on this trip, then the people in it.</div>`}
    ${ro ? "" : `<form class="card" id="addfam"><label class="f" for="fname" style="margin-top:0">Add a family</label>
      <div style="display:flex;gap:8px"><input id="fname" placeholder="Family name, e.g. Okafor" required><button class="btn-primary">Add</button></div></form>`}
    ${people.length ? `<div class="card"><h2>Who's there each day</h2><p class="muted small">Tap a square to switch it on or off. Meals are split among the people there that day.</p>${grid(false)}</div>` : ""}
    ${people.some(p => p.is_fencer) ? `<div class="card"><h2>Who fences each day</h2><p class="muted small">Only the days each kid competes. These decide their share of the coach's hotel and meals.</p>${grid(true)}</div>` : ""}
    ${ro ? "" : `<details class="card"><summary>Trip details</summary>
      <form id="tripedit">
        <label class="f" for="en">Tournament</label><input id="en" value="${esc(t.name)}" required>
        <label class="f" for="el">Where <span class="opt">(optional)</span></label><input id="el" value="${esc(t.location)}">
        <div class="two"><div><label class="f" for="es">First day</label><input id="es" type="date" value="${t.start_date}" required></div>
          <div><label class="f" for="ee">Last day</label><input id="ee" type="date" value="${t.end_date}" required></div></div>
        <p class="hint">Shortening the trip removes the dropped days from everyone's attendance.</p>
        <div class="row-actions"><button class="btn-primary">Save details</button>${S.trip.expenses.length ? "" : `<button type="button" class="btn-danger" data-act="del-trip">Delete trip</button>`}</div>
      </form></details>`}`;
  const af = document.getElementById("addfam");
  if (af) af.onsubmit = async ev => {
    ev.preventDefault();
    const name = document.getElementById("fname").value.trim(); if (!name) return;
    const r = await act(() => api(`/tournaments/${t.id}/families`, { method: "POST", body: { name } }));
    await refresh("families");
    personSheet({ id: 0, family_id: r.id, name: "", is_fencer: true, days: [...days], fencing_days: [] });
  };
  const te = document.getElementById("tripedit");
  if (te) te.onsubmit = async ev => {
    ev.preventDefault();
    await act(() => api(`/tournaments/${t.id}`, { method: "PATCH", body: {
      name: document.getElementById("en").value, location: document.getElementById("el").value,
      start_date: document.getElementById("es").value, end_date: document.getElementById("ee").value } }), "Saved");
    refresh("families");
  };
}

async function personSheet(p) {
  const t = S.trip.tournament, days = tournamentDays(t.start_date, t.end_date);
  const fam = famName(p.family_id);
  const dayBtns = (list, kind) => days.map(d => `<button type="button" class="${list.includes(d) ? "on" : ""}" data-day="${d}" aria-pressed="${list.includes(d)}">${esc(dayShort(d))}</button>`).join("");
  const v = await sheet({
    title: p.id ? `Edit ${esc(p.name)}` : `Add someone to the ${esc(fam)} family`, ok: p.id ? "Save" : "Add person",
    body: `<label class="f" for="pn" style="margin-top:0">Name</label><input id="pn" name="name" value="${esc(p.name)}" placeholder="First name" required>
      <label class="switch"><input type="checkbox" name="is_fencer" ${p.is_fencer ? "checked" : ""}> Fencing at this tournament</label>
      <label class="f">Days at the trip</label><div class="days" data-value="days">${dayBtns(p.days)}</div>
      <div class="fencebox" ${p.is_fencer ? "" : "hidden"}><label class="f">Days fencing</label><div class="days fence" data-value="fencing_days">${dayBtns(p.fencing_days)}</div>
        <p class="hint">Only the days they compete. You can change these later.</p></div>`,
    extra: p.id ? `<div class="row-actions"><button type="button" class="link danger" data-sheet-act="remove">Remove ${esc(p.name)} from the trip</button></div>` : "",
    onOpen: f => {
      f.querySelector("[name=is_fencer]").onchange = e => { f.querySelector(".fencebox").hidden = !e.target.checked; };
      f.querySelectorAll(".days").forEach(box => {
        box._value = () => [...box.querySelectorAll("button.on")].map(b => b.dataset.day);
        box.onclick = e => { const b = e.target.closest("button"); if (!b) return; b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); };
      });
    },
  });
  if (!v) return;
  if (v.action === "remove") {
    if (!(await confirmSheet(`Remove ${esc(p.name)}?`, "They won't count toward any expense on this trip.", "Remove", true))) return;
    await act(() => api(`/people/${p.id}`, { method: "DELETE" }), "Removed"); return refresh("families");
  }
  const fencer = v.is_fencer === "on";
  // Fencing on a day means being there that day.
  const body = { name: v.name, is_fencer: fencer, fencing_days: fencer ? v.fencing_days : [], days: [...new Set([...v.days, ...(fencer ? v.fencing_days : [])])] };
  await act(() => p.id ? api(`/people/${p.id}`, { method: "PATCH", body }) : api(`/families/${p.family_id}/people`, { method: "POST", body }), p.id ? "Saved" : `${v.name} added`);
  await refresh("families");
  if (!p.id && (await confirmSheet(`Add someone else to the ${esc(fam)} family?`, "", "Add another"))) personSheet({ ...p, name: "", is_fencer: false, fencing_days: [] });
}

async function familySheet(id) {
  const f = S.trip.families.find(x => x.id === id);
  const v = await sheet({
    title: `${esc(f.name)} family`, ok: "Save",
    lead: final() ? "This trip is final, so only payment details can change. Reopen the trip from Settle up to change anything else." : "",
    body: `${final() ? "" : `<label class="f" for="fn" style="margin-top:0">Family name</label><input id="fn" name="name" value="${esc(f.name)}" required>`}
      <label class="f" for="fp" ${final() ? 'style="margin-top:0"' : ""}>How should the treasurer pay this family? <span class="opt">(optional)</span></label>
      <input id="fp" name="pay_notes" value="${esc(f.pay_notes)}" placeholder="e.g. Venmo @lisa-chen or Zelle 555-0100">
      <p class="hint">Only needed if they end up being owed money.</p>`,
    extra: final() ? "" : `<div class="row-actions"><button type="button" class="link danger" data-sheet-act="remove">Remove the ${esc(f.name)} family from the trip</button></div>`,
  });
  if (!v) return;
  if (v.action === "remove") {
    if (!(await confirmSheet(`Remove the ${esc(f.name)} family?`, "Everyone in it is removed from this trip too.", "Remove", true))) return;
    await act(() => api(`/families/${id}`, { method: "DELETE" }), "Removed"); return refresh("families");
  }
  await act(() => api(`/families/${id}`, { method: "PATCH", body: v }), "Saved");
  refresh();
}

async function toggleCell(b) {
  const p = S.trip.families.flatMap(f => f.people).find(x => x.id === Number(b.dataset.id));
  const d = b.dataset.day, kind = b.dataset.kind;
  const flip = (list, on) => on ? [...new Set([...list, d])].sort() : list.filter(x => x !== d);
  const on = !(kind === "days" ? p.days : p.fencing_days).includes(d);
  let days = p.days, fencing = p.fencing_days;
  if (kind === "days") { days = flip(days, on); if (!on) fencing = flip(fencing, false); }
  else { fencing = flip(fencing, on); if (on) days = flip(days, true); }
  b.classList.toggle("on", on); // feels instant; the reload below confirms it
  await act(() => api(`/people/${p.id}`, { method: "PATCH", body: { days, fencing_days: fencing } }));
  refresh("families");
}

// ---------- expense editor ----------
const BASIS_HELP = {
  person: "Everyone there that day counts as one: fencers, parents, siblings. The app fills in each family's head count for you.",
  fencer: "One share per fencer at the tournament, however many days they fence.",
  fencer_day: "One share for each day each kid fences.",
  family: "Each family that used it pays an equal share.",
  custom: "Type each family's number of shares yourself.",
};

function renderEditor(id) {
  const { tournament: t, families, expenses } = S.trip;
  const e = id ? expenses.find(x => x.id === id) : null;
  if (final()) { if (e) return renderExpenseView(e); location.hash = `#/t/${t.id}`; return; }
  if (id && !e) { location.hash = `#/t/${t.id}`; return; }
  if (!S.draft || S.draft.id !== (id || 0)) {
    const me = myFamily();
    S.draft = e ? { ...e, split: { ...e.split }, amount: (e.amount_cents / 100).toFixed(2), basisTouched: true }
      : { id: 0, description: "", vendor: "", date: null, category: "meal", basis: "person", amount: "", paid_by: me && me !== "none" ? me.id : "", split: {}, receipt_key: null, receipt_type: null, basisTouched: false };
    if (!e) S.draft.split = defaultSplit("person", families, null);
  }
  const d = S.draft;
  const days = tournamentDays(t.start_date, t.end_date);
  app.innerHTML = `${bar({ back: `#/t/${t.id}`, title: id ? "Edit expense" : "Add expense", sub: t.name })}
    <form id="ex" class="wrap" novalidate><div class="card">
      <div class="section"><h2><span class="n">1</span>Receipt <span class="opt small">(optional)</span></h2><div id="rcpt"></div></div>
      <div class="section"><h2><span class="n">2</span>What was it?</h2>
        <label class="f" for="amt" style="margin-top:0">Amount</label>
        <div class="money-in"><span>$</span><input id="amt" inputmode="decimal" placeholder="0.00" value="${esc(d.amount)}" autocomplete="off"></div>
        <label class="f" for="desc">Description</label><input id="desc" value="${esc(d.description)}" placeholder="e.g. Team lunch, Coach hotel 3 nights">
        <label class="f" for="cat">Category</label><select id="cat">
          ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${d.category === k ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <label class="f" for="day">Day</label><select id="day"><option value="">Whole trip, or more than one day</option>
          ${days.map(x => `<option value="${x}" ${d.date === x ? "selected" : ""}>${esc(dayLong(x))}</option>`).join("")}</select>
        <p class="hint" id="daynote"></p>
        <label class="f" for="vend">Store or restaurant <span class="opt">(optional)</span></label><input id="vend" value="${esc(d.vendor)}">
      </div>
      <div class="section"><h2><span class="n">3</span>Who paid?</h2>
        <div class="pills" id="paid" role="radiogroup" aria-label="Who paid">${families.map(f => `<button type="button" role="radio" aria-checked="${Number(d.paid_by) === f.id}" data-fam="${f.id}" class="${Number(d.paid_by) === f.id ? "on" : ""}">${esc(f.name)}</button>`).join("")}</div>
      </div>
      <div class="section"><h2><span class="n">4</span>How is it shared?</h2>
        <div class="choices" id="basis" role="radiogroup" aria-label="How it's split"></div>
        <label class="f">Who's sharing this cost?</label><div id="split"></div>
        <p class="hint" id="splithint"></p>
      </div>
      ${id ? `<div class="section"><button type="button" class="btn-danger btn-block" data-act="del-expense" data-id="${id}">Delete this expense</button>
        <p class="hint" style="text-align:center">Added by ${esc(e.created_by)}${e.updated_by ? ` · last changed by ${esc(e.updated_by)}` : ""}</p></div>` : ""}
    </div></form>
    <div class="savebar"><div class="in"><div class="sum" id="sum"></div><button class="btn-primary" form="ex" id="save">${id ? "Save changes" : "Save expense"}</button></div></div>`;

  const $ = s => document.getElementById(s);
  const pull = () => { d.amount = $("amt").value; d.description = $("desc").value; d.vendor = $("vend").value; };
  ["amt", "desc", "vend"].forEach(k => $(k).addEventListener("input", () => { pull(); drawSplit(); }));
  $("day").onchange = () => { d.date = $("day").value || null; resetSplit(); };
  $("cat").onchange = () => { d.category = $("cat").value; if (!d.basisTouched) { d.basis = CATEGORIES[d.category].basis; resetSplit(); } };
  $("paid").onclick = ev => { const b = ev.target.closest("[data-fam]"); if (!b) return; d.paid_by = Number(b.dataset.fam); markPaid(); drawSplit(); };
  $("basis").onclick = ev => { const b = ev.target.closest("[data-basis]"); if (!b) return; d.basis = b.dataset.basis; d.basisTouched = true; resetSplit(); };
  $("ex").onsubmit = async ev => { ev.preventDefault(); pull(); await saveExpense(); };
  drawReceipt();
  drawSplit();
}

// A finalized trip is locked, but anyone can still see how an expense was split.
function renderExpenseView(e) {
  const { tournament: t, families } = S.trip;
  const s = shares(e, families);
  app.innerHTML = `${bar({ back: `#/t/${t.id}`, title: e.description, sub: t.name })}
    <div class="wrap"><div class="card">
      <div class="total"><span class="muted">${esc(e.date ? dayLong(e.date) : "Whole trip")}</span><span class="v">${money(e.amount_cents)}</span></div>
      <p class="muted" style="margin-top:6px">${esc(famName(e.paid_by))} paid · ${esc(CATEGORIES[e.category].label)}${e.vendor ? ` · ${esc(e.vendor)}` : ""}</p>
      ${e.receipt_key ? `<div class="receipt" style="margin:12px 0">${e.receipt_type === "application/pdf" ? `<div class="pdf">PDF</div>` : `<img src="/api/receipts/${e.receipt_key}" alt="Receipt photo">`}
        <a href="/api/receipts/${e.receipt_key}" target="_blank" rel="noopener">View receipt</a></div>` : `<p class="faint small">No receipt was added.</p>`}
      <h2 style="margin-top:16px">How it was split</h2><p class="muted small">${BASES[e.basis].label}: ${esc(BASIS_HELP[e.basis])}</p>
      <table class="t">${Object.keys(s.shares).map(id => `<tr><td>${esc(famName(id))}<div class="faint small">${s.units[id]} of ${plural(s.total, BASES[e.basis].unit, BASES[e.basis].units)}</div></td><td class="n">${money(s.shares[id])}</td></tr>`).join("")}
        <tr><td><b>Total</b></td><td class="n"><b>${money(e.amount_cents)}</b></td></tr></table>
      <p class="hint">Added by ${esc(e.created_by)}${e.updated_by ? ` · last changed by ${esc(e.updated_by)}` : ""}. This trip is final; reopen it from Settle up to change anything.</p>
    </div></div>`;
}

function markPaid() {
  document.querySelectorAll("#paid [data-fam]").forEach(b => { const on = Number(b.dataset.fam) === Number(S.draft.paid_by); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
}
function resetSplit() { S.draft.split = defaultSplit(S.draft.basis, S.trip.families, S.draft.date); drawSplit(); }
function cents(v) { const n = Math.round(parseFloat(String(v).replace(/[$,\s]/g, "")) * 100); return Number.isFinite(n) ? n : 0; }

function drawSplit() {
  const d = S.draft, { families } = S.trip;
  const el = document.getElementById("split"); if (!el) return;
  const suggested = CATEGORIES[d.category].basis;
  document.getElementById("basis").innerHTML = Object.entries(BASES).map(([k, b]) => `
    <button type="button" class="choice ${d.basis === k ? "on" : ""}" data-basis="${k}" role="radio" aria-checked="${d.basis === k}">
      <span class="dot"></span><span><b>${b.label}${k === suggested ? `<span class="tag">Usual for this category</span>` : ""}</b><small>${BASIS_HELP[k]}</small></span></button>`).join("");
  const amount = cents(d.amount);
  const s = shares({ ...d, amount_cents: amount }, families);
  const unit = n => plural(n, BASES[d.basis].unit, BASES[d.basis].units);
  el.innerHTML = `<div class="incl">${families.map(f => {
    const inc = String(f.id) in d.split, set = d.split[f.id], auto = autoUnits(d.basis, f, d.date);
    const n = s.units[f.id] || 0;
    return `<div class="r ${inc && n ? "" : "off"}"><input type="checkbox" data-inc="${f.id}" ${inc ? "checked" : ""} aria-label="Include the ${esc(f.name)} family">
      <span class="nm">${esc(f.name)}</span>
      <input type="number" min="0" step="1" inputmode="numeric" data-units="${f.id}" value="${set ?? ""}" placeholder="${d.basis === "custom" ? "0" : auto}" ${inc ? "" : "disabled"} aria-label="${esc(BASES[d.basis].units)} for ${esc(f.name)}">
      <span class="amt">${!inc ? `<span class="faint small">${!auto && d.date && (d.basis === "person" || d.basis === "family") ? "Not there that day" : "Not sharing"}</span>` : n && amount ? money(s.shares[f.id]) : "—"}</span></div>`;
  }).join("")}<div class="tot"><span>${unit(s.total)}</span><span>${s.total && amount ? `${money(Math.round(amount / s.total))} each` : ""}</span></div></div>`;
  const dayNote = document.getElementById("daynote");
  if (dayNote) dayNote.textContent = d.basis === "fencer" || d.basis === "fencer_day"
    ? "For this split the day is only for the record: the cost is shared across every fencing day of the trip."
    : d.basis === "person" || d.basis === "family" ? (() => {
        const away = d.date ? families.filter(f => !autoUnits(d.basis, f, d.date)).map(f => f.name) : [];
        return (away.length ? `Not there that day, so not sharing: ${away.join(", ")}. ` : "")
          + "Only families there on this day share the cost. Pick \"Whole trip\" if it covered more than one day.";
      })() : "";
  document.getElementById("splithint").textContent = d.basis === "custom" ? "Untick any family that isn't sharing this cost."
    : `The numbers are filled in from who's on the trip (${BASES[d.basis].units}). Type a different number to change one, or untick a family that isn't sharing this cost.`;
  document.getElementById("sum").innerHTML = amount
    ? `<b>${money(amount)}</b>${s.total ? `split between ${plural(Object.keys(s.units).length, "family", "families")}` : `<span class="owe">Nobody included yet</span>`}`
    : `<b>Enter the amount</b>then pick who paid`;
  el.onchange = ev => {
    const c = ev.target.closest("[data-inc]");
    if (!c) return;
    const f = families.find(x => x.id === Number(c.dataset.inc));
    // Ticking a family the trip says wasn't there would count 0 and look broken; start it at 1.
    if (c.checked) d.split[c.dataset.inc] = d.basis === "custom" || !autoUnits(d.basis, f, d.date) ? 1 : null; else delete d.split[c.dataset.inc];
    drawSplit();
    el.querySelector(`[data-${c.checked ? "units" : "inc"}="${c.dataset.inc}"]`)?.focus();
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
    const thumb = d.receipt_type === "application/pdf" ? `<div class="pdf">PDF</div>` : `<img src="/api/receipts/${d.receipt_key}" alt="Receipt photo">`;
    el.innerHTML = `<div class="receipt">${thumb}<div style="flex:1">
        <a href="/api/receipts/${d.receipt_key}" target="_blank" rel="noopener">View receipt</a><br>
        ${state === "reading" ? `<span class="muted small"><span class="spinner"></span> Reading the receipt…</span>` : `<button type="button" class="link danger small" data-act="drop-receipt">Remove</button>`}
      </div></div>${d.aiNote ? `<div class="callout" style="margin-top:12px">${esc(d.aiNote)}</div>` : ""}`;
    return;
  }
  el.innerHTML = state === "uploading"
    ? `<p class="muted"><span class="spinner"></span> Uploading the receipt…</p>`
    : `<label class="receipt-pick"><span class="big">${icon("camera")} Take a photo or choose a file</span>
         We'll read the receipt and fill in the form for you. PDFs work too.
         <input type="file" id="file" class="visually-hidden" accept="image/*,application/pdf"></label>
       <p class="hint">No receipt? Skip this and fill in the form.</p>`;
  const input = document.getElementById("file");
  if (input) input.onchange = () => input.files[0] && uploadReceipt(input.files[0], t.id);
}

// Phone photos are big; shrink to about 1600px so upload, storage and the
// final PDF stay small. PDFs go up as they are.
async function shrink(file) {
  if (file.type === "application/pdf") return file;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Couldn't open that photo. Try a JPEG, or take a screenshot of it."); }
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
    try { fillFromReceipt(await api(`/tournaments/${tid}/read-receipt`, { method: "POST", body: { key: r.key } })); }
    catch (e) { if (e instanceof AuthError) throw e; d.aiNote = e.message; }
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
  const out = f.date && !days.includes(f.date) ? ` The receipt is dated ${f.date}, which is outside the trip.` : "";
  d.aiNote = `We filled in the form from the receipt. Check the amount and who's included before saving.${out}${f.notes ? " Note: " + f.notes : ""}`;
  drawSplit();
}

async function saveExpense() {
  const d = S.draft, t = S.trip.tournament;
  const amount_cents = cents(d.amount);
  if (amount_cents <= 0) { document.getElementById("amt").focus(); return toast("Enter the amount"); }
  if (!d.paid_by) { document.getElementById("paid").scrollIntoView({ block: "center" }); return toast("Pick the family that paid"); }
  const s = shares({ ...d, amount_cents }, S.trip.families);
  if (!s.total) return toast("Include at least one family");
  const body = { description: d.description, vendor: d.vendor, date: d.date, category: d.category, basis: d.basis,
    amount_cents, paid_by: Number(d.paid_by), split: d.split, receipt_key: d.receipt_key, receipt_type: d.receipt_type };
  document.getElementById("save").disabled = true;
  try { await act(() => d.id ? api(`/expenses/${d.id}`, { method: "PATCH", body }) : api(`/tournaments/${t.id}/expenses`, { method: "POST", body }), "Expense saved"); }
  catch { document.getElementById("save").disabled = false; return; }
  S.draft = null;
  location.hash = `#/t/${t.id}`;
}

// ---------- settle up ----------
// Everyone settles through one treasurer, so each family has one payment:
// it pays the treasurer, or the treasurer pays it.
const tname = t => t.treasurer_name + (t.treasurer_family_id ? ` (${famName(t.treasurer_family_id)} family)` : "");
const tripUrl = (t, tab) => `${location.origin}/#/t/${t.id}${tab ? "?tab=" + tab : ""}`;

function plan() {
  const { tournament: t, families, expenses } = S.trip;
  if (final()) return S.trip.payments;
  return treasurerPlan(balances(expenses, families).rows, t.treasurer_family_id);
}

function needTreasurerCallout(t) {
  return `<div class="callout warn"><strong>This trip needs a treasurer.</strong> Someone has to collect what families owe and pay back anyone who's owed money.
    <div class="row-actions" style="margin-top:10px"><a class="btn btn-primary btn-small" href="#/t/${t.id}?tab=treasurer">I'll do it</a>
    <button class="btn-ghost btn-small" data-act="copy-need">${icon("copy")} Ask the group</button></div></div>`;
}

const needMessage = t => `${t.name}: we need a treasurer to collect and pay out the shared trip costs. Could someone volunteer? It's one screen in the app: ${tripUrl(t, "treasurer")}`;

function finalMessage(t) {
  const ins = plan().filter(x => x.direction === "in"), outs = plan().filter(x => x.direction === "out");
  const lines = [`${t.name} expenses are final.`];
  if (ins.length) lines.push(`Please pay ${t.treasurer_name}: ${ins.map(x => `${famName(x.family_id)} ${money(x.amount_cents)}`).join(", ")}.`);
  if (t.treasurer_notes) lines.push(`Send to: ${t.treasurer_notes}`);
  const how = id => S.trip.families.find(f => f.id === id)?.pay_notes;
  if (outs.length) lines.push(`${t.treasurer_name} will send money back to: ${outs.map(x => `${famName(x.family_id)} ${money(x.amount_cents)}${how(x.family_id) ? ` (${how(x.family_id)})` : ""}`).join(", ")}.`);
  lines.push(`Details: ${tripUrl(t, "settle")}`);
  return lines.join("\n");
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied. Paste it into the team chat."); }
  catch { await sheet({ title: "Copy this message", body: `<textarea rows="7" readonly>${esc(text)}</textarea>`, ok: "Done", cancel: "" }); }
}

const statusChip = x => !final() ? "" : x.paid_at ? `<span class="chip ok">${icon("check")} Done</span>` : `<span class="chip">Waiting</span>`;

function tabSettle(el) {
  const { tournament: t, families, expenses, activity } = S.trip;
  const { rows, perExpense } = balances(expenses, families);
  const bad = unsplit(expenses, families);
  const noFence = families.flatMap(f => f.people.filter(p => p.is_fencer && !p.fencing_days.length));
  const byFam = new Map(plan().map(x => [x.family_id, x]));
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const todo = families.map(f => {
    const x = byFam.get(f.id);
    let what;
    if (t.treasurer_name && f.id === t.treasurer_family_id) what = rows[f.id].net > 0 ? `Keeps <b class="get">${money(rows[f.id].net)}</b> of what the treasurer collects (it's the treasurer's family)`
      : rows[f.id].net < 0 ? `Adds <b>${money(-rows[f.id].net)}</b> to what the treasurer collects (it's the treasurer's family)` : `<span class="muted">All square (the treasurer's family)</span>`;
    else if (!x) what = `<span class="muted">All square</span>`;
    else if (!t.treasurer_name) what = x.direction === "in" ? `Owes <b>${money(x.amount_cents)}</b>` : `Is owed <b>${money(x.amount_cents)}</b>`;
    else what = x.direction === "in" ? `Pays ${esc(t.treasurer_name)} <b>${money(x.amount_cents)}</b>` : `Gets <b class="get">${money(x.amount_cents)}</b> from ${esc(t.treasurer_name)}`;
    return `<div class="prow"><div class="grow"><b>${esc(f.name)}</b><div class="small">${what}</div></div>${x && t.treasurer_name ? statusChip(x) : ""}</div>`;
  }).join("");
  const statement = f => {
    const lines = expenses.filter(e => perExpense[e.id].shares[f.id]).map(e => {
      const s = perExpense[e.id];
      return `<tr><td>${esc(e.description)}<div class="faint small">${s.units[f.id]} of ${plural(s.total, BASES[e.basis].unit, BASES[e.basis].units)}</div></td><td class="n">${money(s.shares[f.id])}</td></tr>`;
    }).join("");
    const r = rows[f.id];
    const openIt = new URLSearchParams(location.hash.split("?")[1] || "").get("open") === String(f.id);
    const isT = t.treasurer_name && f.id === t.treasurer_family_id;
    const word = r.net === 0 ? "even" : isT ? (r.net > 0 ? "keeps" : "adds") : r.net < 0 ? "owes" : "is owed";
    return `<details ${openIt ? "open" : ""} id="bd-${f.id}"><summary><span style="flex:1">${esc(f.name)}</span><span class="faint small">${word} ${r.net ? money(Math.abs(r.net)) : ""} · details</span></summary><table class="t">${lines || `<tr><td class="faint">Not included in anything</td><td></td></tr>`}
      <tr><td>Their share</td><td class="n">${money(r.owed)}</td></tr><tr><td>They paid</td><td class="n">${money(r.paid)}</td></tr>
      <tr><td><b>${r.net < 0 ? "They owe" : r.net > 0 ? "They're owed" : "Balance"}</b></td><td class="n"><b>${money(Math.abs(r.net))}</b></td></tr></table></details>`;
  };
  const blocked = bad.length || !expenses.length || !t.treasurer_name;
  el.innerHTML = `
    ${bad.length ? `<div class="callout warn">${plural(bad.length, "expense has", "expenses have")} nobody included: ${bad.map(e => esc(e.description)).join(", ")}. Open ${bad.length > 1 ? "them" : "it"} from Expenses and tick who's sharing.</div>` : ""}
    ${noFence.length ? `<div class="callout warn">${noFence.map(p => esc(p.name)).join(", ")} ${noFence.length > 1 ? "have" : "has"} no fencing days ticked, so they pay nothing toward the coach's stay. Check Families.</div>` : ""}
    ${t.treasurer_name ? `<div class="card"><div class="eyebrow">Treasurer</div><h2 style="margin-top:4px">${esc(tname(t))}</h2>
        ${t.treasurer_notes ? `<div class="paynote"><b>Send money to:</b> ${esc(t.treasurer_notes)}</div>` : ""}</div>` : needTreasurerCallout(t)}
    <div class="card ledger"><h2>${final() ? "Who pays what" : "Who will pay what"}</h2>
      ${final() ? "" : `<p class="muted small" style="margin-top:-4px">This updates as expenses are added. It's fixed when the trip is finalized.</p>`}${todo || `<p class="faint">Add families first.</p>`}</div>
    <div class="card ledger"><h2>Balances</h2>
      <div class="table-scroll"><table class="t bal"><tr><th>Family</th><th class="n">Share</th><th class="n">Paid</th><th class="n">Balance</th></tr>
      ${families.map(f => { const r = rows[f.id]; return `<tr><td>${esc(f.name)}</td><td class="n">${money(r.owed)}</td><td class="n">${money(r.paid)}</td>
        <td class="n ${r.net > 0 ? "get" : r.net < 0 ? "owe" : ""}"><b>${r.net > 0 ? "+" : ""}${money(r.net)}</b></td></tr>`; }).join("")}
        <tr><td><b>Total</b></td><td class="n"><b>${money(total)}</b></td><td class="n"><b>${money(total)}</b></td><td></td></tr></table></div>
      <p class="hint">Share is the family's part of every expense. Paid is what they put on their own card. A plus means they're owed money, a minus means they owe.</p></div>
    <div class="card ledger"><h2>Each family's breakdown</h2><p class="muted small" style="margin-top:-4px">Tap a family to see every expense they share and how much of it is theirs.</p>${families.map(statement).join("")}</div>
    ${final() ? `<div class="card action"><h2>Trip finalized</h2><p class="muted small">The trip is locked. Copy the payment list into the team chat, or download the record with every receipt.</p>
        <div class="row-actions"><button class="btn-primary" data-act="copy-final">${icon("copy")} Copy payment list</button>
        <button class="btn-ghost" data-act="export">${icon("download")} Download PDF record</button></div>
        <div class="row-actions"><button class="link" data-act="reopen">Reopen the trip to make changes</button></div></div>`
      : `<div class="card action"><h2>Finalize</h2><p class="muted small">When every expense is in, finalize the trip. Expenses lock and each family gets one payment to make or receive.</p>
        ${blocked && expenses.length ? `<p class="small owe">${!t.treasurer_name ? "Pick a treasurer first." : "Fix the expenses above first."}</p>` : ""}
        <div class="row-actions"><button class="btn-primary" data-act="finalize" ${blocked ? "disabled" : ""}>${icon("flag")} Finalize trip</button></div></div>`}
    ${activity.length ? `<details class="card"><summary>Recent changes</summary>
      ${activity.map(a => `<div class="small" style="padding:5px 0;border-top:1px solid var(--line)"><span class="faint">${new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> · ${esc(a.who)} ${esc(a.what)}</div>`).join("")}</details>` : ""}`;
}

// ---------- treasurer ----------
function tabTreasurer(el) {
  const { tournament: t, families } = S.trip;
  if (!t.treasurer_name) {
    el.innerHTML = `<div class="card action"><h2>Be the treasurer</h2>
      <p class="muted">The treasurer collects from every family that owes money, then pays back every family that's owed. That way nobody else has to pay more than one person.</p>
      <p class="muted">It takes a few minutes after the trip, and the app tracks who has paid.</p>
      <div class="row-actions"><button class="btn-primary" data-act="volunteer">I'll be the treasurer</button>
        <button class="btn-ghost" data-act="copy-need">${icon("copy")} Ask the group</button></div></div>`;
    return;
  }
  const p = plan();
  const ins = p.filter(x => x.direction === "in"), outs = p.filter(x => x.direction === "out");
  const sum = (list, done) => list.filter(x => !done || x.paid_at).reduce((s, x) => s + x.amount_cents, 0);
  const row = x => {
    const f = families.find(ff => ff.id === x.family_id);
    const how = x.direction === "out" ? `<div class="small">${f?.pay_notes ? `Send to: ${esc(f.pay_notes)}` : `<span class="faint">No payment details yet.</span> <button class="link small" data-act="pay-notes" data-id="${x.family_id}">Add</button>`}</div>` : "";
    const label = x.direction === "in" ? `${famName(x.family_id)}'s payment received` : `Paid ${famName(x.family_id)}`;
    return `<div class="prow">
      ${final() ? `<button class="tick ${x.paid_at ? "on" : ""}" data-act="toggle-paid" data-id="${x.id}" data-paid="${x.paid_at ? 0 : 1}" aria-pressed="${!!x.paid_at}" aria-label="${esc(label)}">${icon("check")}</button>` : ""}
      <div class="grow"><b>${esc(famName(x.family_id))}</b>${how}
        ${x.paid_at ? `<div class="small get">Done ${new Date(x.paid_at).toLocaleDateString()} · ${esc(x.paid_marked_by)}</div>` : ""}</div>
      <div class="amt">${money(x.amount_cents)}</div></div>`;
  };
  const mine = t.treasurer_family_id ? balances(S.trip.expenses, families).rows[t.treasurer_family_id]?.net || 0 : 0;
  el.innerHTML = `
    <div class="card"><div class="head" style="margin-bottom:4px"><div><div class="eyebrow">Treasurer</div><h2 style="margin-top:4px">${esc(tname(t))}</h2></div>
        <button class="btn-ghost btn-small" data-act="volunteer">${icon("edit")} Edit</button></div>
      <div class="paynote"><b>Families send money to:</b> ${t.treasurer_notes ? esc(t.treasurer_notes) : `<span class="owe">not added yet. Tap Edit and add your Venmo or Zelle.</span>`}</div></div>
    ${final() ? `<div class="card ledger"><h2>Progress</h2>
      <table class="t"><tr><td>Collected</td><td class="n"><b>${money(sum(ins, true))}</b> of ${money(sum(ins))}</td></tr>
        <tr><td>Paid out</td><td class="n"><b>${money(sum(outs, true))}</b> of ${money(sum(outs))}</td></tr>
        <tr><td>${sum(ins, true) >= sum(outs, true) ? "In hand right now" : "Paid out ahead of collecting"}</td><td class="n"><b>${money(Math.abs(sum(ins, true) - sum(outs, true)))}</b></td></tr></table>
      ${sum(ins, true) < sum(outs, true) ? `<p class="hint">You've sent out more than you've collected so far. That's fine if you fronted it; it evens out as the remaining families pay.</p>` : ""}
      <p class="hint">${t.treasurer_family_id ? `The treasurer's own family (${esc(famName(t.treasurer_family_id))}) ${mine >= 0 ? `keeps ${money(mine)}: that much of what's collected stays with the treasurer at the end` : `adds ${money(-mine)}: the treasurer puts that much in themselves`}. After that, nothing is left over.` : "Everything collected gets paid out, so nothing is left over at the end."}</p></div>`
      : `<div class="callout">Nothing to collect yet. Once the trip is finalized, this becomes your checklist: tick each family as their payment arrives and as you pay people back.</div>`}
    <div class="card ledger"><h2>${final() ? "Collect from" : "You'll collect from"}</h2>${final() ? `<p class="muted small" style="margin-top:-4px">Tick each one when the money arrives.</p>` : ""}${ins.map(row).join("") || `<p class="faint">Nobody owes anything.</p>`}</div>
    <div class="card ledger"><h2>${final() ? "Pay back" : "You'll pay back"}</h2>${final() ? `<p class="muted small" style="margin-top:-4px">Tick each one once you've sent it.</p>` : ""}${outs.map(row).join("") || `<p class="faint">Nobody is owed anything.</p>`}</div>
    ${final() ? `<button class="btn-primary btn-block" data-act="copy-final">${icon("copy")} Copy payment list</button>` : ""}`;
}

async function volunteerSheet() {
  const t = S.trip.tournament, fams = S.trip.families, me = myFamily();
  const byName = fams.find(f => new RegExp(`\\b${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(S.name));
  const famPick = t.treasurer_name ? t.treasurer_family_id : me && me !== "none" ? me.id : byName?.id ?? null;
  const guessed = !t.treasurer_name && famPick ? (me && me !== "none" ? `We filled in ${esc(famName(famPick))}, the family you picked on this phone. ` : `We guessed ${esc(famName(famPick))} from your name; change it if that's wrong. `) : "";
  const v = await sheet({
    title: t.treasurer_name ? "Treasurer details" : "Be the treasurer", ok: t.treasurer_name ? "Save" : "Confirm",
    lead: final() ? "The treasurer can't change once the trip is final, but you can update where families send money." : "",
    body: `${final() ? "" : `<label class="f" for="tn" style="margin-top:0">Treasurer's name</label><input id="tn" name="treasurer_name" value="${esc(t.treasurer_name || S.name)}" required>
      <label class="f" for="tf">Their family on this trip</label><select id="tf" name="treasurer_family_id"><option value="">Not on this trip</option>
        ${fams.map(f => `<option value="${f.id}" ${famPick === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>
      <p class="hint">${guessed}If their family is on the trip, it doesn't pay itself. It just keeps or adds the difference at the end.</p>`}
      <label class="f" for="tnotes" ${final() ? 'style="margin-top:0"' : ""}>Where should families send money?</label>
      <input id="tnotes" name="treasurer_notes" value="${esc(t.treasurer_notes || "")}" placeholder="e.g. Venmo @lisa-chen or Zelle 555-0100">`,
    extra: t.treasurer_name && !final() ? `<div class="row-actions"><button type="button" class="link danger" data-sheet-act="remove">Step down as treasurer</button></div>` : "",
  });
  if (!v) return;
  const body = v.action === "remove" ? { treasurer_name: "" } : v;
  await act(() => api(`/tournaments/${t.id}/treasurer`, { method: "PUT", body }), v.action === "remove" ? "Treasurer removed" : "Saved");
  refresh("treasurer");
}

// ---------- clicks ----------
app.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]"); if (!b) return;
  const t = S.trip?.tournament, id = Number(b.dataset.id);
  try {
    switch (b.dataset.act) {
      case "rename": {
        const v = await sheet({ title: "Your name", body: `<input name="name" value="${esc(S.name)}" required><p class="hint">Shown next to anything you add or change.</p>` });
        if (v) { S.name = v.name.trim(); save("efc-name", S.name); route(); }
        return;
      }
      case "new-trip": return newTrip();
      case "pick-me":
        save(myKey(), b.dataset.id || null);
        if (b.dataset.id) toast(b.dataset.id === "none" ? "Got it: you're not on this trip." : `Showing the ${famName(b.dataset.id)} family. Tap "Change family" to switch.`);
        // The button that was pressed is gone after this; focus what replaced it.
        return renderTrip(tabNow(), b.dataset.id ? '[data-act="pick-me"][data-id=""]' : '[data-act="pick-me"]');
      case "add-person": {
        const days = tournamentDays(t.start_date, t.end_date);
        return personSheet({ id: 0, family_id: id, name: "", is_fencer: true, days, fencing_days: [] });
      }
      case "edit-person": return personSheet(S.trip.families.flatMap(f => f.people).find(p => p.id === id));
      case "edit-family": return familySheet(id);
      case "pay-notes": return familySheet(id);
      case "cell": return toggleCell(b);
      case "del-trip":
        if (!(await confirmSheet("Delete this trip?", "This can't be undone.", "Delete", true))) return;
        await act(() => api(`/tournaments/${t.id}`, { method: "DELETE" })); location.hash = "#/"; return;
      case "del-expense":
        if (!(await confirmSheet("Delete this expense?", "It's removed for everyone, along with its receipt.", "Delete", true))) return;
        await act(() => api(`/expenses/${id}`, { method: "DELETE" }), "Deleted"); S.draft = null; location.hash = `#/t/${t.id}`; return;
      case "drop-receipt": S.draft.receipt_key = null; S.draft.receipt_type = null; S.draft.aiNote = ""; return drawReceipt();
      case "volunteer": return volunteerSheet();
      case "reset-sandbox":
        if (!(await confirmSheet("Reset the practice trip?", "Everything anyone added or changed here is removed, and the trip goes back to how it started. This only affects the practice trip.", "Reset", true))) return;
        await act(() => api(`/tournaments/${t.id}/reset-sandbox`, { method: "POST" }), "Practice trip reset");
        save(myKey(), null); S.lastTab = null;
        location.hash = `#/t/${t.id}`; return refresh("expenses");
      case "finalize": {
        if (!(await confirmSheet("Finalize this trip?", `Expenses lock, and everyone settles through ${esc(t.treasurer_name)}. You can reopen it later if something was missed.`, "Finalize"))) return;
        await act(() => api(`/tournaments/${t.id}/finalize`, { method: "POST" }), "Trip finalized");
        await refresh("settle");
        if (await confirmSheet("Let everyone know", "Copy the list of who pays what, then paste it into the team chat.", "Copy payment list", false)) copy(finalMessage(S.trip.tournament));
        return;
      }
      case "copy-final": return copy(finalMessage(t));
      case "copy-need": return copy(needMessage(t));
      case "reopen": {
        const paid = S.trip.payments.some(x => x.paid_at);
        if (!(await confirmSheet("Reopen this trip?", paid ? "Payments already ticked off will be cleared, and everything is recalculated when you finalize again." : "You can change expenses again, then finalize when you're done.", "Reopen", paid))) return;
        await act(() => api(`/tournaments/${t.id}/reopen`, { method: "POST" }), "Trip reopened"); return refresh("settle");
      }
      case "toggle-paid": {
        const x = S.trip.payments.find(p => p.id === id);
        if (x && x.direction === "out" && b.dataset.paid === "1") {
          const held = S.trip.payments.reduce((s, p) => s + (p.paid_at ? (p.direction === "in" ? p.amount_cents : -p.amount_cents) : 0), 0);
          if (x.amount_cents > held && !(await confirmSheet(`Record paying ${esc(famName(x.family_id))} ${money(x.amount_cents)}?`,
            `So far you've collected ${money(Math.max(held, 0))}, so this would come partly out of your own pocket until the others pay. That's fine if it's what you did.`, "Yes, I sent it"))) return;
        }
        await act(() => api(`/payments/${id}`, { method: "PATCH", body: { paid: b.dataset.paid === "1" } })); return refresh("treasurer");
      }
      case "export": {
        b.disabled = true; const label = b.innerHTML; b.innerHTML = `<span class="spinner"></span> Building PDF…`;
        try { const { exportPdf } = await import("./pdf.js"); await exportPdf(S.trip); }
        catch (e) { console.error(e); toast("Couldn't build the PDF: " + e.message); }
        b.disabled = false; b.innerHTML = label; return;
      }
    }
  } catch (e) { if (!(e instanceof AuthError)) console.error(e); }
});

route();
