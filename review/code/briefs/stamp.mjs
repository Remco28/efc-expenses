// Fills in what the app sends with every change: a family's or person's tag (uid),
// and an expense's revision and creation time, as they are now. A test that sends
// its own (to play a stale screen) keeps them.
export async function stamp(B, cookie, p, m, b) {
  if (m === "GET" || b instanceof Uint8Array) return b;
  const H = { headers: { cookie } };
  // Trip details name the dates the form opened with; reopen names the ticks it saw.
  // ...and finalize names the latest change its screen saw.
  const t = /^\/tournaments\/(\d+)(\/reopen|\/finalize)?$/.exec(p);
  if (t && (t[2] ? m === "POST" : m === "PATCH")) {
    const d = await (await fetch(`${B}/tournaments/${t[1]}`, H)).json();
    if (!d.tournament) return b;
    if (t[2] === "/finalize") return { seen_activity: Math.max(0, ...d.activity.map(a => a.id)), ...(b || {}) };
    return t[2] ? { ticked: d.payments.filter(x => x.paid_at).length, ...(b || {}) }
      : { seen_start: d.tournament.start_date, seen_end: d.tournament.end_date, ...(b || {}) };
  }
  // Expenses written for the old splits (from before who-took-part) become the new ones:
  // an untouched per-person or per-family split ticks every family, one person each.
  const ex = /^\/tournaments\/(\d+)\/expenses$/.exec(p) || /^\/expenses\/(\d+)$/.exec(p);
  if (ex && b && b.basis && !["took_part", "per_fencer", "fencer_day"].includes(b.basis)) {
    let tid = /^\/tournaments/.test(p) ? Number(ex[1]) : null;
    if (tid == null) {
      const list = await (await fetch(B + "/tournaments", H)).json();
      for (const t of list.trips || list) { const d = await (await fetch(`${B}/tournaments/${t.id}`, H)).json(); if (d.expenses?.some(e => e.id === Number(ex[1]))) tid = t.id; }
    }
    const d = tid != null ? await (await fetch(`${B}/tournaments/${tid}`, H)).json() : { families: [] };
    const basis = b.basis === "fencer" ? "per_fencer" : b.basis === "fencer_day" ? "fencer_day" : "took_part";
    const category = ["transport", "supplies"].includes(b.category) ? "other" : b.category === "meal" && basis !== "took_part" ? "other" : b.category;
    let split = {};
    if (basis === "took_part") {
      const set = Object.entries(b.split || {}).filter(([, v]) => v != null);
      if (set.some(([, v]) => v > 0)) split = Object.fromEntries(set.filter(([, v]) => v > 0));
      else split = Object.fromEntries((d.families || []).filter(f => f.kind !== "staff" && !set.some(([k]) => Number(k) === f.id)).map(f => [f.id, 1]));
    }
    b = { ...b, basis, category, split };
  }
  const x = /^\/(families|people|expenses)\/(\d+)(\/people)?$/.exec(p);
  if (!x) return b;
  const id = Number(x[2]);
  const list = await (await fetch(B + "/tournaments", H)).json();
  for (const t of list.trips || list) {
    const d = await (await fetch(`${B}/tournaments/${t.id}`, H)).json();
    if (x[1] === "expenses") {
      const e = d.expenses?.find(e => e.id === id);
      if (e) return { rev: e.rev, created_at: e.created_at, ...(b || {}) };
    } else {
      const r = x[1] === "families" ? d.families?.find(f => f.id === id) : d.families?.flatMap(f => f.people).find(q => q.id === id);
      if (r) return { uid: r.uid, ...(b || {}) };
    }
  }
  return b;
}
