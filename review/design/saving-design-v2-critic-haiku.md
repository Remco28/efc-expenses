Review of /home/frank/Dev/efc-expenses/review/design/saving-design-v2.md, checked against src/index.ts and public/app.js (read-only; nothing run or changed). The design is smaller than v1 and mostly sound, but several of its promises don't hold against the code as it stands, and two of them can hand a parent a wrong result.

WRONG RESULTS OR LOST WORK (most serious first)

1. An expense refused after finalizing exists only on the sender's phone. Finalize computes the payments without it. The treasurer, the other families and the settle-up totals never see it, and the only signal is a "Couldn't send" note on one phone that may not be opened for days. The parent may have paid real money that is never settled. Declining a reminder on the finalize screen doesn't cover this; the gap is that the money is missing from the settlement with no one but that parent able to know.

2. A queued expense can land with different shares from the ones the parent saw. The app's existing guard against this (reload the trip before saving, and stop if families changed) is a network call that fails offline, and the design doesn't say whether the queue skips it or waits for it. On the server, when a split names a family that no longer exists, that entry is silently dropped (no refusal), and the other families' shares absorb it. The design's refusal examples only cover the paying family being removed. Also, expense dates aren't checked against the trip's current dates, so a queued expense can land on a day the trip no longer has.

3. A deleted expense can come back. The duplicate guard is the unique key on each expense. Once a row is deleted, its key is free. If a copy that got no reply actually saved, the parent sees it twice (once in the list, once in Waiting). If they delete the list copy while the signal is still bad, the next retry re-creates it. The design needs a record that a key was used and deleted, or the phone must drop a waiting item once the server has it.

4. "Couldn't send" for a save that did land. When someone else has edited an expense, a late correction gets a conflict reply saying the first save went through. The design would file that as a refusal and tell the parent it didn't send. A re-entry then makes a true duplicate. The same applies to "is it there?" after a lost add: the design never says how a reload decides it's "what they added". Matching by name fails when two people share a name (common with siblings), and it can wrongly report "added after all" or miss a real add.

5. A wifi sign-in page counts as saved. The app's request code treats any success status with a non-JSON body as success, and the callers then mark the save done and drop the queue item. The design names this exact case as "don't know", but the current code does the opposite. The design must require a JSON reply that carries the expected id, and the code change must come with it.

6. Section 1's central promise isn't in the design's own flow. A save first reloads the trip; that fails offline and shows an error, so it never reaches the queue. The design needs to say the queue path starts before that step.

7. The receipt photo is lost without warning. The photo is held in the page's memory and nothing says where it goes. "Add the photo when you have signal" only works if the photo survives a closed page or reload, and the design doesn't say it does. Either keep the file (in IndexedDB, not localStorage) or say it's lost.

8. A key can be reused for a different expense. If the form stays open after a save with no reply and the parent changes it and saves again, the same key can turn the second expense into a correction of the first, overwriting it. The design should say that each new expense gets a new key once a save has gone out.

GAPS AND INCONSISTENCIES

- Section 6 says any edit is online-only, but section 1 lets a parent edit a waiting item with no signal. Pick one.
- Section 3: the reply to a late, ignored copy isn't specified. If it's a refusal, a saved item shows as "Couldn't send". The sequence numbers also need a new stored field, which the design doesn't list. It doesn't say what happens to an older copy still in flight when the parent edits.
- Section 4's premise is off. Unreferenced receipt uploads are cleaned only during a practice-trip reset or a trip purge; nothing runs on a timer. Changing the window to 30 days changes a rule that rarely fires. The real exposure is a practice reset removing a waiting expense's photo.
- Retries are per trip, and nothing on the trip list shows waiting items. A waiting item for a trip the parent doesn't reopen is never retried or seen. "Lands loudly" only happens inside that trip.
- The current code already has a single "pending expense" slot. The design doesn't say how that is migrated.
- The sender's name is read at send time, so a queued item is credited to whatever name is set then.

MORE THAN THE APP NEEDS

- The sequence numbers and their new server state exist for one narrow race (an old copy arriving after a fix). It is the only part of the design that adds server state. Say what it costs and whether a simpler rule (for example, no edit of an item whose last send went unanswered) is acceptable.
- Four retry triggers plus a 30-second poll is more than needed. The online event, opening the trip, and a manual retry would cover it.
- The receipt-window change does nothing useful as written (see above).

WHAT HOLDS UP

- Keeping the expense's key on a waiting item, with the expense unique key on the server, means a retry cannot add a second copy while the first row exists. Concurrent retries are safe for expenses.
- Finalize's check against the activity log does catch a waiting expense that lands while the treasurer's screen is open. Only one landing after finalize (point 1) is a problem.
- The fresh key per add removes the existing bug where a lost add of one person followed by a new add renamed the first person (the server currently updates a person when a key is resent). The fix is right; the "is it there" check (point 4) is not.
- Refused items not blocking the others, and pausing the queue on logged-out, are the right calls.
- Being explicit about what it doesn't cover (sending with the app closed, offline edits and deletes, lost storage) is honest and the limits are real.

Files: /home/frank/Dev/efc-expenses/public/app.js (save, request handling and the pending-expense helpers), /home/frank/Dev/efc-expenses/src/index.ts (expense create and edit, the finalize check, the receipt sweep), /home/frank/Dev/efc-expenses/migrations/0009_client_key.sql (the unique key index).
