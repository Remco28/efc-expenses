Review of 4719bbd..6cc7e4d (copy at .../scratchpad/rl10/fixaudit, commit 6cc7e4d). Servers are stopped; ports 8853 and 9853 are free.

**Verdict:** nothing HIGH, and I found nothing that makes something worse that used to work in a way that loses money or work. Both changes mostly do what they say. I ran the server side with scripts. I did not drive the browser; the front-end findings are reasoned from the code.

**Checked and working (server, ran):**
- A key seen before answers `already:true`, and nothing is corrected. This held for trip, family, person and expense. An expense resent with different content answers `already:true, same:false`.
- The key is checked before the "trip finalized" check. A resend after finalizing returns `already/same:true`, and a new key returns 409.
- An unknown route returns `{error, route:"unknown"}` with a 404. A real "No such expense" 404 has no marker, so a retried delete is still told apart from an old page.
- Finalize without `seen_activity` returns the stale 409. With an old value it returns "changed since your screen loaded". With the current value it goes ahead.
- Family and person write statements carry the uid tag in the write itself. I read every UPDATE/DELETE on those tables. Only the sandbox-reset and trip-wide date-trim statements lack it, and they are not per-id writes.
- The fencer rule works at family level. A fencer who fences every day keeps fencing a day that is removed and then added back.
- Unit and API logic of `cents()`: "12,5", "1.250,00" and "1,250" read correctly. I read this one, did not run it.
- Migration 0011's `client_sig` columns are now unused. Harmless.

**Findings**

1. **MEDIUM (ran, API).** The fencer rule from round 9 row 9 was applied to a family's days but not to a person's own days. This is "applied in one place, missed in another".
   - Family Lee has days Nov 1-2. Kid is a fencer, so fencing_days = days = Nov 1-2.
   - `PATCH /people/:id {own_day:"2026-11-03", on:true}` gives days Nov 1-3 but fencing_days stays Nov 1-2.
   - `{own_days:false}` back to family days has the same shape: if the family has extra days, fencing_days is not widened.
   - Adding a family day does widen it (Nov 4 was picked up).
   - So a fencer given an extra personal day does not fence it, and fencer-based shares for that day exclude them. This is visible on the family screen and the same as before the change, but the stated rule is not consistent. The person PATCH needs the same "fencing_days equals days, so follow" rule.

2. **LOW (reasoned from code, confirmed `toast("")` is empty).** Deleting an expense from the editor with an expired login does nothing visible. The new try/catch in `del-expense` (app.js ~1485) replaced `act()`. `AuthError` has no message and no `.status`, so it falls into `toast(e.message)` and shows an empty toast. It never calls `renderLogin()`. Before, `act()` showed the login screen. The other new catch sites (`saveExpense`, `sendWaiting`) handle `AuthError` correctly. This is the one place that doesn't.

3. **LOW (reasoned).** Receipt reading errors now show the wrong message. The new rule treats any 5xx as "don't know". In `uploadReceipt`, the `read-receipt` failure text goes into `d.aiNote`.
   - A real AI outage (the server returns 502 "Couldn't read that receipt right now. Enter it by hand." or a 500) now shows "The connection dropped before the app heard back, so this may or may not have saved. Check before trying again."
   - The 25 s request limit also applies to `read-receipt`. A slow but working read of a PDF would show the same message.
   - It is only a misleading note, and entry by hand still works. It shows up only where AI reading is on, which is switched off in my copy (it answers 503, which counts as an answer).

4. **LOW (reasoned from `api()`/`addSlot` and the server lookup).** The add key belongs to the typed content and is kept for 24 h until the app answers. If a first add got no answer, was never retried, and the user then adds a different thing with identical content in the same place, the server answers "already added".
   - Example: two families called "Smith", or a second "Alex" in the same family, after an unsure first add.
   - The toast says it was added, but no second record appears. It is visible and rare.
   - The retry-fix path ("was added after all") clears the key only when the reload shows the person.

5. **LOW (reasoned).** A draft stays in sessionStorage when you leave the editor by routes that don't clear it. Only the trip's main screen calls `dropDraft`; the family screen and the day screen set `S.draft = null` without it. Reopening Add expense in that tab then shows an old draft with "Picked up where you left off". It is visible. An old edit draft is also caught by the revision check.

6. **LOW (reasoned).** Finalize reads `seen_activity` from `S.trip` after the confirm sheet closes, not when the screen loaded. If this phone's own `sendWaiting()` refreshes the trip while the sheet is open, the treasurer finalizes with numbers they haven't seen. This needs a waiting expense to send in that window on the treasurer's own phone. Other phones' changes are caught.

**Not a problem:** the finalize check runs just before the existing fingerprint check, not inside the batch. The batch's fingerprint still guards the money, so the window is tiny. The stale-view fallback on a trip's main screen only shows data; every change from it still needs a signal.

**Housekeeping:** wrangler respawned its child process when I used `fuser -k` alone. I stopped it with `pkill -f "wrangler dev"` and `pkill -f workerd`. A reviewer's own `fuser -k` may need the same.

My test scripts are in .../scratchpad/t1.mjs, t2.mjs and t3.mjs. Their database state is in the copy's `.local-db`.
