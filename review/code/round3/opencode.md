### [HIGH] Finalize freezes payments for a treasurer who changed
`src/index.ts:120-123,390-407,450-468`  
**Scenario:** Phone 1 starts finalize and reads treasurer A. Phone 2 changes the treasurer to B, or removes them, before the finalize batch. `FINGERPRINT_SQL` does not include `treasurer_name`/`treasurer_family_id`, so the guard passes, and `plan` still uses the stale `t` read at `:390`. The reverse also works: `PUT /treasurer` reads an open trip, finalize commits, then the unguarded update changes the treasurer on the final trip.  
**Wrong outcome:** Frozen payments are calculated for A while the trip shows B or no treasurer; a reimbursement can be omitted entirely, and the final trip cannot correct it without reopening.  
**Suggested fix:** Include both treasurer fields in `FINGERPRINT_SQL`; calculate `plan` from `trip.tournament` loaded after the snapshot; add `AND status = 'open' AND deleted_at IS NULL` to the `PUT /treasurer` update and check `meta.changes`.

### [MEDIUM] Family add/remove can still land after finalize
`src/index.ts:476-486,538-548`  
**Scenario:** `POST /families` calls `openTournament` at `:478` but inserts at `:484` without the `OPEN` guard. `DELETE /families` calls `openTournament` at `:538` but its split-update/delete batch at `:548` is unguarded. A stale family screen or add-family sheet can send while another phone finalizes.  
**Wrong outcome:** A family added after finalize changes balances but has no frozen payment; a family removed after finalize deletes it and rewrites expense splits, so the final payments no longer match the balances. Both requests return success.  
**Suggested fix:** Guard the insert/delete with `OPEN` and verify `meta.changes`; apply the same guard to the expense-split updates in the delete batch.

### [MEDIUM] Trip-date edits race finalize and each other
`src/index.ts:356-375`  
**Scenario:** `PATCH /tournaments` checks open status at `:357`, then reads attendance at `:366-367`, then updates the tournament at `:369` with no status or date guard. A finalize can commit in between, and this batch still changes the final trip’s dates and attendance. Separately, two phones shortening the trip differently both read the old days; the last date update wins, while the other request’s conditional prune can remove a day that remains in the winning range.  
**Wrong outcome:** A final trip can be edited after payments are frozen; concurrent date edits can leave attendance missing for a day inside the final range, undercharging `fencer_day` costs.  
**Suggested fix:** Add `OPEN` to the tournament update and make it conditional on the old `start_date`/`end_date`; retry or return 409 on mismatch, and perform the date update plus pruning in the same guarded batch.

### [MEDIUM] Failed family saves are reported as saved
`public/app.js:687-713,743-752`  
**Scenario:** `famSave` attaches `.catch(() => {})` to `act(call)` at `:691`, then still runs the reload and success path. If the save fails with a 409 or network error, the screen reloads and shows `✓ ${msg}`. For a new person, `:749` clears the name before the save, and `:751` reports `${n} added` even when the POST failed.  
**Wrong outcome:** The user sees a person “added” or a field “saved” when the server rejected it; the new person’s name is lost, and unsaved attendance/name changes can look committed.  
**Suggested fix:** Do not swallow the save failure. Track it separately, skip the success state, restore the new-person name, and only clear/show success after a successful request.

### [MEDIUM] New-person “Fencer” checkbox is lost on redraw
`public/app.js:620-623,701-709,750`  
**Scenario:** Type a name, tick **Fencer**, then tap a day or another control that triggers `famSave`. `keepIds` preserves `newname` but not `newfencer`; `renderFamily` rebuilds the add-person form, so the checkbox is unchecked. Tapping **Add** then posts `is_fencer: false`.  
**Wrong outcome:** The person is added as a non-fencer, so they pay nothing toward per-fencer or per-fencer-day costs and the other families are overcharged.  
**Suggested fix:** Preserve the checkbox’s checked state across the redraw, or avoid redrawing the add-person form while it has unsaved input.

### [LOW] Stale loads can repaint the wrong screen
`public/app.js:216-224`  
**Scenario:** `refresh()` has no `routeSeq` check, and `show()`’s catch does not call `stale()`. Finalize or tick a payment, then immediately navigate home; a slow `refresh()` can finish after the home screen renders and replace it with the old trip. A stale failed load can likewise paint an error over the new screen.  
**Wrong outcome:** The URL and the visible trip can disagree, so subsequent actions target the wrong trip; recoverable by navigating again.  
**Suggested fix:** Pass the current route sequence into `refresh()` and ignore its result if stale; check `stale()` in the `show()` catch before rendering an error.

### [LOW] Existing long trips become uneditable
`src/index.ts:362`  
**Scenario:** A trip created before the 60-day cap, or otherwise longer than 60 days, now fails every `PATCH /tournaments`, including a name-only edit, because the check runs even when the dates are unchanged. Migration `0007` clamps attendance but does not shorten the date range.  
**Wrong outcome:** The trip cannot be renamed or have its location corrected.  
**Suggested fix:** Enforce `MAX_TRIP_DAYS` only when the dates actually change, or explicitly handle existing over-limit trips.

Checks run read-only: `npm test` (17 pass) and `npm run check` (pass). No files changed.
