Review of 64a1243..f290c1c. I read the whole diff (src/index.ts, public/app.js, public/pdf.js) and the surrounding code. I did not run the app; everything below is reasoned from the code. Most of the changes do what they say, and I found no HIGH or MEDIUM problem. Two LOW findings, one of which is a fix applied in one place and missed in another.

**What I checked and found correct**
- **Treasurer forms.**
  - The "full form" is told apart by `Object.hasOwn(b, "treasurer_name")`. The final-trip sheet sends only `treasurer_notes`, and "Step down" sends `treasurer_name: ""`, which counts as full, so it still works.
  - Each form is refused on the other kind of trip.
  - The status is rechecked inside the UPDATE. The `treasurer_name IS NOT NULL` condition is safe because finalize requires a treasurer (index.ts line 485).
  - The "just finalized" and "changed, reload" wording is chosen correctly.
  - `volunteerSheet` refreshes after any non-auth failure. That is harmless.
- **Expense refusals.**
  - `expense_changed` and `expense_deleted` are raised in the right places.
  - A retry whose first reply was lost still passes the "same edit" check.
  - A delete retried after the expense was already deleted (404, `expense_deleted`) still ends with "Deleted" and navigation, as before.
  - Case where the expense number was reused: `rebaseEdit` finds the expense by id and `created_at`, so it reports "deleted" correctly.
- **`mergeOnto`.**
  - Split values are numbers, and `JSON.stringify` orders integer keys numerically, so an untouched split is not wrongly counted as changed.
  - Tags are copied only for the groups the parent changed.
  - A removed family on a kept split is still caught by `family_changed`.
- **`refusedAfterLeaving`.** `rewait` gives the redrawn form a fresh `client_key`, so `dropWaiting(d.fromWait)` cannot delete the entry just kept. Responses with status 5xx or 429, and timeouts, count as `unsure`, so they take the existing waiting path, not this one.
- **Spinner.** `thaw()` runs before `rebaseEdit`, so the form is not left frozen.

**Findings**

1. LOW, fix missed in a second place (reasoned from the code). The PDF statement now lists a family's share that rounds to $0.00, using key presence in `shares`. The in-app family statement still uses the truthy test `perExpense[e.id].shares[f.id]` (public/app.js line 1431, in the settle-up `statement`). A $0.00 share is left out there. A family whose only shares are $0.00 shows "Not included in anything". The PDF and the app then disagree about the same family. Fix: use `String(f.id) in perExpense[e.id].shares`. The key exists only when the family has units, since `out` is filled only for families with units.

2. LOW, a fix that does not show (reasoned from the code and the width arithmetic). The "(leaves out N expenses nobody is splitting yet)" note is appended to the "Total shared costs" figure in pdf.js, but that figure sits in a box about 148pt wide. `text(..., {w: fw-18})` runs `fit()`, which truncates with "...". At 16pt bold the amount alone takes about 80pt, so the PDF shows something like "$1,234.56  (le...". The warning is cut off. This only matters on a draft, because finalize refuses an expense nobody is splitting. Fix: put the note in its own smaller line under the figure.

3. LOW, rare. For an expense with an unknown (legacy) category or basis, `draftFromExpense` normalizes the category to "other" and the basis to "took_part", but `base` is taken from the raw `e`. The category/basis/split group therefore always looks changed by the parent. A rebase after a refusal would then overwrite another phone's change to the split with the parent's stale one. This looks confined to the pre-"three splits" legacy rows. The fix is to compute `base` from the normalized draft.

4. LOW, speculative. If the parent's own newly uploaded receipt key is missing from R2 while the revision still matches, the server answers `expense_changed` ("changed since you opened it"). The rebase keeps the parent's receipt group, so every Save is refused the same way with a misleading message. The old code had the same loop with a different message, so this is not new, but the new code and message do not break the loop either.

I changed nothing in the copy and did not start the server, so port 8883 was not used.
