Verdict: the core holds, but I found one lost-work bug, one wrong-result bug, and one gap where the design can't do what it says. They are all fixable without growing the design. I read the design, the expense code in src/index.ts, and saveExpense and the existing "pending" code in public/app.js. I changed and ran nothing.

**Where it breaks**

1. **An edit made while a send is in flight can be lost.**
   - Say a waiting expense is sent. The parent opens it and fixes a typo, which is change 2, while change 1 is still on the wire.
   - Change 1's "saved" reply arrives. Section 2 says "saved" removes the item from the queue, so the corrected version is thrown away. The typo stays on the server and the parent believes it was fixed.
   - The design must say that "saved" removes an item only if the reply is for the change number still on the phone. Otherwise the item stays and goes again.
   - Simpler alternative: don't allow editing an item that is currently sending.
   - The 30-second timer, the screen-return trigger and the "back online" trigger can all fire together. The design never says only one send runs at a time. Duplicate sends are harmless, since the key and the existing ON CONFLICT insert absorb them. They are what makes the in-flight edit case common instead of rare.

2. **A second correction is refused by today's server.**
   - The current correction code in src/index.ts only applies when the expense's revision is still 0, and a correction bumps the revision to 1.
   - So: the first copy lands, the parent edits the waiting item (correction 1, applied), then edits again (correction 2). Correction 2 gets a 409 and ends up in "Couldn't send" with the message "someone has changed this expense since", when nobody did.
   - The new change-number rule needs to replace the revision-0 test. Something like "apply if my change number is higher than the highest one applied". Corrections from the phone should not count as someone else's edit.
   - Today's code also has no column to hold that number. The first insert must record it too, otherwise a late number-1 copy arriving after number-2 created the row would overwrite it.

3. **The save button usually can't queue anything on a bad signal.**
   - saveExpense first does a GET of the whole trip to check that the family list hasn't changed. If that GET fails, it only shows a toast and returns, before any POST. On a dead signal, the case this design is for, the expense would never reach the queue.
   - The design says "when the app can't get a real answer", but the code path never gets that far.
   - The design must say what happens to that check. If it is skipped when offline, see the next point. If it still blocks, queueing doesn't work.

4. **A stale split on a queued expense can silently charge the wrong families.**
   - That family-list check exists so a parent can't save shares worked out against an out-of-date list of families and days. Queued items skip it, and may be sent days later.
   - The server drops split entries for families that no longer exist, and treats a family missing from the split as "automatic". So a family added in the meantime gets charged a share the parent never saw.
   - Changed days shift amounts the same way. Totals can be wrong with no message. Waiting items don't count in totals, so nobody sees it until it lands.
   - Minimum fix: when a waiting item finally sends, or when the trip opens with items waiting, compare the family and day list against the one it was made with. If it differs, put the item in "Couldn't send" with "who's on the trip changed, check the shares". The comparison code already exists in saveExpense.

**Smaller points**

- Don't clear a waiting item just because the trip data contains an expense with its key. That is what the existing "did save" check does. With edit-in-queue it would throw away an unsent correction. Compare content, or the change number, as well.
- One send that hangs (25 seconds) holds up everything behind it in the queue, even though the design says refused items don't block. Either send in parallel (the keys make that safe) or accept that a hang blocks. Say which.
- Resurrection is rare but possible. If an expense lands and the reply is lost, and someone then deletes it as a "duplicate", the phone's later resend recreates it. Only the visible "Waiting" item gives that away. This is within the owner's accepted duplicate stance; I'd just note it.
- Name attribution. A queued item is stamped with whatever name is on the phone when it sends, not when it was entered. Minor.
- The queue needs to be per trip and a list. Today's storage is a single slot for one expense in one trip.
- The 30-day receipt retention is harmless but does almost nothing. The orphan cleanup only runs on a trip purge or sandbox reset (src/index.ts, lines 95 and 267), not continuously. iOS Safari also wipes site storage after about a week of non-use for non-home-screen sites, so "waits for days" is shakier on iPhones than the design admits. It already lists storage loss as unhandled, so this only needs one honest sentence.

**More than this app needs?** Mostly no.
- Keep the key reuse, the "Couldn't send" shelf and oldest-first.
- Keep the "don't know yet" rule in section 2, which is careful and right. It treats a wifi sign-in page, a 5xx and a 429 as "not an answer", and it needs a real id in the reply. Today's api() would treat a sign-in page returned with a 200 status as success with null data, so the new rule really is needed.
- The change-number mechanism (section 3) is justified only because of the overlapping copies in point 1. If sending is single-file and editing is blocked while a send is in flight, an old copy can't arrive after a new one. Even then, a copy stalled in the network could land late, so the number is cheap insurance. I'd keep it but fix point 2.

**What holds up**
- Section 6 is a real improvement. A fresh key on every add, and the server never rewriting a person, family or trip on a resent key, closes the Ava/Ben bug at its root. The server already checks the key plus the parent record, and Add is online-only.
- Finalize stays safe. The server-side check, run in the same statement as the finalize, already rejects expenses arriving late (the queue's resend would hit the OPEN condition). Refusal lands as "Couldn't send" with the reason.
- Leaving the finalize screen without a reminder is an acceptable owner choice. One note: a parent whose app is closed learns of the refusal only on their next open, so the treasurer reopening the trip is the recovery. That is acceptable for this app.
- The limits section (no offline page, no duplicate detection, no sending while closed) is honest and matches the code.

Files read: /home/frank/Dev/efc-expenses/review/design/saving-design-v2.md, /home/frank/Dev/efc-expenses/src/index.ts, /home/frank/Dev/efc-expenses/public/app.js
