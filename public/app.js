import { BASES, CATEGORIES, tournamentDays, familySize, shares, balances, unsplit, treasurerPlan, money } from "./split.js";

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
// Coaches and staff are stored alongside families (kind "staff") and shown with their role.
const famLabel = f => !f ? "?" : f.kind === "staff" ? `${f.role || "Coach"} ${f.name}` : f.name;
const famName = id => famLabel(S.trip?.families.find(f => f.id === Number(id)));
const realFamilies = () => S.trip.families.filter(f => f.kind !== "staff");
const staffList = () => S.trip.families.filter(f => f.kind === "staff");
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
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>', scale: '<path d="M12 4v16M5 20h14M4 9l3-5 3 5a3 3 0 01-6 0zM14 9l3-5 3 5a3 3 0 01-6 0zM7 4h10"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  whistle: '<circle cx="8" cy="14" r="5"/><path d="M11 10l10-4v5l-8 3"/><circle cx="8" cy="14" r="1.3"/>',
};
const icon = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const CAT_ICON = { meal: "meal", coach_meals: "meal", coach_travel: "plane", coach_stay: "whistle", other: "tag" };
const MARK = `<span class="mark"><img src="/logo.png" alt="Elite FC"></span>`;

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

class AuthError extends Error {}
// Adding a person, family or trip: a key names one thing being added (this path, these
// exact words), and is kept on the phone until the server really answers. Retrying "Ava"
// reaches the first Ava; "Ben" is a new key. The server never changes anything for a key
// it has seen, it only says it's already added.
const ADDS = "efc-add-keys", ADD_TTL = 864e5;
function addKeys() { try { return JSON.parse(localStorage.getItem(ADDS)) || {}; } catch { return {}; } }
function setAddKeys(m) { try { localStorage.setItem(ADDS, JSON.stringify(m)); } catch {} }
const addSlot = (path, body) => path + " " + JSON.stringify(body);
function addKeyFor(slot) {
  const m = addKeys(), k = m[slot];
  if (k && Date.now() - k.at < ADD_TTL) return k.key;
  for (const [s, v] of Object.entries(m)) if (Date.now() - v.at >= ADD_TTL) delete m[s];
  m[slot] = { key: crypto.randomUUID(), at: Date.now() }; setAddKeys(m); return m[slot].key;
}
const pendingAddKey = slot => { const k = addKeys()[slot]; return k && Date.now() - k.at < ADD_TTL ? k.key : null; };
function forgetAddKey(slot) { const m = addKeys(); delete m[slot]; setAddKeys(m); }

// No answer from the app itself (no reply, a cut-off one, a wifi sign-in page, a server
// crash, "too many requests", a page this server doesn't have): it may or may not have
// happened. Only the app's own JSON counts as an answer.
const unsure = reads => Object.assign(new Error(reads ? "No connection. Check your signal and try again."
  : "The connection dropped before the app heard back, so this may or may not have saved. Check before trying again."), { unsure: true });

// The name shown next to a change: with "(Coach)" for staff on this trip.
function whoNow() {
  const me = S.trip && S.trip.families.find(f => f.id === Number(load(`efc-fam-${S.trip.tournament.id}`)));
  return me?.kind === "staff" && S.name ? `${S.name} (${me.role || "Coach"})` : S.name;
}

async function api(path, opts = {}) {
  const headers = { "x-user-name": encodeURIComponent(opts.who ?? whoNow() ?? ""), ...(opts.headers || {}) };
  let body = opts.body;
  // Family and person ids can be reused after a delete, so every change to one also
  // names, by its tag, the record this screen is showing.
  const rec = /^\/(families|people)\/(\d+)(\/people)?$/.exec(path);
  if (rec && opts.method && opts.method !== "GET" && S.trip && !(body instanceof Blob)) {
    const id = Number(rec[2]);
    const r = rec[1] === "families" ? S.trip.families.find(f => f.id === id) : S.trip.families.flatMap(f => f.people).find(p => p.id === id);
    if (r?.uid) body = { ...(body || {}), uid: r.uid };
  }
  const adds = opts.method === "POST" && /^\/(tournaments|tournaments\/\d+\/families|families\/\d+\/people)$/.test(path) && body && !(body instanceof Blob);
  const slot = adds && addSlot(path, opts.body);   // what they typed, before the tag is added
  if (adds) body = { ...body, client_key: addKeyFor(slot) };
  if (body && !(body instanceof Blob)) { headers["content-type"] = "application/json"; body = JSON.stringify(body); }
  // A request on a dead signal can hang for minutes: give up after a while and say so.
  // A change whose reply never came may still have been saved, so say that too.
  const reads = !opts.method || opts.method === "GET";
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), opts.body instanceof Blob ? 90000 : 25000);
  let res;
  let data;
  try {
    res = await fetch("/api" + path, { method: opts.method || "GET", headers, body, credentials: "same-origin", signal: ctl.signal });
    data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  } catch { throw unsure(reads); }
  finally { clearTimeout(timer); }
  if (res.status === 401 && path !== "/login") throw new AuthError();
  const answered = data && typeof data === "object" && (res.ok ? true : typeof data.error === "string")
    && res.status < 500 && res.status !== 429 && data.route !== "unknown";
  if (!answered) throw unsure(reads);
  if (adds) forgetAddKey(slot);         // the server answered: whatever it said, there's no doubt left
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status });
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

// ---------- first-visit tour ----------
// Shown once per phone after the welcome; "How it works" on the trip list
// opens it again. The X, a tap outside the card, or Escape closes it.
const TOUR = [
  { icon: "flag", title: "Welcome to EFC Trip Expenses",
    text: "One place for the team's shared travel costs: team meals and outings, and the coach's travel, hotel and meals. It works out who owes what, fairly. Here's how it works in a minute." },
  { icon: "users", title: "Pick your trip, then your family",
    text: "Open a trip and tell it which family you are, or that you're the coach. From then on, the top of the trip shows what you owe or get back. Coaches who pay for things, like their hotel, are paid back by the treasurer." },
  { icon: "edit", title: "Manage your family",
    text: "In Families, open your family to add everyone going: fencers, parents, siblings. Tick the days each kid actually fences. Changes save as you tap." },
  { icon: "camera", title: "Paid for something? Add it on the spot",
    text: "Tap Add expense and take a photo of the receipt. The app reads it and fills in the form. Check it, tick who took part if it was a meal, and save. No receipt? Just type it in." },
  { icon: "scale", title: "Split by what it was for",
    text: "A team meal or outing is paid by the families who went, by how many of each came; the coach's share is covered by whoever went. The coach's flight is shared equally per fencer. The coach's hotel, getting around and own meals are shared by fencing days. You'll always see each family's part." },
  { icon: "wallet", title: "One treasurer, one payment each",
    text: "A parent volunteers as treasurer. When the trip is finalized, each family that owes sends one payment to the treasurer, who pays back anyone who's owed and ticks it all off." },
  { icon: "doc", title: "A record for the club",
    text: "A finished trip downloads as a PDF: a one-page summary, each family's statement, and a copy of every receipt." },
  { icon: "play", title: "Try it safely first",
    text: "The practice trip on the trip list is a sandbox. Add expenses, finalize, tick payments, break things. Reset puts it all back." },
];

function showTour(start = 0) {
  document.querySelector(".tour-back")?.remove();
  let i = start;
  const back = document.createElement("div");
  back.className = "tour-back";
  back.innerHTML = `<div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-x">
    <button class="tour-close" data-tour="close" aria-label="Close the tour">${icon("x")}</button><div class="tour-body"></div></div>`;
  const prev = document.activeElement;
  const close = () => { save("efc-tour-seen", "1"); back.remove(); document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  const onKey = e => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight" && i < TOUR.length - 1) { i++; draw(); } else if (e.key === "ArrowLeft" && i > 0) { i--; draw(); } };
  const draw = () => {
    const p = TOUR[i], last = i === TOUR.length - 1;
    back.querySelector(".tour-body").innerHTML = `
      <div class="tour-ic">${icon(p.icon)}</div>
      <div class="tour-step">${i + 1} of ${TOUR.length}</div>
      <h2 id="tour-t">${p.title}</h2><p id="tour-x">${p.text}</p>
      <div class="tour-dots" aria-hidden="true">${TOUR.map((_, j) => `<span class="${j === i ? "on" : ""}"></span>`).join("")}</div>
      <div class="tour-nav">${i ? `<button class="btn-ghost" data-tour="prev">Back</button>` : `<button class="btn-ghost" data-tour="close">Skip</button>`}
        <button class="btn-primary" data-tour="${last ? "close" : "next"}">${last ? "Get started" : "Next"}</button></div>`;
    back.querySelector(`[data-tour="${last ? "close" : "next"}"]:not(.tour-close)`)?.focus();
  };
  back.addEventListener("click", e => {
    if (e.target === back) return close();
    const b = e.target.closest("[data-tour]"); if (!b) return;
    if (b.dataset.tour === "close") close();
    else { i += b.dataset.tour === "next" ? 1 : -1; draw(); }
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(back);
  draw();
}

// ---------- routing ----------
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => {
  // Leaving for another app: a field still being typed in saves now (some phones never
  // fire its change otherwise), and the expense draft is kept.
  if (document.hidden) { keepDraft(); if (document.activeElement?.matches?.("#fam-name, #fam-pay, #st-name, #st-role, [data-pname]")) document.activeElement.blur(); return; }
  sendWaiting();
  if (S.draft || document.querySelector(".sheet-back, .tour-back")) return;
  // Family and staff screens save field by field; don't reload under someone's typing.
  if (/^#\/t\/\d+\/f\//.test(location.hash) || document.activeElement?.matches?.("input, textarea, select")) return;
  route();
});

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

let routeSeq = 0, lastPath = null;
async function show() {
  const seq = ++routeSeq;
  const stale = () => seq !== routeSeq;   // they've already moved on
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query] = h.split("?");
  // A new screen starts at the top; a tab change or a refresh keeps the place.
  if (path !== lastPath) { lastPath = path; window.scrollTo(0, 0); }
  app.inert = false;                      // a save they walked away from doesn't freeze the next screen
  const parts = path.split("/").filter(Boolean);
  const q = new URLSearchParams(query || "");
  if (!S.name) return renderName();
  try {
    if (parts[0] === "t" && parts[1]) {
      await famQueue;                 // let any save from the family screen land first
      const trip = await api(`/tournaments/${Number(parts[1])}`);
      if (stale()) return;
      S.trip = trip;
      if (parts[2] === "e") return renderEditor(parts[3] === "new" ? null : Number(parts[3]));
      leaveDraft();
      if (parts[2] === "f") return renderFamily(Number(parts[3]));
      if (parts[2] === "fencing" || parts[2] === "day") { await fenceQueue; return renderFencing(); }
      const tab = q.get("tab");
      return renderTrip(["expenses", "families", "settle", "treasurer"].includes(tab) ? tab : "expenses");
    }
    S.draft = null;
    if (parts[0] === "deleted") { const del = await api("/tournaments/deleted"); if (!stale()) renderDeleted(del); return; }
    const list = await api("/tournaments");
    if (stale()) return;
    S.list = list;
    renderHome();
    if (!load("efc-tour-seen")) showTour();
  } catch (e) {
    if (stale()) return;                    // an abandoned page's error isn't news
    if (e instanceof AuthError) return renderLogin();
    // No signal on a trip's main screen: show it as last loaded, so what's waiting to
    // send can be seen. Anything that changes it still needs a signal, and says so.
    if (e.unsure && parts[0] === "t" && !parts[2] && S.trip?.tournament.id === Number(parts[1])) {
      const tab = q.get("tab");
      renderTrip(["expenses", "families", "settle", "treasurer"].includes(tab) ? tab : "expenses");
      if (!document.getElementById("toast").classList.contains("show")) toast("No signal. This is the trip as it was last loaded.");
      return;
    }
    app.innerHTML = `${bar({ title: "EFC Trip Expenses" })}<div class="wrap"><div class="card empty"><b>Couldn't load this page</b>${esc(e.message)}<div class="row-actions"><a class="btn btn-ghost" href="#/">Back to all trips</a></div></div></div>`;
  }
}

async function loadTrip(id) { S.trip = await api(`/tournaments/${id}`); }
const tabNow = () => new URLSearchParams(location.hash.split("?")[1] || "").get("tab") || "expenses";
async function refresh(tab = tabNow()) {
  // Only while they're still on this trip's main screen: an action that finishes
  // after they've moved on must not paint the old trip over the new screen.
  // A newer load (the route reloading on return to the app) wins over this older one.
  const id = S.trip.tournament.id, h0 = location.hash, seq = routeSeq;
  const here = () => location.hash === h0 && routeSeq === seq && h0.split("?")[0] === `#/t/${id}`;
  if (!here()) return;
  const f = focusKey();
  const trip = await api(`/tournaments/${id}`);
  if (!here()) return;
  S.trip = trip;
  renderTrip(tab, f);
}

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
      ${waiting(t.id).length ? `<div class="owe small" style="margin-top:6px">${plural(waiting(t.id).length, "expense", "expenses")} on this phone, not sent yet</div>` : ""}
    </a>`).join("");
  app.innerHTML = `${bar({ title: "EFC Trip Expenses", sub: "Team travel costs", right: `<button class="who-btn" data-act="rename" title="Change your name">${esc(S.name)}</button>` })}
    <div class="wrap"><div class="stack">
      <div class="head trips-head"><h2>Trips</h2><button class="btn-primary btn-small" data-act="new-trip">${icon("plus")} New trip</button></div>
      ${S.list.length ? cards : `<div class="card empty"><div class="ic">${icon("flag")}</div><b>No trips yet</b>Start one for the next tournament. Anyone on the team can.
        <div class="row-actions"><button class="btn-primary" data-act="new-trip">${icon("plus")} New trip</button></div></div>`}
      <p class="hint home-links"><button class="link small" data-act="tour">How it works</button><span aria-hidden="true">·</span><a href="#/deleted">Recently deleted trips</a></p>
    </div></div>`;
}

function renderDeleted({ keep_days, trips }) {
  const gone = d => new Date(new Date(d).getTime() + keep_days * 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  app.innerHTML = `${bar({ back: "#/", title: "Recently deleted", sub: `Trips stay here for ${keep_days} days` })}
    <div class="wrap"><div class="stack">
      <p class="muted">Deleted trips can be restored exactly as they were for ${keep_days} days. After that, the trip and its receipts are removed for good.</p>
      ${trips.length ? trips.map(t => `<div class="card"><div class="head" style="margin-bottom:4px"><h2 style="border:0;padding:0;margin:0">${esc(t.name)}</h2>
          <button class="btn-ghost btn-small" data-act="restore" data-id="${t.id}">Restore</button></div>
        <div class="muted small">${esc(range(t))} · ${plural(t.expense_count, "expense", "expenses")}</div>
        <div class="faint small">Deleted by ${esc(t.deleted_by || "someone")} on ${new Date(t.deleted_at).toLocaleDateString()} · removed for good on ${gone(t.deleted_at)}</div></div>`).join("")
      : `<div class="card empty"><b>Nothing here</b>No trips have been deleted recently.</div>`}
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
      ${cur.tab === "expenses" ? `<a class="btn btn-ghost btn-small" href="#/t/${t.id}/e/new">${cur.go}</a>`
        : cur.label === "Treasurer" ? `<button class="btn btn-ghost btn-small" data-act="volunteer">${cur.go}</button>`
        : `<button class="btn btn-ghost btn-small" data-act="step" data-tab="${cur.tab}">${cur.go}</button>`}</div>`
      : `<div class="next"><div class="txt"><b>${icon("check")} All settled</b>Every payment is done. Download the PDF for the club's records.</div></div>`}
  </div>`;
}

// Which family is this phone? Remembered per trip, so "you" can lead the page.
const myKey = () => `efc-fam-${S.trip.tournament.id}`;
// The family is kept by its number and its tag: numbers can be reused after a delete,
// so a family that took the number of this phone's family isn't taken for it.
const setMe = v => { save(myKey(), v); save(myKey() + "-uid", null); };
const myFamily = () => {
  const v = load(myKey()); if (v === "none") return "none";
  const f = S.trip.families.find(x => x.id === Number(v)), uid = load(myKey() + "-uid");
  if (f && uid && f.uid !== uid) return null;
  if (f && !uid) save(myKey() + "-uid", f.uid);
  return f || null;
};

function youCard() {
  const { tournament: t, families, expenses } = S.trip;
  const fams = realFamilies(), staff = staffList();
  if (!families.length) return "";
  const me = myFamily();
  if (!me) return `<div class="card you"><div class="eyebrow">Your family</div>
    <p style="margin:6px 0 4px">Which family are you? Pick one and we'll show what you owe right here.</p>
    <p class="hint" style="margin:0 0 10px">This only changes what this phone shows you. It doesn't change anything for anyone else.</p>
    ${fams.length > 8 ? `<div class="pickrow"><select id="pickfam" aria-label="Your family"><option value="">Choose your family…</option>
        ${fams.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}
        ${staff.length ? `<optgroup label="Coaches & staff">${staff.map(f => `<option value="${f.id}">${esc(famLabel(f))}</option>`).join("")}</optgroup>` : ""}
        <option value="none">I'm not traveling (organizer, treasurer, board…)</option></select></div>
      <div class="pills" style="margin-top:8px">`
    : `<div class="pills">${fams.map(f => `<button data-act="pick-me" data-id="${f.id}">${esc(f.name)}</button>`).join("")}`}
      ${final() ? "" : `<button class="addmine" data-act="add-my-family">${icon("plus")} Add my family</button>`}</div>
    <div class="pick-others">${fams.length > 8 ? "" : `<button class="link small tap" data-act="pick-staff">I'm a coach or staff</button>
      <button class="link small tap" data-act="pick-me" data-id="none">I'm not traveling (organizer, treasurer, board…)</button>`}</div></div>`;
  const change = `<button class="link small tap" data-act="pick-me" data-id="">Change</button>`;
  if (me === "none") return `<div class="card you"><div class="head" style="margin:0"><span class="muted">You're not traveling on this trip.</span>${change}</div>
    <p class="hint" style="margin:4px 0 0">You can still see everything and help: add expenses, act as treasurer, or check the numbers.</p></div>`;
  const r = balances(expenses, families).rows[me.id];
  const head = `<div class="head" style="margin-bottom:4px"><span class="eyebrow">${me.kind === "staff" ? esc(famLabel(me)) : `${esc(me.name)} family`}</span>${change}</div>`;
  if (me.kind === "staff" && !final()) return `<div class="card you">${head}
    ${r.paid ? `<div class="muted small">If the trip ended now</div><div class="big" style="font-size:22px">The treasurer pays you back <b class="get">${money(r.paid)}</b></div>
      <p class="hint">That's what you've paid for the team so far. Coaches and staff never share the costs.</p>`
      : `<div class="big" style="font-size:20px">Nothing to pay you back yet</div>
      <p class="hint">Paid for something for the team, like your flight or hotel? Add it and choose yourself under "Who paid?". The treasurer pays you back.</p>`}
    <div class="sendto"><b>How to pay you back:</b> ${me.pay_notes ? esc(me.pay_notes) : `<span class="faint">not added yet</span>`} <button class="link small" data-act="pay-notes" data-id="${me.id}">${me.pay_notes ? "Edit" : "Add"}</button></div></div>`;
  if (t.treasurer_name && t.treasurer_family_id === me.id) {
    const p = S.trip.payments, left = p.filter(x => !x.paid_at).length;
    return `<div class="card you">${head}<div class="big">You're the treasurer</div>
      <p class="muted" style="margin:4px 0 12px">${final() ? (left ? `${plural(left, "payment", "payments")} still to tick off.` : "Every payment is done.") : "Once the trip is finalized, everyone pays you and you pay out."}</p>
      <a class="btn btn-primary btn-block" href="#/t/${t.id}?tab=treasurer">${icon("wallet")} Open treasurer checklist</a></div>`;
  }
  if (final()) {
    const x = S.trip.payments.find(p => p.family_id === me.id);
    if (!x) return `<div class="card you">${head}<div class="big">All square</div><p class="muted" style="margin:4px 0 0">${me.kind === "staff" ? "Nothing to pay you back." : "Your family doesn't owe or get anything."}</p></div>`;
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
  const sel = ["act", "id", "day", "kind", "basis", "fam", "inc", "units", "fence", "own", "famday", "pname", "fencer"].filter(k => a.dataset?.[k] != null).map(k => `[data-${k}="${a.dataset[k]}"]`).join("");
  return sel || (a.id ? "#" + a.id : null);
}
function restoreFocus(sel, fallback) {
  const el = (sel && document.querySelector(sel)) || (fallback && document.querySelector(fallback));
  if (el) el.focus({ preventScroll: !!sel && !!document.querySelector(sel) });
}

document.addEventListener("change", ev => {
  if (ev.target.id !== "pickfam" || !ev.target.value) return;
  const v = ev.target.value;
  setMe(v);
  toast(v === "none" ? "Got it: you're not on this trip." : `Showing the ${famName(v)} family. Tap "Change family" to switch.`);
  renderTrip(tabNow(), '[data-act="pick-me"][data-id=""]');
});

function renderTrip(tab, focusSel = focusKey()) {
  const { tournament: t } = S.trip;
  settleWaiting();
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
          <div class="meta">${esc(famName(e.paid_by))} paid · ${bad.has(e.id) ? `<span class="owe">nobody included</span>` : `${(BASES[e.basis]?.label || "older split").toLowerCase()}, ${plural(s.total, BASES[e.basis]?.unit || "share", BASES[e.basis]?.units || "shares")}`}</div></div>
        <div><div class="amt">${money(e.amount_cents)}</div>
          <div class="rc ${e.receipt_key ? "has" : ""}">${icon(e.receipt_key ? "receipt" : "nore")}${e.receipt_key ? "Receipt" : "No receipt"}</div></div></a>`; }).join("")}`).join("");
  // The treasurer ask lives on the Treasurer tab and in the next-step card, not over the list.
  // Add expense comes first: it floats at the bottom on a phone and sits at the top on a laptop.
  const wait = waiting(t.id);
  const since = w => new Date(w.at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  el.innerHTML = `
    ${final() ? "" : `<a class="btn btn-primary fab" href="#/t/${t.id}/e/new">${icon("plus")} Add expense</a>`}
    ${wait.length ? `<div class="card waiting"><h2>Waiting to send</h2>
      ${wait.length ? `<p class="muted small" style="margin-top:-4px">On this phone, not confirmed yet. It may already be on the trip. Sent by itself when there's a signal, and not in the totals until then.</p>` : ""}
      ${wait.map(w => `<div class="xrow"><div class="grow"><div class="what">${esc(w.label)}</div>
        <div class="meta">${w.refused ? `<span class="owe">Couldn't send: ${esc(w.refused)}</span> <button class="link small" data-act="rewait" data-key="${esc(w.key)}">Open it to fix</button>` : `Waiting since ${esc(since(w))}`}</div></div>
        <button class="btn-ghost btn-small" data-act="unwait" data-key="${esc(w.key)}">Remove</button></div>`).join("")}</div>` : ""}
    <div class="card ledger">
      <div class="total"><span class="muted">${plural(expenses.length, "shared expense", "shared expenses")}</span><span class="v">${money(total)}</span></div>
      ${expenses.length ? rows : `<div class="empty"><div class="ic">${icon("receipt")}</div><b>Nothing added yet</b>Whoever pays for something shared adds it here, ideally with a photo of the receipt.</div>`}
    </div>
    <p class="hint" style="padding:0 4px">Shared costs only: team meals and outings, and the coach's travel, hotel, getting around and own meals. Your own flight, room, parking and gas aren't included, and neither are coaching fees, team supplies or snacks.</p>`;
}

// ---------- families & fencing days ----------
// A family and its people are on the whole trip; the only per-day thing is which
// days each fencer fences. The Families tab is a short list of one-line summaries;
// each family opens on its own Manage family screen, and every change saves as you tap.
function daysSummary(list) {
  const all = tournamentDays(S.trip.tournament.start_date, S.trip.tournament.end_date);
  const sorted = all.filter(d => list.includes(d));
  if (!sorted.length) return "No days";
  if (sorted.length === all.length && all.length > 1) return "Whole trip";
  const runs = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && all.indexOf(d) === all.indexOf(last[1]) + 1) last[1] = d; else runs.push([d, d]);
  }
  return runs.map(([a, b]) => a === b ? dayShort(a) : `${dayShort(a)}–${dayShort(b)}`).join(", ");
}

function familyFlags(f) {
  const out = [];
  if (!f.people.length) out.push("nobody added yet");
  for (const p of f.people) if (p.is_fencer && !p.fencing_days.length) out.push(`${p.name} has no fencing days ticked`);
  return out;
}

function tabFamilies(el) {
  const { tournament: t } = S.trip;
  const families = realFamilies(), staff = staffList();
  const paid = balances(S.trip.expenses, S.trip.families).rows;
  const days = tournamentDays(t.start_date, t.end_date);
  const ro = final();
  const row = f => {
    const fencers = f.people.filter(p => p.is_fencer), flags = familyFlags(f);
    const words = [f.name, ...f.people.map(p => p.name)].join(" ").toLowerCase();
    return `<a class="famrow" href="#/t/${t.id}/f/${f.id}" data-search="${esc(words)}">
      <div class="grow"><div class="fam-name">${esc(f.name)}</div>
        <div class="fam-sum">${plural(f.people.length, "person", "people")}${fencers.map(p => ` · ${esc(p.name)} fences ${esc(daysSummary(p.fencing_days))}`).join("")}</div>
        ${flags.length ? `<div class="fam-flag">${icon("flag")} ${esc(flags.join("; "))}</div>` : ""}</div>${icon("chev")}</a>`;
  };
  const totalPeople = families.reduce((n, f) => n + f.people.length, 0);
  el.innerHTML = `
    ${families.length ? `<div class="card ledger">
      <div class="head"><h2 style="border:0;padding:0;margin:0">${plural(families.length, "family", "families")} · ${plural(totalPeople, "person", "people")}</h2>
        ${ro ? "" : `<button class="btn-primary btn-small" data-act="add-family">${icon("plus")} Add family</button>`}</div>
      ${families.length > 8 ? `<input id="famsearch" type="search" placeholder="Find a family or person" aria-label="Find a family or person" style="margin-bottom:6px">` : ""}
      <div id="famlist">${families.map(row).join("")}</div>
      <p class="faint small" id="nomatch" hidden>No family or person matches that.</p>
    </div>
    <div class="card"><div class="head"><h2 style="border:0;padding:0;margin:0">Coaches & staff</h2>
        ${ro ? "" : `<button class="btn-ghost btn-small" data-act="add-staff">${icon("plus")} Add</button>`}</div>
      <p class="muted small" style="margin-top:-4px">They travel with the team and never share the costs. If they pay for something, like the coach's own hotel, the treasurer pays them back.</p>
      ${staff.map(f => `<a class="famrow" href="#/t/${t.id}/f/${f.id}"><div class="grow"><div class="fam-name">${esc(famLabel(f))}</div>
        <div class="fam-sum">${paid[f.id]?.paid ? `Paid ${money(paid[f.id].paid)} for the team, paid back by the treasurer` : "Hasn't paid for anything yet"}</div></div>${icon("chev")}</a>`).join("")
        || `<p class="faint small" style="margin:0">None added yet.</p>`}</div>
    <div class="card"><div class="head"><h2 style="border:0;padding:0;margin:0">Fencing days</h2><a class="btn btn-ghost btn-small" href="#/t/${t.id}/fencing">Open</a></div>
      <p class="muted small" style="margin:6px 0 0">Every fencer and the days they fence, on one screen. The coach's hotel and own meals are split by these, so check them before finalizing.</p></div>`
    : `<div class="card empty"><div class="ic">${icon("users")}</div><b>No families yet</b>Add each family going on this trip. You'll add who's in it, who's fencing, and the days each fencer competes.
        ${ro ? "" : `<div class="row-actions"><button class="btn-primary" data-act="add-family">${icon("plus")} Add family</button></div>`}</div>`}
    ${ro ? "" : `<details class="card"><summary>Trip details</summary>
      <form id="tripedit">
        <label class="f" for="en">Tournament</label><input id="en" value="${esc(t.name)}" required>
        <label class="f" for="el">Where <span class="opt">(optional)</span></label><input id="el" value="${esc(t.location)}">
        <div class="two"><div><label class="f" for="es">First day</label><input id="es" type="date" value="${t.start_date}" required></div>
          <div><label class="f" for="ee">Last day</label><input id="ee" type="date" value="${t.end_date}" required></div></div>
        <p class="hint">Shortening the trip removes the dropped days from everyone's fencing days.</p>
        <div class="row-actions"><button class="btn-primary">Save details</button>${t.is_sandbox ? "" : `<button type="button" class="btn-danger" data-act="del-trip">Delete trip</button>`}</div>
      </form></details>`}`;
  const search = document.getElementById("famsearch");
  if (search) search.oninput = () => {
    const q = search.value.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll("#famlist .famrow").forEach(a => { const hit = !q || a.dataset.search.includes(q); a.hidden = !hit; shown += hit; });
    document.getElementById("nomatch").hidden = shown > 0;
  };
  const te = document.getElementById("tripedit");
  if (te) te.onsubmit = async ev => {
    ev.preventDefault();
    const start = document.getElementById("es").value, end = document.getElementById("ee").value;
    // Shortening the trip takes the dropped days off everyone, for good: say who, and ask.
    const gone = d => d < start || d > end;
    const lose = S.trip.families.flatMap(f => f.people).filter(p => p.is_fencer && p.fencing_days.some(gone));
    const dated = S.trip.expenses.filter(e => e.date && gone(e.date));
    if ((lose.length || dated.length) && !(await confirmSheet("Shorten the trip?",
      `${lose.length ? `${esc(lose.slice(0, 3).map(p => p.name).join(", "))}${lose.length > 3 ? ` and ${lose.length - 3} more` : ""} will lose fencing days outside the new dates, and the coach's costs are split again. ` : ""}${dated.length ? `${plural(dated.length, "expense is", "expenses are")} dated outside them. ` : ""}Moving the dates back later won't put those days back.`,
      "Shorten the trip"))) return;
    await act(() => api(`/tournaments/${t.id}`, { method: "PATCH", body: {
      name: document.getElementById("en").value, location: document.getElementById("el").value,
      start_date: start, end_date: end, seen_start: t.start_date, seen_end: t.end_date } }), "Saved");
    refresh("families");
  };
}

async function addFamily({ mine = false } = {}) {
  const t = S.trip.tournament;
  const v = await sheet({
    title: mine ? "Add your family" : "Add a family", ok: "Next",
    lead: "Next you'll add the people in it, and who's fencing.",
    body: `<label class="f" for="nf">Family name</label><input id="nf" name="name" placeholder="e.g. Bennett" required autocomplete="family-name">`,
  });
  if (!v) return;
  const r = await act(() => api(`/tournaments/${t.id}/families`, { method: "POST", body: { name: v.name } }));
  if (mine) setMe(String(r.id));
  location.hash = `#/t/${t.id}/f/${r.id}${mine ? "?mine=1" : ""}`;
}

// ---------- manage one family ----------
function renderFamily(fid, focusSel) {
  const { tournament: t } = S.trip;
  const f = S.trip.families.find(x => x.id === fid);
  if (!f) { location.hash = `#/t/${t.id}?tab=families`; return; }
  const ro = final();
  if (f.kind === "staff") return renderStaff(f, focusSel);
  const days = tournamentDays(t.start_date, t.end_date);
  const chips = (list, attrs, { fence, label } = {}) => `<div class="days-sum" aria-hidden="true">${esc(daysSummary(list))}</div>
    <div class="days${fence ? " fence" : ""}" role="group" aria-label="${esc(label || "Days")}">${days.map(d => {
    const on = list.includes(d);
    return `<button type="button" class="${on ? "on" : ""}" ${attrs} data-day="${d}" aria-pressed="${on}" ${ro ? "disabled" : ""}>${esc(dayShort(d))}</button>`;
  }).join("")}</div>`;
  const mineNote = new URLSearchParams(location.hash.split("?")[1] || "").get("mine");
  const person = p => `
    <div class="person-block" data-person="${p.id}">
      <div class="person-row">
        <input class="pname" data-pname="${p.id}" value="${esc(p.name)}" aria-label="${esc(p.name)}'s name" ${ro ? "disabled" : ""}>
        <label class="switch small-switch"><input type="checkbox" data-fencer="${p.id}" ${p.is_fencer ? "checked" : ""} ${ro ? "disabled" : ""}> Fencer</label>
        ${ro ? "" : `<button class="link danger small" data-act="remove-person" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>`}
      </div>
      ${p.is_fencer ? `<div class="sub-label">Fences on <span class="opt">(the days they actually compete)</span></div>${chips(p.fencing_days, `data-fence="${p.id}"`, { fence: true, label: `${p.name} fences on` })}
        ${!p.fencing_days.length ? `<p class="hint owe">Tick the days ${esc(p.name)} competes. With none, they pay nothing toward the coach's hotel and meals.</p>` : ""}` : ""}
    </div>`;
  app.innerHTML = `${bar({ back: `#/t/${t.id}?tab=families`, title: `${f.name} family`, sub: t.name, right: `<span class="saved" id="savestate" role="status" aria-live="polite"></span>` })}
    <div class="wrap">
      ${mineNote ? `<div class="callout good" style="margin-bottom:12px">This is your family on this phone. Add everyone who's going, and tick the days each fencer competes.</div>` : ""}
      ${ro ? `<div class="callout" style="margin-bottom:12px">This trip is final, so only payment details can change. Reopen it from Settle up to change anything else.</div>` : ""}
      <div class="stack">
      <div class="card">
        <label class="f" for="fam-name" style="margin-top:0">Family name</label><input id="fam-name" value="${esc(f.name)}" ${ro ? "disabled" : ""}>
        <label class="f" for="fam-pay">If this family ends up owed money, how should the treasurer send it? <span class="opt">(optional)</span></label>
        <input id="fam-pay" value="${esc(f.pay_notes)}" placeholder="e.g. Venmo @laura-bennett or Zelle 614-555-0123">
      </div>
      <div class="card ledger"><h2>People <span class="faint small" style="font-family:inherit;font-weight:500">${f.people.length}</span></h2>
        <p class="muted small" style="margin-top:-4px">Everyone going: fencers, parents, siblings, grandparents. Their number is the head count a team meal starts with. Changes save as you go.</p>
        ${f.people.map(person).join("") || `<p class="faint">Nobody added yet.</p>`}
        ${ro ? "" : `<form id="addperson" class="addperson">
          <input id="newname" placeholder="Add a person: first name" aria-label="New person's first name" autocomplete="off">
          <label class="switch small-switch"><input type="checkbox" id="newfencer"> Fencer</label>
          <button class="btn-primary btn-small">${icon("plus")} Add</button></form>`}
      </div>
      ${ro ? "" : `<button class="btn-danger btn-block" data-act="remove-family" data-id="${f.id}">Remove the ${esc(f.name)} family from this trip</button>`}
      <a class="btn btn-ghost btn-block" href="#/t/${t.id}?tab=families">Done</a>
    </div></div>`;
  wireFamily(f);
  if (focusSel) restoreFocus(focusSel);
}

function renderStaff(f, focusSel) {
  const { tournament: t } = S.trip, ro = final();
  const paid = balances(S.trip.expenses, S.trip.families).rows[f.id]?.paid || 0;
  app.innerHTML = `${bar({ back: `#/t/${t.id}?tab=families`, title: famLabel(f), sub: t.name, right: `<span class="saved" id="savestate" role="status" aria-live="polite"></span>` })}
    <div class="wrap"><div class="stack">
      <div class="callout">Coaches and staff never share the trip's costs. Anything they pay for the team is paid back to them by the treasurer.${paid ? ` So far: <b>${money(paid)}</b>.` : ""}</div>
      <div class="card">
        <label class="f" for="st-name" style="margin-top:0">Name</label><input id="st-name" value="${esc(f.name)}" ${ro ? "disabled" : ""}>
        <label class="f" for="st-role">Role</label><input id="st-role" value="${esc(f.role)}" placeholder="Coach, Assistant coach, Armorer…" ${ro ? "disabled" : ""}>
        <label class="f" for="fam-pay">How should the treasurer pay them back? <span class="opt">(optional)</span></label>
        <input id="fam-pay" value="${esc(f.pay_notes)}" placeholder="e.g. Zelle 614-555-0150">
        <p class="hint">Changes save as you go.</p>
      </div>
      ${ro ? "" : `<button class="btn-danger btn-block" data-act="remove-family" data-id="${f.id}">Remove ${esc(famLabel(f))} from this trip</button>`}
      <a class="btn btn-ghost btn-block" href="#/t/${t.id}?tab=families">Done</a>
    </div></div>`;
  const save1 = (id, key) => { const el = document.getElementById(id); if (el) el.onchange = () => (key !== "name" || el.value.trim()) && famSave(f.id, () => api(`/families/${f.id}`, { method: "PATCH", body: { [key]: el.value } })); };
  save1("st-name", "name"); save1("st-role", "role"); save1("fam-pay", "pay_notes");
  if (focusSel) restoreFocus(focusSel);
}

async function addStaff({ mine = false } = {}) {
  const t = S.trip.tournament;
  const v = await sheet({
    title: mine ? "Add yourself as coach or staff" : "Add a coach or staff member", ok: "Add",
    lead: "Coaches and staff never share the costs. If they pay for something for the team, the treasurer pays them back.",
    body: `<label class="f" for="sn">Name</label><input id="sn" name="name" placeholder="e.g. Mike Torres" required>
      <label class="f" for="sr">Role</label><input id="sr" name="role" value="Coach">
      <label class="f" for="sp">How should the treasurer pay them back? <span class="opt">(optional)</span></label><input id="sp" name="pay_notes" placeholder="e.g. Zelle 614-555-0150">`,
  });
  if (!v) return;
  const r = await act(() => api(`/tournaments/${t.id}/families`, { method: "POST", body: { ...v, kind: "staff" } }), "Added");
  if (mine) { setMe(String(r.id)); location.hash = `#/t/${t.id}`; return refresh("expenses"); }
  refresh("families");
}

async function pickStaff() {
  const staff = staffList();
  if (!staff.length) return addStaff({ mine: true });
  const v = await sheet({
    title: "Which one are you?", ok: "That's me",
    body: `<div class="choices">${staff.map((f, i) => `<label class="choice ${i ? "" : "on"}"><input type="radio" name="sid" value="${f.id}" ${i ? "" : "checked"} class="visually-hidden"><span class="dot"></span><span><b>${esc(famLabel(f))}</b></span></label>`).join("")}</div>
      <p class="hint">Not listed? <button type="button" class="link small" data-sheet-act="add">Add yourself</button></p>`,
    onOpen: form => form.querySelectorAll(".choice").forEach(c => c.onclick = () => { form.querySelectorAll(".choice").forEach(x => x.classList.toggle("on", x === c)); c.querySelector("input").checked = true; }),
  });
  if (!v) return;
  if (v.action === "add") return addStaff({ mine: true });
  setMe(v.sid);
  toast(`Showing ${famName(v.sid)}. Tap "Change" to switch.`);
  renderTrip(tabNow(), '[data-act="pick-me"][data-id=""]');
}

// Every change on the Manage family screen saves immediately. Saves run one
// after another (quick taps queue up), and the screen redraws once they're done.
let famQueue = Promise.resolve(), famPending = 0, famFailed = false;
const hashPath = () => location.hash.split("?")[0];
const onFamily = (tid, fid) => hashPath() === `#/t/${tid}/f/${fid}`;
function famSave(fid, call, msg = "Saved", focusAfter) {
  const st = () => document.getElementById("savestate");
  if (st()) st().textContent = "Saving…";
  famPending++;
  famQueue = famQueue.then(() => act(call)).catch(() => { famFailed = true; }).then(async () => {
   try {
    if (--famPending) return;
    const failed = famFailed; famFailed = false;
    // If they've already left this screen (tapped Done or Back while a save was
    // still going), don't drag them back: the new screen loads fresh data itself.
    const here = () => onFamily(S.trip.tournament.id, fid);
    if (!here()) return;
    await loadTrip(S.trip.tournament.id);
    if (!here()) return;
    // Text not yet saved (a field still being typed in, the new person's name)
    // survives the redraw. Read just before it, so nothing typed meanwhile is lost.
    // Only text not yet sent survives the redraw: the field they're typing in (its
    // save goes when they leave it) and a new person's name not yet added. A field
    // they've left has already saved, so it shows what the server kept; nothing is
    // ever re-sent from here.
    const keepIds = ["fam-name", "fam-pay", "st-name", "st-role"];
    const act0 = document.activeElement;
    const typing = act0 && (keepIds.includes(act0.id) || act0.dataset?.pname || act0.id === "newname");
    const typed = typing && act0.id !== "newname" ? [act0.id ? `#${act0.id}` : `[data-pname="${act0.dataset.pname}"]`, act0.value] : null;
    const newName = document.getElementById("newname")?.value;
    const fencerTicked = document.getElementById("newfencer")?.checked;
    renderFamily(fid, typing ? focusKey() : focusAfter || focusKey());
    if (typed) { const el = document.querySelector(typed[0]); if (el) el.value = typed[1]; }
    if (newName && document.getElementById("newname")) document.getElementById("newname").value = newName;
    if (fencerTicked != null && document.getElementById("newfencer")) document.getElementById("newfencer").checked = fencerTicked;
    // A failed save already said why in a toast; the redraw shows what really stuck.
    if (st()) { st().textContent = failed ? "" : `✓ ${typeof msg === "function" ? msg() : msg}`; setTimeout(() => { if (st()) st().textContent = ""; }, 2500); }
   } catch (e) { console.error(e); if (st()) st().textContent = ""; }     // a failed reload must not block later saves
  });
  return famQueue;
}

function wireFamily(f) {
  const root = app, fid = f.id;
  // Flip the tapped button now, then send what the whole row shows, so quick
  // taps each build on the last instead of on the page as first drawn.
  const name = document.getElementById("fam-name"), pay = document.getElementById("fam-pay");
  if (name) name.onchange = () => name.value.trim() && famSave(fid, () => api(`/families/${fid}`, { method: "PATCH", body: { name: name.value } }));
  if (pay) pay.onchange = () => famSave(fid, () => api(`/families/${fid}`, { method: "PATCH", body: { pay_notes: pay.value } }));
  // Each tap sends one change ("add Saturday"), so a screen left open on another
  // phone can't overwrite fencing days someone set since.
  const flipBtn = b => { b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); return b.classList.contains("on"); };
  root.querySelectorAll("[data-fence]").forEach(b => b.onclick = () => {
    const on = flipBtn(b);
    famSave(fid, () => api(`/people/${b.dataset.fence}`, { method: "PATCH", body: { fencing_day: b.dataset.day, on } }));
  });
  root.querySelectorAll("[data-fencer]").forEach(c => c.onchange = () =>
    famSave(fid, () => api(`/people/${c.dataset.fencer}`, { method: "PATCH", body: { is_fencer: c.checked } })));
  root.querySelectorAll("[data-pname]").forEach(i => i.onchange = () => i.value.trim() &&
    famSave(fid, () => api(`/people/${i.dataset.pname}`, { method: "PATCH", body: { name: i.value } })));
  const add = document.getElementById("addperson");
  if (add) add.onsubmit = async ev => {
    ev.preventDefault();
    if (add.dataset.busy) return;                         // a double tap adds one person, not two
    const n = document.getElementById("newname").value.trim();
    if (!n) { document.getElementById("newname").focus(); return toast("Type a first name"); }
    add.dataset.busy = "1"; add.querySelector("button").disabled = true;
    document.getElementById("newname").value = "";
    const fencer = document.getElementById("newfencer").checked;
    let failed = false;
    let already = false;
    await famSave(fid, () => api(`/families/${fid}/people`, { method: "POST", body: { name: n, is_fencer: fencer } }).then(r => { already = !!r.already; return r; }).catch(e => { failed = true; throw e; }),
      () => already ? `${n} was already added (an earlier try went through)` : `${n} added`);
    // The reply was lost, but the screen has reloaded: if they're there, it worked.
    const slot = addSlot(`/families/${fid}/people`, { name: n, is_fencer: fencer });
    const k = failed && pendingAddKey(slot);
    if (k && S.trip.families.some(f => f.people.some(p => p.client_key === k))) {
      forgetAddKey(slot); toast(`${n} was added after all.`); failed = false;
    }
    // Not added: put back what they typed so they can try again.
    if (failed && onFamily(S.trip.tournament.id, fid) && document.getElementById("newname") && !document.getElementById("newname").value) { document.getElementById("newname").value = n; document.getElementById("newfencer").checked = fencer; }
    // The screen wasn't redrawn (no signal for the reload): let them try again.
    if (document.getElementById("addperson") === add) { delete add.dataset.busy; add.querySelector("button").disabled = false; }
    document.getElementById("newname")?.focus();
  };
}

// ---------- fencing days, every fencer on one screen ----------
// The coach's hotel and own meals are split by these, so the treasurer checks them
// here before finalizing. Each tap saves one day, like on the family screen.
function renderFencing() {
  const { tournament: t } = S.trip;
  const days = tournamentDays(t.start_date, t.end_date), ro = final();
  const fams = realFamilies().map(f => ({ f, fencers: f.people.filter(p => p.is_fencer) })).filter(x => x.fencers.length);
  const n = fams.reduce((k, x) => k + x.fencers.reduce((m, p) => m + p.fencing_days.length, 0), 0);
  const none = fams.flatMap(x => x.fencers).filter(p => !p.fencing_days.length);
  app.innerHTML = `${bar({ back: `#/t/${t.id}?tab=families`, title: "Fencing days", sub: t.name, right: `<span class="saved" id="savestate" role="status" aria-live="polite"></span>` })}
    <div class="wrap"><div class="stack">
      <div class="card you" style="border-top-width:4px"><div class="big" style="font-size:22px">${plural(n, "fencing day", "fencing days")}</div>
        <div class="muted small">The coach's hotel, getting around and own meals are split by these: each day a fencer competes is one share.</div></div>
      ${none.length ? `<div class="callout warn">${esc(none.map(p => p.name).join(", "))} ${none.length > 1 ? "have" : "has"} no fencing days ticked, so ${none.length > 1 ? "they pay" : "pays"} nothing toward the coach's hotel and meals.</div>` : ""}
      <div class="card ledger">${fams.map(({ f, fencers }) => `<div class="person-block"><div class="fam-name"><a href="#/t/${t.id}/f/${f.id}">${esc(f.name)}</a></div>
        ${fencers.map(p => `<div class="sub-label">${esc(p.name)}</div><div class="days fence" role="group" aria-label="${esc(p.name)} fences on">${days.map(d => {
          const on = p.fencing_days.includes(d);
          return `<button type="button" class="${on ? "on" : ""}" data-fence="${p.id}" data-day="${d}" aria-pressed="${on}" ${ro ? "disabled" : ""}>${esc(dayShort(d))}</button>`;
        }).join("")}</div>`).join("")}</div>`).join("") || `<p class="faint">No fencers yet. Tick Fencer for someone on their family's screen.</p>`}</div>
    </div></div>`;
  app.querySelectorAll("[data-fence]").forEach(b => b.onclick = () => {
    b.classList.toggle("on"); const on = b.classList.contains("on"); b.setAttribute("aria-pressed", on);
    fencingSave(() => api(`/people/${b.dataset.fence}`, { method: "PATCH", body: { fencing_day: b.dataset.day, on } }));
  });
}
// Taps save one after another; after the last, the screen shows what the trip now says.
let fenceQueue = Promise.resolve(), fencePending = 0;
function fencingSave(call) {
  const st = () => document.getElementById("savestate");
  if (st()) st().textContent = "Saving…";
  fencePending++;
  fenceQueue = fenceQueue.then(() => act(call)).catch(() => {}).then(async () => {
    if (--fencePending) return;
    const here = () => hashPath() === `#/t/${S.trip.tournament.id}/fencing`;
    try { if (here()) { await loadTrip(S.trip.tournament.id); if (here()) { renderFencing(); if (st()) st().textContent = "✓ Saved"; } } }
    catch (e) { if (st()) st().textContent = ""; }
  });
  return fenceQueue;
}

// ---------- expense editor ----------
const BASIS_HELP = {
  took_part: "Only the families ticked pay, by how many of each came. The coach's share is covered by whoever went.",
  per_fencer: "Every fencer on the trip pays the same share, however many days they fence.",
  fencer_day: "Each day a fencer competes is one share, across the whole trip.",
};
// Old kinds of expense (from before the three splits) still show, as Other.
const catOf = e => CATEGORIES[e.category] || CATEGORIES.other;

function renderEditor(id) {
  const { tournament: t, families, expenses } = S.trip;
  const e = id ? expenses.find(x => x.id === id) : null;
  if (final()) { if (e) return renderExpenseView(e); location.hash = `#/t/${t.id}`; return; }
  if (id && !e) { location.hash = `#/t/${t.id}`; return; }
  if ((!S.draft || S.draft.id !== (id || 0)) && (S.draft = keptDraft(t.id, id || 0))) toast("Picked up where you left off.");
  // A draft kept from before the three splits takes today's kinds.
  if (S.draft && !CATEGORIES[S.draft.category]) S.draft.category = "other";
  if (S.draft && !BASES[S.draft.basis]) { S.draft.basis = CATEGORIES[S.draft.category].basis; S.draft.split = {}; }
  if (!S.draft || S.draft.id !== (id || 0)) {
    const me = myFamily();
    // A new expense starts as a team meal with nobody ticked: whoever enters it ticks who took part.
    S.draft = e ? { ...e, category: CATEGORIES[e.category] ? e.category : "other", basis: BASES[e.basis] ? e.basis : "took_part", split: { ...e.split },
        amount: (e.amount_cents / 100).toFixed(2), catTouched: true, dateTouched: true }
      : { id: 0, description: "", vendor: "", date: null, category: "meal", basis: "took_part", amount: "", paid_by: me && me !== "none" ? me.id : "", split: {}, receipt_key: null, receipt_type: null, client_key: crypto.randomUUID() };
  }
  const d = S.draft;
  const days = tournamentDays(t.start_date, t.end_date);
  app.innerHTML = `${bar({ back: `#/t/${t.id}`, title: id ? "Edit expense" : "Add expense", sub: t.name })}
    <form id="ex" class="wrap" novalidate><div class="card">
      <div class="section"><h2><span class="n">1</span>Receipt <span class="opt small">(optional)</span></h2><div id="rcpt"></div></div>
      <div class="section"><h2><span class="n">2</span>What was it?</h2>
        <label class="f" for="amt" style="margin-top:0">Amount</label>
        <div class="money-in"><span>$</span><input id="amt" inputmode="decimal" placeholder="0.00" value="${esc(d.amount)}" autocomplete="off"></div>
        <label class="f" for="desc">Description</label><input id="desc" value="${esc(d.description)}" placeholder="e.g. Team dinner, Coach hotel 3 nights">
        <label class="f" for="cat">What kind of cost?</label><select id="cat">
          ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${d.category === k ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <label class="f" for="day">Day <span class="opt">(for the record)</span></label><select id="day"><option value="">Whole trip, or more than one day</option>
          ${days.map(x => `<option value="${x}" ${d.date === x ? "selected" : ""}>${esc(dayLong(x))}</option>`).join("")}</select>
        <label class="f" for="vend">Store or restaurant <span class="opt">(optional)</span></label><input id="vend" value="${esc(d.vendor)}">
      </div>
      <div class="section"><h2><span class="n">3</span>Who paid?</h2>
        <div class="pills" id="paid" role="radiogroup" aria-label="Who paid">${families.map(f => `<button type="button" role="radio" aria-checked="${Number(d.paid_by) === f.id}" data-fam="${f.id}" class="${Number(d.paid_by) === f.id ? "on" : ""}">${esc(famLabel(f))}</button>`).join("")}</div>
      </div>
      <div class="section"><h2><span class="n">4</span>How is it shared?</h2>
        <div class="choices" id="basis" role="radiogroup" aria-label="How it's split"></div>
        <div id="split"></div>
        <p class="hint" id="splithint"></p>
      </div>
      ${id ? `<div class="section"><button type="button" class="btn-danger btn-block" data-act="del-expense" data-id="${id}">Delete this expense</button>
        <p class="hint" style="text-align:center">Added by ${esc(e.created_by)}${e.updated_by ? ` · last changed by ${esc(e.updated_by)}` : ""}</p></div>` : ""}
    </div></form>
    <div class="savebar"><div class="in"><div class="sum" id="sum"></div><button class="btn-primary" form="ex" id="save">${id ? "Save changes" : "Save expense"}</button></div></div>`;

  const $ = s => document.getElementById(s);
  const pull = () => { d.amount = $("amt").value; d.description = $("desc").value; d.vendor = $("vend").value; };
  ["amt", "desc", "vend"].forEach(k => $(k).addEventListener("input", () => { pull(); drawSplit(); }));
  $("day").onchange = () => { d.date = $("day").value || null; d.dateTouched = true; };
  $("cat").onchange = () => { d.category = $("cat").value; d.catTouched = true; followCategory(d); drawSplit(); };
  $("paid").onclick = ev => { const b = ev.target.closest("[data-fam]"); if (!b) return; d.paid_by = Number(b.dataset.fam); markPaid(); drawSplit(); };
  $("basis").onclick = ev => { const b = ev.target.closest("[data-basis]"); if (!b || b.dataset.basis === d.basis) return; d.basis = b.dataset.basis; drawSplit(); };
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
      <p class="muted" style="margin-top:6px">${esc(famName(e.paid_by))} paid · ${esc(catOf(e).label)}${e.vendor ? ` · ${esc(e.vendor)}` : ""}</p>
      ${e.receipt_key ? `<div class="receipt" style="margin:12px 0">${e.receipt_type === "application/pdf" ? `<div class="pdf">PDF</div>` : `<img src="/api/receipts/${esc(e.receipt_key)}" alt="Receipt photo">`}
        <a href="/api/receipts/${esc(e.receipt_key)}" target="_blank" rel="noopener">View receipt</a></div>` : `<p class="faint small">No receipt was added.</p>`}
      <h2 style="margin-top:16px">How it was split</h2><p class="muted small">${BASES[e.basis] ? `${BASES[e.basis].label}: ${esc(BASIS_HELP[e.basis])}` : "An older way of splitting."}</p>
      <table class="t">${Object.keys(s.shares).map(id => `<tr><td>${esc(famName(id))}<div class="faint small">${s.units[id]} of ${plural(s.total, BASES[e.basis]?.unit || "share", BASES[e.basis]?.units || "shares")}</div></td><td class="n">${money(s.shares[id])}</td></tr>`).join("")}
        <tr><td><b>Total</b></td><td class="n"><b>${money(e.amount_cents)}</b></td></tr></table>
      <p class="hint">Added by ${esc(e.created_by)}${e.updated_by ? ` · last changed by ${esc(e.updated_by)}` : ""}. This trip is final; reopen it from Settle up to change anything.</p>
    </div></div>`;
}

function markPaid() {
  document.querySelectorAll("#paid [data-fam]").forEach(b => { const on = Number(b.dataset.fam) === Number(S.draft.paid_by); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
}
// The kind of cost fixes the split; only Other lets them choose. Head counts ticked
// so far are kept, so switching kinds and back doesn't lose them.
function followCategory(d) {
  d.basis = CATEGORIES[d.category].basis;          // Other starts on who took part
}
function cents(v) {
  let s = String(v).replace(/[$\s]/g, "");
  // A comma before the last one or two digits is a decimal comma ("12,50", "12,5", "1.250,00");
  // otherwise commas group thousands ("1,250").
  s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Math.round(parseFloat(s) * 100); return Number.isFinite(n) ? n : 0;
}

function drawSplit() {
  const d = S.draft, families = realFamilies();
  const el = document.getElementById("split"); if (!el) return;
  const c = CATEGORIES[d.category];
  // Only Other offers a choice; every other kind says how it's split.
  document.getElementById("basis").innerHTML = c.choose ? Object.entries(BASES).map(([k, b]) => `
    <button type="button" class="choice ${d.basis === k ? "on" : ""}" data-basis="${k}" role="radio" aria-checked="${d.basis === k}">
      <span class="dot"></span><span><b>${b.label}</b><small>${BASIS_HELP[k]}</small></span></button>`).join("")
    : `<p class="muted small" style="margin:0 0 8px"><b>${BASES[d.basis].label}.</b> ${BASIS_HELP[d.basis]}</p>`;
  const amount = cents(d.amount);
  const s = shares({ ...d, amount_cents: amount }, families);
  const unit = n => plural(n, BASES[d.basis].unit, BASES[d.basis].units);
  const took = d.basis === "took_part";
  el.innerHTML = `${took && families.length ? `<div class="head" style="margin:0 0 6px"><span class="f" style="margin:0">Who took part?</span>
      <button type="button" class="link small" data-everyone>Tick everyone</button></div>` : ""}
    <div class="incl">${families.map(f => {
    const n = s.units[f.id] || 0, set = d.split[f.id];
    if (!took) return `<div class="r ${n ? "" : "off"}"><span class="nm">${esc(f.name)}</span><span class="faint small">${n ? unit(n) : d.basis === "per_fencer" ? "No fencers" : "No fencing days"}</span>
      <span class="amt">${n && amount ? money(s.shares[f.id]) : "—"}</span></div>`;
    const inc = set > 0;
    return `<div class="r ${inc ? "" : "off"}"><input type="checkbox" data-inc="${f.id}" ${inc ? "checked" : ""} aria-label="${esc(f.name)} took part">
      <span class="nm">${esc(f.name)}</span>
      <input type="number" min="1" max="50" step="1" inputmode="numeric" data-units="${f.id}" value="${inc ? set : ""}" ${inc ? "" : "disabled"} aria-label="How many from ${esc(f.name)}">
      <span class="amt">${!inc ? `<span class="faint small">Didn't take part</span>` : amount ? money(s.shares[f.id]) : "—"}</span></div>`;
  }).join("") || `<p class="faint">No families on the trip yet.</p>`}<div class="tot"><span>${unit(s.total)}</span><span>${s.total && amount ? `${money(Math.round(amount / s.total))} each` : ""}</span></div></div>`;
  document.getElementById("splithint").textContent = took
    ? "Tick each family that took part. The number starts at the family's size; change it if only some of them came."
    : d.basis === "per_fencer" ? "Filled in from the fencers on the trip. Nothing to tick." : "Filled in from each fencer's fencing days (Families, then Fencing days). Nothing to tick.";
  document.getElementById("sum").innerHTML = amount
    ? `<b>${money(amount)}</b>${s.total ? `split between ${plural(Object.keys(s.units).length, "family", "families")}` : `<span class="owe">${took ? "Tick who took part" : "Nobody to split it among yet"}</span>`}`
    : `<b>Enter the amount</b>then pick who paid`;
  // Ticking a family starts it at its size (at least 1); unticking leaves it out.
  const start = f => Math.min(50, Math.max(1, familySize(f)));
  el.onclick = ev => {
    if (!ev.target.closest("[data-everyone]")) return;
    for (const f of families) if (!(d.split[f.id] > 0)) d.split[f.id] = start(f);
    drawSplit();
  };
  el.onchange = ev => {
    const c = ev.target.closest("[data-inc]");
    if (!c) { const u = ev.target.closest("[data-units]"); if (u && !(Number(u.value) >= 1)) drawSplit(); return; }   // left empty: show the count that stands
    const f = families.find(x => x.id === Number(c.dataset.inc));
    if (c.checked) d.split[c.dataset.inc] = start(f); else delete d.split[c.dataset.inc];
    drawSplit();
    el.querySelector(`[data-${c.checked ? "units" : "inc"}="${c.dataset.inc}"]`)?.focus();
  };
  el.oninput = ev => {
    const u = ev.target.closest("[data-units]"); if (!u) return;
    const n = Math.floor(Number(u.value));
    if (!(n >= 1)) return;                  // clearing a count to retype it: wait for the number
    d.split[u.dataset.units] = Math.min(50, n);
    let pos = null; try { pos = u.selectionStart; } catch {}
    drawSplit();
    const again = el.querySelector(`[data-units="${u.dataset.units}"]`); again.focus(); if (pos != null) try { again.setSelectionRange(pos, pos); } catch {}
  };
}

function drawReceipt(state = "") {
  const d = S.draft, el = document.getElementById("rcpt"); if (!el) return;
  const t = S.trip.tournament;
  if (d.receipt_key) {
    const thumb = d.receipt_type === "application/pdf" ? `<div class="pdf">PDF</div>` : `<img src="/api/receipts/${esc(d.receipt_key)}" alt="Receipt photo">`;
    el.innerHTML = `<div class="receipt">${thumb}<div style="flex:1">
        <a href="/api/receipts/${esc(d.receipt_key)}" target="_blank" rel="noopener">View receipt</a><br>
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
  const stillHere = () => S.draft === d && document.getElementById("rcpt");   // they may have left the form
  d.uploading = true;
  drawReceipt("uploading");
  try {
    if (file.size > 10 * 1024 * 1024 && file.type === "application/pdf") throw new Error("That PDF is over 10 MB");
    const blob = await shrink(file);
    const r = await api(`/tournaments/${tid}/receipts`, { method: "POST", body: blob, headers: { "content-type": blob.type } });
    d.receipt_key = r.key; d.receipt_type = r.type; d.aiNote = "";
    if (!stillHere()) { d.uploading = false; return; }
    drawReceipt("reading");
    try { const f = await api(`/tournaments/${tid}/read-receipt`, { method: "POST", body: { key: r.key } }); if (stillHere()) fillFromReceipt(f, d); }
    catch (e) { if (e instanceof AuthError) throw e; d.aiNote = e.unsure ? "Couldn't read the receipt just now. Fill in the form by hand." : e.message; }
    finally { d.uploading = false; }
  } catch (e) {
    d.uploading = false;
    if (e instanceof AuthError) return renderLogin();
    if (stillHere()) toast(e.unsure ? "The photo didn't upload. You can save without it, and add it when you have signal." : e.message);
  }
  if (stillHere()) drawReceipt();
}

function fillFromReceipt(f, d = S.draft) {
  const $ = s => document.getElementById(s);
  const days = tournamentDays(S.trip.tournament.start_date, S.trip.tournament.end_date);
  if (f.total != null && !cents(d.amount)) { d.amount = f.total.toFixed(2); $("amt").value = d.amount; }
  if (f.description && !d.description) { d.description = f.description; $("desc").value = d.description; }
  if (f.vendor && !d.vendor) { d.vendor = f.vendor; $("vend").value = d.vendor; }
  // Only fill what they haven't chosen themselves.
  if (f.category && Object.hasOwn(CATEGORIES, f.category) && !d.catTouched) { d.category = f.category; $("cat").value = f.category; followCategory(d); }
  if (f.date && days.includes(f.date) && !d.dateTouched) { d.date = f.date; $("day").value = f.date; }
  const out = f.date && !days.includes(f.date) ? ` The receipt is dated ${f.date}, which is outside the trip.` : "";
  d.aiNote = `We filled in the form from the receipt. Check the amount and the kind of cost (it decides who pays) before saving.${out}${f.notes ? " Note: " + f.notes : ""}`;
  drawSplit();
}

// ---------- expenses waiting on this phone ----------
// A new expense saved with no answer from the app waits here, sent by itself when there's
// a signal. Its key means sending it twice adds it once. One storage entry per expense, so
// two tabs can't write over each other's. It can be removed, not edited.
const WAIT = "efc-wait-";
function waiting(tid) {
  const out = [];
  try {
    const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    for (const k of keys) if (k?.startsWith(WAIT)) { const w = JSON.parse(localStorage.getItem(k)); if (w && (tid == null || w.trip === tid)) out.push(w); }
  } catch {}
  return out.sort((a, b) => a.at - b.at);
}
function keepWaiting(w) { try { localStorage.setItem(WAIT + w.key, JSON.stringify(w)); return true; } catch { return false; } }
const isWaiting = key => { try { return !!localStorage.getItem(WAIT + key); } catch { return false; } };
function dropWaiting(key) { try { localStorage.removeItem(WAIT + key); } catch {} }
// The one remembered expense from before this list existed joins it.
function migratePending() {
 try {
  const p = JSON.parse(localStorage.getItem("efc-pending-expense"));
  if (p?.d?.client_key && cents(p.d.amount) > 0) keepWaiting({ key: p.d.client_key, trip: p.trip, who: S.name, at: Date.now(),
    label: `${p.d.description || "Expense"}, ${money(cents(p.d.amount))}`,
    body: { description: p.d.description, vendor: p.d.vendor, date: p.d.date, category: p.d.category, basis: p.d.basis, amount_cents: cents(p.d.amount),
      paid_by: Number(p.d.paid_by), split: p.d.split, receipt_key: p.d.receipt_key, receipt_type: p.d.receipt_type, client_key: p.d.client_key } });
  localStorage.removeItem("efc-pending-expense");
 } catch {}
}

function holdExpense(t, who, body, from) {
  const w = { key: body.client_key, trip: t.id, who, at: Date.now(), label: `${body.description || CATEGORIES[body.category].label}, ${money(body.amount_cents)}`, body };
  if (!keepWaiting(w)) { toast("No signal, and this phone couldn't keep the expense. Try again when you have signal."); return false; }
  if (from) dropWaiting(from);
  toast(`No signal. ${w.label} is waiting on this phone and will be sent by itself.`);
  return true;
}

// The trip already has it (its reply was lost, and a later send or someone's reload saw it).
function settleWaiting() {
  for (const w of waiting(S.trip.tournament.id))
    if (S.trip.expenses.some(e => e.client_key === w.key)) { dropWaiting(w.key); toast(`${w.label} did save.`); }
}

let sending = false;
async function sendWaiting() {
  if (sending || !S.name) return;
  sending = true;
  let changed = false;
  try {
    for (const w of waiting()) {
      if (w.refused || !isWaiting(w.key)) continue;
      try { await api(`/tournaments/${w.trip}/expenses`, { method: "POST", body: w.body, who: w.who }); }
      catch (e) {
        if (e instanceof AuthError) break;          // logged out: wait until they're back in
        if (e.unsure) continue;                      // still no answer: next time
        if (isWaiting(w.key)) { keepWaiting({ ...w, refused: e.message }); toast(`${w.label} couldn't be sent: ${e.message}`); changed = true; }
        continue;
      }
      dropWaiting(w.key); toast(`${w.label} was sent.`); changed = true;
    }
  } finally { sending = false; }
  // Show it on the list or the trip it belongs to, without disturbing any other screen.
  if (!changed) return;
  if (/^#\/t\/\d+(\?|$)/.test(location.hash) && S.trip) refresh().catch(() => {});
  else if (!location.hash || location.hash === "#/") show();
}
setInterval(() => { if (!document.hidden && waiting().length) sendWaiting(); }, 30000);

// The expense being typed is kept for this browser tab, so a reload doesn't lose it.
const DRAFT = "efc-draft";
function keepDraft() { if (!S.draft || !S.trip) return; try { sessionStorage.setItem(DRAFT, JSON.stringify({ trip: S.trip.tournament.id, d: { ...S.draft, uploading: false } })); } catch {} }
function keptDraft(tid, id) { try { const k = JSON.parse(sessionStorage.getItem(DRAFT)); return k && k.trip === tid && k.d.id === id ? k.d : null; } catch { return null; } }
function dropDraft() { try { sessionStorage.removeItem(DRAFT); } catch {} }
// A new expense that needed a signal and didn't get one stays kept when they leave the form.
function leaveDraft() { S.draft = null; dropDraft(); }
document.addEventListener("input", () => keepDraft(), true);
document.addEventListener("change", () => keepDraft(), true);
document.addEventListener("click", () => setTimeout(keepDraft), true);

async function saveExpense() {
  const d = S.draft, t = S.trip.tournament;
  if (d.uploading) return toast("The receipt is still being uploaded and read. Save again in a moment.");
  const amount_cents = cents(d.amount);
  if (amount_cents <= 0) { document.getElementById("amt").focus(); return toast("Enter the amount"); }
  if (!d.paid_by) { document.getElementById("paid").scrollIntoView({ block: "center" }); return toast("Pick the family that paid"); }
  const s = shares({ ...d, amount_cents }, S.trip.families);
  if (!s.total) return toast(d.basis === "took_part" ? "Tick who took part" : d.basis === "per_fencer" ? "There are no fencers on the trip yet" : "No fencer has fencing days ticked yet");
  const payer = S.trip.families.find(f => f.id === Number(d.paid_by));
  const body = { description: d.description, vendor: d.vendor, date: d.date, category: d.category, basis: d.basis,
    amount_cents, paid_by: Number(d.paid_by), split: d.split, receipt_key: d.receipt_key, receipt_type: d.receipt_type, created_at: d.created_at, rev: d.rev, client_key: d.client_key,
    ...(!d.id && payer?.uid && { paid_by_uid: payer.uid }),
    // Family numbers can be reused after a delete, so the families ticked are named by their tags too.
    ...(d.basis === "took_part" && { split_uids: Object.fromEntries(Object.keys(d.split).map(id => [id, S.trip.families.find(f => f.id === Number(id))?.uid])) }) };
  // A new expense can wait on the phone for a signal; an edit needs one.
  const canWait = !d.id, who = whoNow();
  // A family added or removed on another phone since the form opened would be charged
  // or dropped without this form showing it: catch up, show it, and let them check.
  let fresh;
  try { fresh = await api(`/tournaments/${t.id}`); }
  catch (e) {
    if (e instanceof AuthError) return renderLogin();
    if (e.unsure && canWait) { if (holdExpense(t, who, body, d.fromWait) && S.draft === d) { S.draft = null; dropDraft(); location.hash = `#/t/${t.id}`; } return; }
    return toast(e.message);
  }
  // What the shares on this form were worked out from: for who took part, the families
  // ticked; otherwise the fencers and their fencing days.
  const whoIs = tr => JSON.stringify(d.basis === "took_part" ? Object.keys(d.split).map(id => [id, tr.families.find(f => f.id === Number(id))?.uid ?? null])
    : tr.families.filter(f => f.kind !== "staff").map(f => [f.id, f.people.filter(p => p.is_fencer).map(p => [p.id, p.fencing_days])]));
  if (S.draft !== d) return;
  if (whoIs(fresh) !== whoIs(S.trip)) {
    S.trip = fresh;
    renderEditor(d.id || null);
    return toast("Who's on the trip changed since you opened this. Check the shares, then save again.");
  }
  // The form is frozen while it sends: a change made meanwhile would be thrown away
  // when the save lands. Moving to another screen unfreezes it (see show()).
  const btn = document.getElementById("save"), label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Saving…`;
  app.inert = true;
  let r;
  try { r = d.id ? await api(`/expenses/${d.id}`, { method: "PATCH", body }) : await api(`/tournaments/${t.id}/expenses`, { method: "POST", body }); }
  catch (e) {
    if (e instanceof AuthError) return renderLogin();
    const here = S.draft === d;
    if (here) { app.inert = false; btn.disabled = false; btn.innerHTML = label; }
    // No answer: it may have saved. If it can wait, it waits (even if they've moved on).
    if (e.unsure && canWait) { if (holdExpense(t, who, body, d.fromWait) && S.draft === d) { S.draft = null; dropDraft(); location.hash = `#/t/${t.id}`; } return; }
    return toast(e.message);
  }
  // A retry of a save that had landed: it's on the trip as first sent.
  toast(r.already && !r.same ? "Your first save went through as it was then. Open it from the list to change it." : "Expense saved");
  if (d.fromWait) dropWaiting(d.fromWait);
  if (S.draft !== d) return;            // they've moved on to something else meanwhile
  S.draft = null; dropDraft();
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
  const total = Object.values(rows).reduce((s, r) => s + r.owed, 0);   // only expenses someone shares
  const todo = families.map(f => {
    const x = byFam.get(f.id);
    let what;
    if (t.treasurer_name && f.id === t.treasurer_family_id) what = rows[f.id].net > 0 ? `Keeps <b class="get">${money(rows[f.id].net)}</b> of what the treasurer collects (it's the treasurer's family)`
      : rows[f.id].net < 0 ? `Adds <b>${money(-rows[f.id].net)}</b> to what the treasurer collects (it's the treasurer's family)` : `<span class="muted">All square (the treasurer's family)</span>`;
    else if (!x) what = `<span class="muted">All square</span>`;
    else if (!t.treasurer_name) what = x.direction === "in" ? `Owes <b>${money(x.amount_cents)}</b>` : `Is owed <b>${money(x.amount_cents)}</b>`;
    else what = x.direction === "in" ? `Pays ${esc(t.treasurer_name)} <b>${money(x.amount_cents)}</b>` : `Gets <b class="get">${money(x.amount_cents)}</b> from ${esc(t.treasurer_name)}`;
    return `<div class="prow"><div class="grow"><b>${esc(famLabel(f))}</b><div class="small">${what}</div></div>${x && t.treasurer_name ? statusChip(x) : ""}</div>`;
  }).join("");
  const statement = f => {
    const lines = expenses.filter(e => perExpense[e.id].shares[f.id]).map(e => {
      const s = perExpense[e.id];
      return `<tr><td>${esc(e.description)}<div class="faint small">${s.units[f.id]} of ${plural(s.total, BASES[e.basis]?.unit || "share", BASES[e.basis]?.units || "shares")}</div></td><td class="n">${money(s.shares[f.id])}</td></tr>`;
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
    ${noFence.length ? `<div class="callout warn">${noFence.map(p => esc(p.name)).join(", ")} ${noFence.length > 1 ? "have" : "has"} no fencing days ticked, so ${noFence.length > 1 ? "they pay" : "pays"} nothing toward the coach's hotel and meals. <a href="#/t/${S.trip.tournament.id}/fencing">Check fencing days</a>.</div>` : ""}
    ${t.treasurer_name ? `<div class="card"><div class="eyebrow">Treasurer</div><h2 style="margin-top:4px">${esc(tname(t))}</h2>
        ${t.treasurer_notes ? `<div class="paynote"><b>Send money to:</b> ${esc(t.treasurer_notes)}</div>` : ""}</div>` : needTreasurerCallout(t)}
    <div class="card ledger"><h2>${final() ? "Who pays what" : "Who will pay what"}</h2>
      ${final() ? "" : `<p class="muted small" style="margin-top:-4px">This updates as expenses are added. It's fixed when the trip is finalized.</p>`}${todo || `<p class="faint">Add families first.</p>`}</div>
    <div class="card ledger"><h2>Balances</h2>
      <div class="table-scroll"><table class="t bal"><tr><th>Family</th><th class="n">Share</th><th class="n">Paid</th><th class="n">Balance</th></tr>
      ${families.map(f => { const r = rows[f.id]; return `<tr><td>${esc(famLabel(f))}</td><td class="n">${money(r.owed)}</td><td class="n">${money(r.paid)}</td>
        <td class="n ${r.net > 0 ? "get" : r.net < 0 ? "owe" : ""}"><b>${r.net > 0 ? "+" : ""}${money(r.net)}</b></td></tr>`; }).join("")}
        <tr><td><b>Total</b></td><td class="n"><b>${money(total)}</b></td><td class="n"><b>${money(total)}</b></td><td></td></tr></table></div>
      <p class="hint">Share is the family's part of every expense. Paid is what they put on their own card. A plus means they're owed money, a minus means they owe.</p></div>
    <div class="card ledger"><h2>Each family's breakdown</h2><p class="muted small" style="margin-top:-4px">Tap a family to see every expense they share and how much of it is theirs.</p>${families.filter(f => f.kind !== "staff").map(statement).join("")}</div>
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
  // If the treasurer's own family owes, they put that in themselves; count it as
  // collected so a fully settled trip doesn't look short.
  const own = mine < 0 ? -mine : 0;
  const hand = sum(ins, true) + own - sum(outs, true);
  el.innerHTML = `
    <div class="card"><div class="head" style="margin-bottom:4px"><div><div class="eyebrow">Treasurer</div><h2 style="margin-top:4px">${esc(tname(t))}</h2></div>
        <button class="btn-ghost btn-small" data-act="volunteer">${icon("edit")} Edit</button></div>
      <div class="paynote"><b>Families send money to:</b> ${t.treasurer_notes ? esc(t.treasurer_notes) : `<span class="owe">not added yet. Tap Edit and add your Venmo or Zelle.</span>`}</div></div>
    ${final() ? `<div class="card ledger"><h2>Progress</h2>
      <table class="t"><tr><td>Collected</td><td class="n"><b>${money(sum(ins, true))}</b> of ${money(sum(ins))}</td></tr>
        ${own ? `<tr><td>Your own family's part</td><td class="n"><b>${money(own)}</b></td></tr>` : ""}
        <tr><td>Paid out</td><td class="n"><b>${money(sum(outs, true))}</b> of ${money(sum(outs))}</td></tr>
        <tr><td>${hand >= 0 ? "In hand right now" : "Paid out ahead of collecting"}</td><td class="n"><b>${money(Math.abs(hand))}</b></td></tr></table>
      ${hand < 0 ? `<p class="hint">You've sent out more than you've collected so far. That's fine if you fronted it; it evens out as the remaining families pay.</p>` : ""}
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
        ${fams.filter(f => f.kind !== "staff").map(f => `<option value="${f.id}" ${famPick === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>
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
      case "rewait": {
        // A refused expense comes back into the form as a new one, to fix and save.
        const w = waiting().find(x => x.key === b.dataset.key); if (!w) return renderTrip(tabNow());
        const x = w.body;
        // From before the three splits it comes back as Other; a ticked family counts only if
        // it's still the same family (its number can have gone to another since).
        const category = CATEGORIES[x.category] ? x.category : "other";
        const same = id => !x.split_uids || S.trip.families.find(f => f.id === Number(id))?.uid === x.split_uids[id];
        const split = BASES[x.basis] && x.basis === "took_part" ? Object.fromEntries(Object.entries(x.split || {}).filter(([id, n]) => n > 0 && same(id))) : {};
        const payer = S.trip.families.find(f => f.id === x.paid_by && (!x.paid_by_uid || f.uid === x.paid_by_uid));
        S.draft = { id: 0, description: x.description || "", vendor: x.vendor || "", date: x.date || null, category, basis: CATEGORIES[category].choose && BASES[x.basis] ? x.basis : CATEGORIES[category].basis,
          amount: (x.amount_cents / 100).toFixed(2), paid_by: payer ? payer.id : "", split,
          receipt_key: x.receipt_key, receipt_type: x.receipt_type, catTouched: true, dateTouched: true,
          client_key: crypto.randomUUID(), fromWait: w.key };
        keepDraft(); location.hash = `#/t/${t.id}/e/new`; return;
      }
      case "unwait": {
        const w = waiting().find(x => x.key === b.dataset.key); if (!w) return renderTrip(tabNow());
        const ok = await confirmSheet(`Remove ${esc(w.label)}?`, w.refused ? "It wasn't added to the trip. Removing it takes it off this phone."
          : "This may already be on the trip. Check the list first. Removing it only takes it off this phone.", "Remove", true);
        if (ok) { dropWaiting(w.key); renderTrip(tabNow()); }     // nothing on the trip changed: no reload needed
        return;
      }
      case "tour": return showTour();
      case "pick-me":
        setMe(b.dataset.id || null);
        if (b.dataset.id) toast(b.dataset.id === "none" ? "Got it: you're not on this trip." : `Showing the ${famName(b.dataset.id)} family. Tap "Change family" to switch.`);
        // The button that was pressed is gone after this; focus what replaced it.
        return renderTrip(tabNow(), b.dataset.id ? '[data-act="pick-me"][data-id=""]' : '[data-act="pick-me"]');
      case "add-family": return addFamily();
      case "add-staff": return addStaff();
      case "pick-staff": return pickStaff();
      case "add-my-family": return addFamily({ mine: true });
      case "pay-notes": location.hash = `#/t/${t.id}/f/${id}`; return;
      case "remove-person": {
        const f = S.trip.families.find(f => f.people.some(p => p.id === id)), p = f.people.find(p => p.id === id);
        if (!(await confirmSheet(`Remove ${esc(p.name)}?`, "They won't count toward any expense on this trip.", "Remove", true))) return;
        return famSave(f.id, () => api(`/people/${id}`, { method: "DELETE" }), `${p.name} removed`, "#newname");
      }
      case "remove-family": {
        const f = S.trip.families.find(f => f.id === id);
        if (!(await confirmSheet(f.kind === "staff" ? `Remove ${esc(famLabel(f))}?` : `Remove the ${esc(f.name)} family?`, f.kind === "staff" ? "They're taken off this trip." : "Everyone in it is removed from this trip too.", "Remove", true))) return;
        await act(() => api(`/families/${id}`, { method: "DELETE" }), "Family removed");
        location.hash = `#/t/${t.id}?tab=families`; return;
      }
      case "del-trip":
        if (!(await confirmSheet(`Delete ${esc(t.name)}?`, "It disappears for everyone, along with its expenses. For 30 days anyone can restore it from \"Recently deleted\" at the bottom of the trip list. After that it's gone for good.", "Delete trip", true))) return;
        await act(() => api(`/tournaments/${t.id}`, { method: "DELETE" }), "Trip deleted. Restore it from Recently deleted.");
        location.hash = "#/"; return;
      case "restore":
        await act(() => api(`/tournaments/${id}/restore`, { method: "POST" }), "Trip restored");
        location.hash = `#/t/${id}`; return;
      case "del-expense":
        if (!(await confirmSheet("Delete this expense?", "It's removed for everyone, along with its receipt.", "Delete", true))) return;
        { const seen = S.draft?.id === id ? S.draft : S.trip.expenses.find(x => x.id === id);
          try { await api(`/expenses/${id}`, { method: "DELETE", body: { created_at: seen?.created_at, rev: seen?.rev } }); toast("Deleted"); }
          catch (e) { if (e instanceof AuthError) return renderLogin(); if (e.status !== 404) { toast(e.message); return; } toast("Deleted"); } }   // 404: a retry of a delete that already went through
        dropDraft(); S.draft = null; location.hash = `#/t/${t.id}`; return;
      case "drop-receipt": S.draft.receipt_key = null; S.draft.receipt_type = null; S.draft.aiNote = ""; return drawReceipt();
      case "volunteer": return volunteerSheet();
      // A link to the tab already open goes nowhere, so the next step scrolls to it instead.
      case "step":
        if (tabNow() === b.dataset.tab) return document.getElementById("tab")?.scrollIntoView({ behavior: "smooth", block: "start" });
        location.hash = `#/t/${t.id}?tab=${b.dataset.tab}`; return;
      case "reset-sandbox":
        if (!(await confirmSheet("Reset the practice trip?", "Everything anyone added or changed here is removed, and the trip goes back to how it started. This only affects the practice trip.", "Reset", true))) return;
        await act(() => api(`/tournaments/${t.id}/reset-sandbox`, { method: "POST" }), "Practice trip reset");
        setMe(null); S.lastTab = null;
        location.hash = `#/t/${t.id}`; return refresh("expenses");
      case "finalize": {
        const seenAct = Math.max(0, ...S.trip.activity.map(a => a.id)), seenFp = S.trip.fingerprint;    // as this screen showed it, before the sheet
        if (!(await confirmSheet("Finalize this trip?", `Expenses lock, and everyone settles through ${esc(t.treasurer_name)}. You can reopen it later if something was missed.`, "Finalize"))) return;
        // Refused (a retry of a finalize that went through, or numbers changed): the screen catches up either way.
        try { await act(() => api(`/tournaments/${t.id}/finalize`, { method: "POST", body: { seen_activity: seenAct, seen_fingerprint: seenFp } }), "Trip finalized"); }
        catch (e) { if (!(e instanceof AuthError)) refresh("settle").catch(() => {}); return; }
        await refresh("settle");
        if (await confirmSheet("Let everyone know", "Copy the list of who pays what, then paste it into the team chat.", "Copy payment list", false)) copy(finalMessage(S.trip.tournament));
        return;
      }
      case "copy-final": return copy(finalMessage(t));
      case "copy-need": return copy(needMessage(t));
      case "reopen": {
        const paid = S.trip.payments.some(x => x.paid_at);
        if (!(await confirmSheet("Reopen this trip?", paid ? `${plural(S.trip.payments.filter(x => x.paid_at).length, "payment", "payments")} already ticked off will be cleared, and everything is recalculated when you finalize again.` : "You can change expenses again, then finalize when you're done.", "Reopen", paid))) return;
        await act(() => api(`/tournaments/${t.id}/reopen`, { method: "POST", body: { ticked: S.trip.payments.filter(x => x.paid_at).length } }), "Trip reopened"); return refresh("settle");
      }
      case "toggle-paid": {
        const x = S.trip.payments.find(p => p.id === id);
        if (x && x.direction === "out" && b.dataset.paid === "1") {
          const tf = S.trip.tournament.treasurer_family_id;
          const mine = tf ? balances(S.trip.expenses, S.trip.families).rows[tf]?.net || 0 : 0;
          const held = (mine < 0 ? -mine : 0) + S.trip.payments.reduce((s, p) => s + (p.paid_at ? (p.direction === "in" ? p.amount_cents : -p.amount_cents) : 0), 0);
          if (x.amount_cents > held && !(await confirmSheet(`Record paying ${esc(famName(x.family_id))} ${money(x.amount_cents)}?`,
            `So far you've collected ${money(Math.max(held, 0))}, so this would come partly out of your own pocket until the others pay. That's fine if it's what you did.`, "Yes, I sent it"))) return;
        }
        await act(() => api(`/payments/${id}`, { method: "PATCH", body: { paid: b.dataset.paid === "1", ...(x && { family_id: x.family_id, direction: x.direction, amount_cents: x.amount_cents }) } })); return refresh("treasurer");
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

migratePending();
route().then(sendWaiting);
