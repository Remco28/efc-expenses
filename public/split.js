// The splitting rules. Shared by the browser app, the PDF export, the
// server (for categories) and the tests, so there is one copy of the math.

export const BASES = {
  person: { label: "Per person", unit: "person", units: "people" },
  fencer: { label: "Per fencer", unit: "fencer", units: "fencers" },
  fencer_day: { label: "Per fencer-day", unit: "fencer-day", units: "fencer-days" },
  family: { label: "Per family", unit: "family", units: "families" },
  custom: { label: "Custom", unit: "share", units: "shares" },
};

// Each category suggests a split; whoever enters the expense can change it.
export const CATEGORIES = {
  meal: { label: "Team meal", basis: "person" },
  coach_travel: { label: "Coach travel there and back (airfare, bags)", basis: "fencer" },
  coach_stay: { label: "Coach stay (hotel, meals, car)", basis: "fencer_day" },
  transport: { label: "Ground transport (van, gas, parking)", basis: "family" },
  supplies: { label: "Team supplies", basis: "fencer" },
  other: { label: "Other", basis: "family" },
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

// Units a family counts for on an expense when nobody has set them by hand.
// `date` only matters for per-person and per-family: who was there that day.
export function autoUnits(basis, family, date) {
  if (family.kind === "staff") return 0;          // coaches and staff never share costs
  // Only people on the trip at all (at least one day) count; with a day, only
  // those there that day.
  const people = (family.people || []).filter(p => p.days.length);
  const fencers = people.filter(p => p.is_fencer);
  const there = p => !date || p.days.includes(date);
  switch (basis) {
    case "person": return people.filter(there).length;
    case "fencer": return fencers.length;
    case "fencer_day": return fencers.reduce((n, p) => n + p.fencing_days.length, 0);
    case "family": return people.some(there) ? 1 : 0;
    default: return 0;
  }
}

// The split a new expense starts with. Every family is on "automatic" (null):
// who was there decides, so later changes to families or days flow through.
// A hand-set number overrides it, and 0 means deliberately not sharing.
export function defaultSplit(basis, families) {
  const split = {};
  for (const f of families) if (f.kind !== "staff") split[f.id] = basis === "custom" ? 1 : null;
  return split;
}

// Units per family. A family not listed on the expense is on automatic, the
// same as null, so families added later share by who was there. Custom splits
// are all hand-set, so there an unlisted family counts 0.
export function unitsFor(expense, families) {
  const split = expense.split || {};
  const units = {};
  for (const f of families) {
    if (f.kind === "staff") continue;
    const id = String(f.id);
    const set = id in split ? split[id] : expense.basis === "custom" ? 0 : null;
    const n = set == null ? autoUnits(expense.basis, f, expense.date) : Number(set);
    if (Number.isFinite(n) && n > 0) units[id] = Math.min(n, 1e6);   // the server caps hand-set counts lower; this keeps the math finite
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
