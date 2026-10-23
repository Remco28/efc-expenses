// The splitting rules. Shared by the browser app, the PDF export, the
// server and the tests, so there is one copy of the math.

// Three ways to split. Who took part is ticked on each expense, with a head
// count per family; the other two follow the fencers and their fencing days.
export const BASES = {
  took_part: { label: "Who took part", unit: "person", units: "people" },
  per_fencer: { label: "Equal per fencer", unit: "fencer", units: "fencers" },
  fencer_day: { label: "By fencing days", unit: "fencing day", units: "fencing days" },
};

// Each kind of expense has its split; only Other lets whoever enters it choose.
export const CATEGORIES = {
  meal: { label: "Team meal or outing", basis: "took_part" },
  coach_meals: { label: "Coach's own meals (breakfast, coffee, lunch at the venue)", basis: "fencer_day" },
  coach_travel: { label: "Coach travel there and back (airfare, bags)", basis: "per_fencer" },
  coach_stay: { label: "Coach hotel and getting around (hotel, rental car, gas, rides, parking)", basis: "fencer_day" },
  other: { label: "Other", basis: "took_part", choose: true },
};

// Every date from start to end inclusive, as YYYY-MM-DD.
export function tournamentDays(start, end) {
  const out = [];
  const d = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (d <= last && out.length < 60) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// The head count a family starts with when it's ticked: everyone in it.
export const familySize = family => (family.people || []).length;

// Units per family. Coaches and staff never share a cost.
// Who took part: the head count saved for each family ticked (a family not
// listed didn't take part). The others: each family's fencers, or their fencing days.
export function unitsFor(expense, families) {
  const split = expense.split || {};
  const units = {};
  for (const f of families) {
    if (f.kind === "staff") continue;
    const fencers = (f.people || []).filter(p => p.is_fencer);
    const n = expense.basis === "took_part" ? Number(split[String(f.id)] ?? 0)
      : expense.basis === "per_fencer" ? fencers.length
      : expense.basis === "fencer_day" ? fencers.reduce((k, p) => k + p.fencing_days.length, 0) : 0;
    if (Number.isFinite(n) && n > 0) units[String(f.id)] = Math.min(n, 1e6);
  }
  return units;
}

// Shares in cents. Leftover cents go to the largest remainders, so the shares
// always add up to the amount exactly.
export function shares(expense, families) {
  const units = unitsFor(expense, families);
  const ids = Object.keys(units);
  const total = ids.reduce((s, id) => s + units[id], 0);
  const out = {};
  if (!total) return { units, total: 0, shares: out };
  const rows = ids.map(id => {
    const exact = (expense.amount_cents * units[id]) / total;
    return { id, exact, cents: Math.floor(exact) };
  });
  let left = expense.amount_cents - rows.reduce((s, r) => s + r.cents, 0);
  [...rows].sort((a, b) => (b.exact - b.cents) - (a.exact - a.cents) || a.id - b.id)
    .forEach(r => { if (left > 0) { r.cents++; left--; } });
  rows.forEach(r => { out[r.id] = r.cents; });
  return { units, total, shares: out };
}

// What each family owes, paid, and its balance (+ is owed money).
export function balances(expenses, families) {
  const rows = {};
  for (const f of families) rows[f.id] = { owed: 0, paid: 0, net: 0 };
  const perExpense = {};
  for (const e of expenses) {
    const s = shares(e, families);
    perExpense[e.id] = s;
    // An expense nobody shares (everyone unticked or absent) can't be settled;
    // leave it out until it's fixed, so the balances still net to zero.
    if (!s.total) continue;
    if (rows[e.paid_by]) rows[e.paid_by].paid += e.amount_cents;
    for (const [id, c] of Object.entries(s.shares)) if (rows[id]) rows[id].owed += c;
  }
  for (const r of Object.values(rows)) r.net = r.paid - r.owed;
  return { rows, perExpense };
}

// Expenses nobody is splitting (everyone unticked) would vanish from the
// totals, so the app flags them instead of saving them silently.
export function unsplit(expenses, families) {
  return expenses.filter(e => shares(e, families).total === 0);
}

// Settling goes through one treasurer: each family that owes pays the
// treasurer, and the treasurer pays each family that is owed. The treasurer's
// own family (if they're on the trip) has no payment; whatever is left in the
// pot at the end is exactly their own balance.
export function treasurerPlan(rows, treasurerFamilyId) {
  const out = [];
  for (const [id, r] of Object.entries(rows)) {
    if (treasurerFamilyId != null && Number(id) === Number(treasurerFamilyId)) continue;
    if (r.net < 0) out.push({ family_id: Number(id), direction: "in", amount_cents: -r.net });
    else if (r.net > 0) out.push({ family_id: Number(id), direction: "out", amount_cents: r.net });
  }
  return out.sort((a, b) => (a.direction === b.direction ? b.amount_cents - a.amount_cents : a.direction === "in" ? -1 : 1));
}

export function money(c) {
  const s = (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (c < 0 ? "−$" : "$") + s;
}
