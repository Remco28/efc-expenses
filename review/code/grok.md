I'll review the money path only: share math, finalize payments, and how the app and PDF show those amounts. I'll read the code and quote anything that can make the figures wrong.### Shortening a trip leaves the dropped days in the split
- Severity: high
- Where: src/index.ts:324
- What goes wrong: Saving new trip dates rewrites only the tournament row. `people.days` and `people.fencing_days` keep every removed date, and the day chips, the Families summary, Check a day, and the PDF attendance grid only render the new range, so those dates cannot be seen or unticked. Per-fencer-day totals use `fencing_days.length`, so coach-stay shares still include the dropped days, and a meal dated on a dropped day is still split among whoever had that date. The PDF says the F marks are the fencer-day basis, but it only prints the new range, so the F marks no longer add up to the units on the expense.
- How to trigger it: Give two fencers all three days of a Wed–Fri trip, fencing each day, and add a $500 coach-hotel expense (per fencer-day: $300 / $200) plus a Friday meal. In Families, Trip details, set the last day to Thursday and save. Both fencers still count as 3 fencer-days, the Friday meal still charges whoever was marked Friday, and the family page still says "Whole trip".
- Evidence: The form promises the cleanup: `Shortening the trip removes the dropped days from everyone's attendance.` The handler does not touch attendance:

```324:326:src/index.ts
await env.DB.prepare("UPDATE tournaments SET name = ?, location = ?, start_date = ?, end_date = ? WHERE id = ?")
  .bind(str(b.name) || t.name, b.location == null ? t.location : str(b.location), start, end, tid).run();
```

```44:44:public/split.js
case "fencer_day": return fencers.reduce((n, p) => n + p.fencing_days.length, 0);
```

```469:472:public/app.js
const all = tournamentDays(S.trip.tournament.start_date, S.trip.tournament.end_date);
const sorted = all.filter(d => list.includes(d));
if (!sorted.length) return "No days";
if (sorted.length === all.length && all.length > 1) return "Whole trip";
```

```242:242:public/pdf.js
section("Who was there, by day", "The basis for every count in this record. x = there that day; F = there and fenced that day (one fencer-day). Per-person costs count the people there on the cost's day; per-fencer-day costs count the F marks.");
```

### "Whole trip" per-person and per-family expenses ignore attendance
- Severity: high
- Where: public/split.js:40
- What goes wrong: With no expense date, `there` is true for every person, so headcount is the number of people on the family and a per-family share is 1 whenever the family has any person. A family that came one day pays the same as a family that came every day, and a family whose days are all unticked still pays. New expenses start on that setting (meal, per person, date null). The note under the day field still says only families there that day share.
- How to trigger it: Family A has 2 people all three days, family B has 2 people on Saturday only, family C has 1 fencer and every day unticked. Add a $120 team meal and leave Day on "Whole trip, or more than one day". Shares come out $48 / $48 / $24. The same three families on a $30 whole-trip parking expense pay $10 each.
- Evidence:

```40:45:public/split.js
const there = p => !date || p.days.includes(date);
switch (basis) {
  case "person": return people.filter(there).length;
  case "fencer": return fencers.length;
  case "fencer_day": return fencers.reduce((n, p) => n + p.fencing_days.length, 0);
  case "family": return people.some(there) ? 1 : 0;
```

```773:773:public/app.js
: { id: 0, description: "", vendor: "", date: null, category: "meal", basis: "person", amount: "", paid_by: me && me !== "none" ? me.id : "", split: {}, receipt_key: null, receipt_type: null, basisTouched: false };
```

```863:866:public/app.js
: d.basis === "person" || d.basis === "family" ? (() => {
    const away = d.date ? families.filter(f => !autoUnits(d.basis, f, d.date)).map(f => f.name) : [];
    return (away.length ? `Not there that day, so not sharing: ${away.join(", ")}. ` : "")
      + "Only families there on this day share the cost. Pick \"Whole trip\" if it covered more than one day.";
```

### A fencer with no days still shares per-fencer costs
- Severity: medium
- Where: public/split.js:43
- What goes wrong: Per-fencer counts `is_fencer` people and never reads `days` or `fencing_days`. Clearing someone's attendance removes them from meals and from coach stay (zero fencing days), and Settle up even says they pay nothing toward the coach's stay, but coach travel and team supplies still charge their family a full share. Finalize will lock that payment in.
- How to trigger it: Three families, one fencer each. Untick every day for family C so the fencer's `days` and `fencing_days` are empty. Add the coach's $300 flight, basis per fencer. Each family, including C, is charged $100.
- Evidence:

```43:43:public/split.js
case "fencer": return fencers.length;
```

```1045:1045:public/app.js
${noFence.length ? `<div class="callout warn">${noFence.map(p => esc(p.name)).join(", ")} ${noFence.length > 1 ? "have" : "has"} no fencing days ticked, so they pay nothing toward the coach's stay. Check Families.</div>` : ""}
```

### An expense nobody is on still pays the payer back
- Severity: medium
- Where: public/split.js:99
- What goes wrong: `balances` always adds the full amount to whoever paid, then adds only the allocated shares. When every family drops to 0 units, nobody is charged, the payer's net rises by the whole amount, and the nets no longer sum to zero. The you-card says they would get that money back, and the treasurer checklist lists a payout with nothing to collect. The Balances total prints the full expense sum in the Share column, which is more than the share cells add up to. Settle up does warn and Finalize refuses, so the bad payment is not stored, but those other screens show it as the settlement.
- How to trigger it: Family A pays $40 for Sunday lunch, split per person, with at least one person there Sunday. Then clear Sunday from every family (or remove the only people who were there). Expenses shows "nobody included". A's card says "You'd get back $40". Treasurer shows "You'll pay back" A $40 and "Nobody owes anything." The Share column is $0 + $0 with a Total of $40.
- Evidence:

```96:102:public/split.js
for (const e of expenses) {
  const s = shares(e, families);
  perExpense[e.id] = s;
  if (rows[e.paid_by]) rows[e.paid_by].paid += e.amount_cents;
  for (const [id, c] of Object.entries(s.shares)) if (rows[id]) rows[id].owed += c;
}
```

```390:392:public/app.js
const line = r.net < 0 ? `You'd owe <b class="owe">${money(-r.net)}</b>` : r.net > 0 ? `You'd get back <b class="get">${money(r.net)}</b>` : "You'd be all square";
return `<div class="card you">${head}<div class="muted small">If the trip ended now</div><div class="big" style="font-size:22px">${line}</div>
  <div class="figures"><div>Your share<b>${money(r.owed)}</b></div><div>You've paid<b>${money(r.paid)}</b></div></div>
```

```1051:1054:public/app.js
<div class="table-scroll"><table class="t bal"><tr><th>Family</th><th class="n">Share</th><th class="n">Paid</th><th class="n">Balance</th></tr>
${families.map(f => { const r = rows[f.id]; return `<tr><td>${esc(famLabel(f))}</td><td class="n">${money(r.owed)}</td><td class="n">${money(r.paid)}</td>
  <td class="n ${r.net > 0 ? "get" : r.net < 0 ? "owe" : ""}"><b>${r.net > 0 ? "+" : ""}${money(r.net)}</b></td></tr>`; }).join("")}
  <tr><td><b>Total</b></td><td class="n"><b>${money(total)}</b></td><td class="n"><b>${money(total)}</b></td><td></td></tr></table></div>
```

Checked and holding: with whole-cent amounts, `shares` sums to the expense (including fractional custom weights in a large random sample), so a fully allocated trip nets to zero and `treasurerPlan` leaves the treasurer holding exactly their own family's balance. Staff stay at 0 units even if the split JSON contains a number for them, and the payer is still reimbursed in full. The PDF dollar columns call the same `balances` function as the app, so they match whenever the inputs match. Empty families (no people) are not charged. A hand-set count, including 0, overrides attendance.
