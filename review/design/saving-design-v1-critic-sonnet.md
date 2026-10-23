**Verdict:** the core holds up: phone-made ids, one outbox, and an honest test of "did the server really answer." Several of the extras around it would break things that work today, and a few failures are ones a parent wouldn't notice. I read the design and `src/index.ts`, plus the migrations and the `fetch` and `localStorage` use in `public/app.js`. I ran nothing.

## What it gets wrong or breaks

**1. Finalize loses its main guard.**
- Today `finalize` refuses if anything on the trip changed since the treasurer's screen loaded (`seen_activity`, plus the fingerprint, which includes every expense).
- The design's "terms" cover dates, families, who's there, and final status. They don't cover expenses.
- So the treasurer can finalize numbers that differ from what they were looking at. A delayed expense landing seconds earlier is enough.
- This is the money step, and it would quietly get weaker. Finalize should keep a check that covers expenses.

**2. Making expense saves depend on the terms version makes ordinary saves fail.**
- Expense saves today check only that the trip is open. Splits marked "automatic" are worked out from current days when the list is read, so an expense doesn't depend on the terms.
- During a trip people tick days constantly. Each tick bumps the single terms counter.
- Every queued expense on every phone would then be stopped on a "what changed in the trip's terms" screen. It would wait for a human, on a bad signal, because of an unrelated tick.
- What an expense really needs is that `paid_by` and the split families still exist on this trip and the trip is open. Use the terms version for finalize only.

**3. An expense queued with a receipt photo can lose the photo.**
- A receipt is its own upload to R2, and the expense saves a `receipt_key` that points at it.
- `localStorage` can't hold a photo, so the outbox needs IndexedDB and a "upload first, then the expense" ordering. The design doesn't say this.
- The existing cleanup deletes receipt files older than an hour that no expense references (`dropOrphanReceipts`). The design says orphans "are cleaned up."
- An expense can now wait in an outbox for days. If the cleanup runs in that time, the file is gone. The save then fails with "upload expired," and the parent has to re-take a photo they may no longer have.
- Never clean up uploads younger than weeks. Better, skip cleanup until the trip is purged.

**4. An expense that never reaches the server is invisible to the treasurer.**
- There's no background sending. A parent adds dinner at the venue, the item waits greyed, and they never reopen the app.
- The treasurer finalizes without that expense. The parent is out the money and no screen shows it.
- When the item finally sends, it's refused because the trip is final, and the parent sees "terms changed."
- A greyed line won't be noticed at a tournament. This is a gap rather than a flaw in the design. The cheapest mitigation is an app-open warning, plus the treasurer finalize screen telling people to open the app first.

**5. Delayed finalize and delete replay unattended.**
- A queued finalize, delete, reopen or restore that replays hours later on app open is dangerous.
- Anything with money or destructive consequences should stop and ask again, not auto-send. Today those are plain online-only buttons.

**6. The app can't open without a signal, so the outbox only covers drops mid-session.**
- There's no service worker. A cold open with no signal is a browser error page.
- The add-expense form also needs the family list loaded first.
- This should be stated plainly under "what it doesn't handle." A small cache of the page would extend the outbox's reach cheaply.
- iOS also doesn't share `localStorage` between Safari and the home-screen app. An outbox in one is invisible in the other.
- The `online` event is unreliable on iOS. Retry on a timer and on `visibilitychange`.

**7. Rejected saves aren't handled, so one bad item can block the queue.**
- "A real answer" covers the stored record or three named refusals.
- A validation 400 (amount zero, unknown family, trip dates) and a 404 for a purged trip are real answers but not listed. If they count as "don't know yet," they retry forever.
- Because the queue is ordered, one such item blocks everything behind it on that trip.
- Each such answer needs a "failed, show the parent, remove" outcome. A conflict awaiting a human should block only items that depend on it.
- A 401 (access cookie missing) should pause the queue, not drop it.

**8. "Not there: create it" resurrects things.**
- An edit or delete that arrives for a record that was purged (30-day trip purge) or wiped (practice-trip reset) would be created from scratch.
- Make creation explicit: no base version means create. A base version for a missing record is a refusal.

**9. Whole-record replace undoes the tick-level merging that works today.**
- Day ticks, fencing days and per-person days are sent today as `day`/`own_day`/`fencing_day` with `on`. They are small changes that the database applies to the current list so concurrent taps don't clobber each other.
- Replacing a whole family or person turns two parents ticking different days into a conflict.
- Worse, a "show both versions" screen for a grid of days is something no parent can resolve.
- Keep deltas for days. For low-stakes fields (names, pay notes, role), last-writer-wins is acceptable at this size.
- The design also doesn't say whether payment ticks, treasurer details or trip edits are "records" or stay as they are.

**10. Atomicity isn't stated.**
- "Look the id up first, then decide, then write" is a read-then-write.
- The case this design targets is a stalled first request still running while the retry arrives. Both can see "not there" and both create.
- The current code avoids this with conditional statements (`WHERE rev = ?`, unique-index `ON CONFLICT`). The put rule must be built the same way.

**11. The unconfirmed-own-save rule can revert a newer save.**
- "Last change was from this same phone from the same starting point, so replace" can let an old, delayed request overwrite a newer corrected one from the same phone.
- That happens when a stalled request finally gets through after the correction landed.
- A phone-token rule can't tell the two apart. See the simplification below.

**12. The duplicate badge will fire on legitimate expenses.**
- Same trip, same amount and same date matches three families' identical hotel rooms, the same parking fee for two cars, and every undated item of the same amount.
- Parents will learn to ignore it, and "tap to remove either" next to a false flag invites deleting a real expense.
- There's also no "not a duplicate" dismissal.
- Tighten it to the same payer, amount, date and vendor or description. Make removal confirm. Better, accept that lost-storage duplicates are rare and skip it.

**13. Smaller points.**
- The activity feed and finalize check use server receive-time. A Friday dinner synced Sunday shows up as Sunday. Send the phone's timestamp as well.
- Decide whether greyed items count in the balances shown on the phone. Otherwise two parents see different totals, with no hint why.
- Deleted-record tombstones that live in the same tables mean every query needs `deleted_at IS NULL`. Missing one means a deleted family still counts in balances. Use a separate table of deleted uids instead, and keep deleting rows for real. "A few rows, forever" stays true.

## What's over-built for this app size

- **Rewriting references to uuids.** `paid_by`, the keys inside `split` JSON, `payments.family_id` and `treasurer_family_id` all use numeric ids, and `split.js` is shared with the browser. The design says "old numeric ids stay internal," but changing the API to uuids would touch all of these. The outbox is ordered per trip, so a phone-created family syncs before the expense that names it. Give each record a uid for its own identity and keep numeric ids in references.
- **The phone token and "same starting point" rule.** Replace them with client-chosen revision ids. Each save says "based on rev X, producing rev Y." If the server's current rev is Y, the save already applied. If it's X, apply it. Otherwise refuse.
  - With ordered sending, a corrected resend simply bases on the first attempt's Y. No tokens, no coalescing of waiting items, no revert-by-stale-request.
  - It's also the same mechanism the current `rev` column and client keys already approximate.
- **A conflict screen per record type.** Refuse with "someone changed this, reload," as now. Show both versions only for expenses, the one type with real content.
- **Orphan cleanup and the duplicate badge**, as above.

## What the design gets right

- It collapses the per-table `client_key`/`client_sig`/`uid`/`rev` patchwork (migrations 0008 to 0011) into one rule. That's the real win.
- The honest reply test is the best part: HTML login pages, 500s and timeouts mean "don't know."
- Tombstones for deletes fix a real hole: id reuse on `INTEGER PRIMARY KEY`, plus delayed retries.
- Deploy additively. Keep the old routes working until phones have the new page, and don't ship it mid-trip.

**Bottom line:** keep the outbox, client-made ids, revision-id idempotency, the honest classifier, and a uid-only tombstone table. Cut the phone token, the per-expense terms check, the per-type conflict screens, and probably the badge. Fix finalize and the orphan-cleanup interaction first, because those can lose or misstate real money.
