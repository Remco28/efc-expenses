# Code Review Round 5 Report: Money Correctness & Settle Numbers

### Scope
- **`public/split.js`**: `shares()`, `unitsFor()`, `autoUnits()`, `defaultSplit()`, `balances()`, `treasurerPlan()`, `unsplit()`, `tournamentDays()`, `money()`
- **`public/app.js`**: Settle tab (`tabSettle`, `statement()`, Balances table, `todo`), and cross-view agreement with `youCard()`, `tabTreasurer()`, and `finalMessage()`

---

### Findings Summary
**No findings.** No money correctness issues or number disagreements were found within the scoped files.

---

### Verification Details

#### 1. Do the shares always add up to the expense?
**Yes.**
In [`public/split.js:79-94`](file:///home/frank/Dev/efc-expenses/public/split.js#L79-L94):
- For any expense with `total > 0` units, `exact = (expense.amount_cents * units[id]) / total` and initial `cents = Math.floor(exact)`.
- For each row $i$, $0 \le exact_i - cents_i < 1$.
- Summing over all $N$ participating families: $0 \le left = expense.amount\_cents - \sum cents_i < N$.
- Because $left$ is an integer strictly less than $N$, sorting by remainder descending and incrementing `r.cents` for the first $left$ rows terminates with $left = 0$.
- Consequently, $\sum out[id] \equiv expense.amount\_cents$ exactly to the cent under all valid inputs and basis combinations.
- If an expense has no participating families (`s.total === 0`), `shares()` returns `total: 0, shares: {}`. [`balances()`](file:///home/frank/Dev/efc-expenses/public/split.js#L106) intentionally leaves it out so balances still net to zero, [`unsplit()`](file:///home/frank/Dev/efc-expenses/public/split.js#L116-L118) flags it on the Settle tab, and finalization is blocked until resolved.

#### 2. Do the amounts a family sees agree with each other?
**Yes.**
- **Net Balances & Zero-Sum:** In [`balances()`](file:///home/frank/Dev/efc-expenses/public/split.js#L97-L112), every dollar counted toward `rows[e.paid_by].paid` is mirrored by the exact sum of shares added to `rows[id].owed`. Thus $\sum r.paid = \sum r.owed$ and $\sum r.net = 0$.
- **Settle Tab Consistency:**
  - In [`tabSettle`](file:///home/frank/Dev/efc-expenses/public/app.js#L1075-L1129), the Balances table, the "Who pays what" list, and "Each family's breakdown" all derive from the same `balances()` result and `plan()`.
  - In `statement(f)`, the sum of individual expense shares equals `r.owed` (lines where the family's share is $0.00 are omitted without altering the total).
  - For the treasurer's family, both `todo` and `statement(f)` consistently display what the treasurer's family keeps (`r.net > 0`) or adds (`r.net < 0`) out of what is collected.
- **Cross-View Consistency:**
  - **The "You" card ([`youCard`](file:///home/frank/Dev/efc-expenses/public/app.js#L388-L420)):** Matches the family's share, paid amount, and net balance shown in `tabSettle`. When the trip is finalized, it matches the payment direction and amount from `S.trip.payments`.
  - **Treasurer tab ([`tabTreasurer`](file:///home/frank/Dev/efc-expenses/public/app.js#L1132-L1175)):** The progress breakdown accounts for the treasurer's family part (`own = mine < 0 ? -mine : 0`), ensuring cash on hand reconciles to $0.00 once all checklist items are ticked.
  - **Team message export ([`finalMessage`](file:///home/frank/Dev/efc-expenses/public/app.js#L1057-L1066)):** Filters `plan()` into `ins` and `outs`, matching the amounts displayed across the Settle tab.
  - **Coaches & Staff:** Excluded from sharing costs (`autoUnits` returns 0; excluded from splits and breakdown). Reimbursed in full for any expenses paid via an `out` payment in `treasurerPlan`.
