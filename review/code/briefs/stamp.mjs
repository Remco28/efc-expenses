// Fills in what the app sends with every change: a family's or person's tag (uid),
// and an expense's revision and creation time, as they are now. A test that sends
// its own (to play a stale screen) keeps them.
export async function stamp(B, cookie, p, m, b) {
  const x = /^\/(families|people|expenses)\/(\d+)(\/people)?$/.exec(p);
  if (!x || m === "GET" || b instanceof Uint8Array) return b;
  const H = { headers: { cookie } }, id = Number(x[2]);
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
