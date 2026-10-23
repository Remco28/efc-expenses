### Verification of Walkthrough Cases

Across all five walkthrough cases, **the saved split method (`basis`) and split mapping (`split`) match what the parent sees on screen**.

---

#### 1. A new expense
* **Code paths**: [`renderEditor(null)`](file:///home/frank/Dev/efc-expenses/public/app.js#L817-L832), [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L906-L962), [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902), [`saveExpense()`](file:///home/frank/Dev/efc-expenses/public/app.js#L1038-L1054).
* **State & Flow**:
  1. Opens with default category `meal`, basis `person`, `basisTouched: false`, and `split: defaultSplit("person", families)` where every non-staff family is mapped to `null`.
  2. [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L906-L962) computes auto units for the date (or trip) via [`autoUnits`](file:///home/frank/Dev/efc-expenses/public/split.js#L36-L50), showing each family checked with blank inputs and placeholder counts matching their auto units. The "Per person" button is highlighted (`.choice.on`) with the "Usual for this category" badge.
  3. If the user changes category, [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902) updates `d.basis` to the new category's default and sets `d.split = defaultSplit(usual, families)`. If the user manually picks a basis button, `d.basisTouched` becomes `true`, preserving their chosen split method across category changes.
  4. On submit, [`saveExpense()`](file:///home/frank/Dev/efc-expenses/public/app.js#L1038-L1054) transmits `basis: d.basis` and `split: d.split` (`{ "1": null, "2": null, ... }`). Server validation accepts `split`, and [`unitsFor`](file:///home/frank/Dev/efc-expenses/public/split.js#L64-L75) resolves `null` to `autoUnits`, matching the displayed totals and individual shares.

#### 2. An existing expense with an automatic split
* **Code paths**: [`renderEditor(id)`](file:///home/frank/Dev/efc-expenses/public/app.js#L822-L829), [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902), [`saveExpense()`](file:///home/frank/Dev/efc-expenses/public/app.js#L1038-L1054).
* **State & Flow**:
  1. When loaded, `S.draft` initializes with `basisTouched: e.basis !== CATEGORIES[e.category]?.basis`. Because it has an automatic split matching its category, `basisTouched` is `false`. Missing families added since creation are backfilled with `null`.
  2. Every family in `d.split` is `null` (or omitted).
  3. If the user changes category, [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902) checks `!d.basisTouched` and `!Object.values(d.split).some(v => v != null && v > 0)`. Both checks pass, so `d.basis` seamlessly transitions to the new category's usual basis, updating the default split and UI.
  4. If the category is not changed, or changed to a new usual basis, the saved payload preserves `d.basis` and all `null` split entries.

#### 3. An expense with a family left out
* **Code paths**: [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L940-L950) (`el.onchange`), [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902).
* **State & Flow**:
  1. Unticking family $F$ dispatches `el.onchange`, setting `d.splitTouched = true` and `d.split[F.id] = 0`.
  2. In [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L906-L962), `set === 0` makes `inc = false`, rendering the checkbox unchecked, the count input disabled, and the amount displaying "Not sharing". [`unitsFor`](file:///home/frank/Dev/efc-expenses/public/split.js#L64-L75) excludes family $F$.
  3. If category is subsequently changed, [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902) filters `out = Object.fromEntries(Object.entries(d.split).filter(([, v]) => v === 0))` and merges it: `{ ...defaultSplit(usual, S.trip.families), ...out }`. The `0` remains intact on the new basis.
  4. If the user re-ticks family $F$, line 947 assigns `null` (or `1` if the family was absent that day or on custom split), restoring them.
  5. The saved payload contains `d.split[F.id] = 0`, matching the screen and omitting them from [`shares()`](file:///home/frank/Dev/efc-expenses/public/split.js#L79-L94).

#### 4. An expense with a hand-set count
* **Code paths**: [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L951-L961) (`el.oninput`), [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902).
* **State & Flow**:
  1. Typing a count (e.g. `3`) into family $F$'s unit field sets `d.splitTouched = true` and `d.split[F.id] = 3`.
  2. [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L906-L962) updates the row value to `3`, and [`unitsFor`](file:///home/frank/Dev/efc-expenses/public/split.js#L64-L75) calculates shares based on 3 units.
  3. If the user changes category, [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902) evaluates `Object.values(d.split).some(v => v != null && v > 0)`. Because `3 > 0`, it aborts without altering `d.basis` or `d.split`. The UI keeps the chosen method active and moves the "Usual for this category" badge to the new category's suggested method.
  4. If the count is cleared to retype it:
     - On Custom split or for an absent family (`!autoUnits`), line 956 returns early so the family is not switched off mid-keystroke; leaving it empty reverts to the previous count on blur via line 943.
     - On an automatic split with `autoUnits > 0`, clearing resets `d.split[F.id] = null` (reverting to automatic placeholder units) or accepts any replacement number typed.
  5. The saved record sends `d.basis` and `d.split[F.id] = 3`, matching the display.

#### 5. A receipt read into each
* **Code paths**: [`uploadReceipt()`](file:///home/frank/Dev/efc-expenses/public/app.js#L999-L1020), [`fillFromReceipt()`](file:///home/frank/Dev/efc-expenses/public/app.js#L1022-L1036).
* **State & Flow**:
  - **New expense**:
    - If user touched nothing: `fillFromReceipt` fills suggested category, date, and amount. [`followCategory(d)`](file:///home/frank/Dev/efc-expenses/public/app.js#L896-L902) shifts basis to the receipt's category default, updating [`drawSplit()`](file:///home/frank/Dev/efc-expenses/public/app.js#L906-L962).
    - If user unticked a family (`splitTouched: true`): line 1029 transitions basis via `followCategory`, which preserves `{ [f.id]: 0 }`. Line 1032 (`if (!d.splitTouched)`) is skipped, leaving the unticked family excluded.
    - If user entered a hand-set count: `followCategory` detects `v > 0` and keeps the current split basis. Line 1032 is skipped, preserving the count.
  - **Existing expense**:
    - [`renderEditor(id)`](file:///home/frank/Dev/efc-expenses/public/app.js#L826) initializes `catTouched: true`, `dateTouched: true`, and `splitTouched: true`.
    - When `fillFromReceipt` executes, lines 1029, 1030, and 1032 guard against overwriting category, date, and split. Hand-set counts, automatic splits, and unticked families remain untouched.
  - In all receipt variations, the rendered screen and the saved payload remain in sync.

---

### Findings

No problems with concrete failure scenarios were found in [public/app.js](file:///home/frank/Dev/efc-expenses/public/app.js) (`renderEditor` through `saveExpense`, `followCategory`, and `fillFromReceipt`). All verified states save and calculate money consistently with what the user sees on screen.
