I read problems.md, src/index.ts and public/app.js in the prefix copy. I changed and ran nothing. For each problem: the fix, what it costs, what it might break, and whether the same problem exists elsewhere.

**1. A late refresh makes the next action land on the wrong trip**

Cause: `loadTrip` (app.js ~287) fetches the trip and assigns it to `S.trip` straight away. Its callers check "am I still on this screen?" only after the assignment, so the check comes too late. Two callers do this: the fencing-days save (~901) and `famSave` (~797). `show()` and `refresh()` already do it correctly: they fetch, check, then assign.

Fix: `loadTrip` returns the trip and does not assign it. Each of its two callers assigns `S.trip` only after its own "still here" check passes. That is about two lines in two places, and the pattern already exists.

Cost: nothing noticeable.

Might break: nothing, as long as the `here()` checks run before the assignment. They read `S.trip.tournament.id`, which stays the old trip's id until the assignment, so they still work.

Same problem elsewhere:
- The family screen (`famSave`) has the same flaw, so the one change covers both.
- Going out to trip B and back to A is safe. `show()` waits for `famQueue` and `fenceQueue` before loading, so an old reload can't land after the newer one.
- I found no other unguarded assignment. `saveExpense` sets `S.trip = fresh` only after its `S.draft !== d` check.

**2. A correction typed during Save's first check is lost**

Cause: the request body is built from the form before the "has anyone joined?" reload. The form is only frozen later, just before the send.

Fix: freeze at the start, not just before the send. Once the early validation passes (amount, payer, shares), set `app.inert = true` and show the spinner, so the whole check and send is one frozen stretch.

The one real work: every exit between the freeze and the send must unfreeze. Those exits are sign-in failure, a held expense, an error toast, `S.draft !== d`, and the "who's on the trip changed" redraw. The unfreeze matters most on the redraw path, because `inert` is set on `#app` itself and survives the form being redrawn. A single try/finally around the whole stretch is cleanest.

Alternative: rebuild the body after the check from the live draft. It leaves the form usable but needs the amount and shares recomputed, and it gives no protection against a second tap on Save during the check. I prefer the freeze.

Cost: on a weak signal the form is frozen for up to the 25-second timeout. The send was already frozen, so the behaviour is consistent.

Might break: a stuck-frozen form if one exit is missed. `show()` already clears `inert` when the parent moves to another screen.

Bonus: this also stops a double-tap starting two concurrent saves during the check. They share one `client_key`, so they were harmless but wasteful.

Same problem elsewhere: I saw no other read-then-await-then-send in the editor. `famSave` deliberately reads typed text just before the redraw. I did not audit the `sheet()` forms in detail, but they resolve with values at submit and close.

**3. An unfinished meal reopened after a family was replaced on the same number charges the new family**

Cause: the draft in sessionStorage stores ticks and the payer by family number only. At save time, `split_uids` and `paid_by_uid` are looked up from the current trip. After a replacement, the lookup returns the new family's tag, so the server's tag check passes.

Fix: when the draft is kept, store the tags of the ticked families and of the payer, taken from `S.trip`. `keepDraft` runs on every input, change and click.

`S.trip` is the trip the form opened on, and background refresh is skipped while a draft exists (app.js ~222). So the tags stored are the ones the parent actually saw.

When the draft is picked up (`keptDraft` / `renderEditor`), compare each stored tag with the freshly loaded trip. For any mismatch, drop the tick, or clear the payer, and toast "A family changed since you left; check the shares." After that, the existing save-time lookup is safe. Live replacement while the form is open is already caught by the `whoIs` check at save.

Cost: a few lines in two functions, plus a slightly larger stored draft.

Might break: old drafts without stored tags. Treat "no tags stored" as "nothing to compare" or discard the ticks. Do one or the other deliberately.

Same problem elsewhere:
- The payer has the same bug, and the fix above covers it.
- Edit drafts are mostly protected, because deleting a family bumps `rev` and the server rejects the stale edit. The same fix is harmless there.
- The held-expense queue is fine: its body is built at save time with the tags already in it.
- Same class, lower stakes: "which family am I" is stored per device as `efc-fam-<tripId>` by family number (read in `whoNow`, ~83, and the pick-me code). After a same-number replacement, the new family becomes "you". It affects the "you owe" card and the staff label, not money charged. The fix is to store the tag as well and ignore the choice when it doesn't match. I'd flag it to the team rather than fold it in unasked.

**4. Changing a name undoes another phone's Fencer change**

Cause: the PATCH for name/Fencer (index.ts ~672) always writes both columns. The one that wasn't sent is filled from the earlier SELECT, so it overwrites a concurrent change.

Fix: write only what was sent. Bind null for an unsent field and use `COALESCE(?, name)` and `COALESCE(?, is_fencer)`, the same trick already used for `fencing_days`. Treat an empty name as unsent, as the current `str(b.name) || p.name` does. The UI sends exactly one of the two per change, so the client is unaffected.

Cost: one SQL line plus two binds.

Might break: nothing visible. The activity log still uses `p.name` for the "updated X" line.

Same problem elsewhere:
- The family PATCH already writes per field, each guarded by uid.
- The `fencing_day` branch is already an atomic in-SQL toggle.
- The treasurer PUT writes name, family and notes together from one request body, so it is last-writer-wins on all three by design. That is probably acceptable, but it is the same shape if you care.
- The trip PATCH (dates and name) might have the same shape. I didn't read it.

**5. The trip screen can show one treasurer with another's fingerprint**

Cause: `loadTrip` reads the trip row with `tournament()` before the `DB.batch`, but the fingerprint, which includes the treasurer, is computed inside the batch. A treasurer change in between gives a mismatched pair.

Fix: put the tournament-row SELECT into the same batch as the other reads. Then do the 404/deleted check afterwards, throwing the same HttpError if the row is missing or deleted, so the behaviour is the same. One snapshot then covers the row and the fingerprint.

For finalize, also compare `trip.fingerprint` to `snap` directly. Today finalize compares a separate later `fingerprint()` call to `snap`, which doesn't prove that what `loadTrip` read matches. This is a one-line addition and makes the existing guard actually cover the pair. The final write is already guarded by the fingerprint, so a torn read can't corrupt the money, but it could produce a confusing 409 or a wrong screen.

Cost: one more statement in the batch, and the batch result needs unpacking in the right order.

Might break: the deleted-trip 404 ordering, and any caller relying on `loadTrip` throwing before it reads the rest. Finalize and the GET route are the callers.

Same problem elsewhere:
- The treasurer PUT reads `t` first and then writes unconditionally. It only uses `t` for the log wording, so that is minor.
- `allowedDays` reads the dates and then guards the write with `SAME_SPAN`, so it is already safe.

**6. A person can be added to a family that just replaced theirs**

Cause: the check `b.uid !== fam.uid` runs as a separate SELECT before the INSERT. The INSERT itself names the family by number only.

Fix: put the tag into the INSERT's WHERE, as the family DELETE already does: `AND (SELECT uid FROM families WHERE id = ?) = ?`, bound to `b.uid`. Keep the pre-check for a clear message. If the insert returns nothing, re-read the family's tag and, if it doesn't match, throw `stale()` instead of the generic `closed()`, so the message is accurate.

Cost: two binds and a small branch.

Might break: nothing in the normal path. The idempotent-retry lookup by `client_key` and family id runs first and is unaffected.

Same problem elsewhere:
- New-expense POST has the same check-then-insert gap. The `paid_by_uid` check (index.ts ~703) and the `split_uids` check in `expenseInput` are separate reads. The INSERT itself checks only that the family numbers exist in the trip. The window is small, but it is the identical pattern, and a tag condition in the INSERT's WHERE closes it.
- People PATCH and DELETE, and family PATCH and DELETE, already carry the tag in the write itself.
- Expense PATCH and DELETE are guarded by `created_at` + `rev`.

**Suggested order:** 1, 4 and 6 are small, local and low-risk. 2 needs care on the exit paths. 5 touches a shared read used by finalize. 3 needs the new restore logic, and its neighbour `efc-fam-<tripId>` should be decided separately.
