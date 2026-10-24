Review of the round 12 plan. I read plan.md, the treasurer route and expense route in src/index.ts, and saveExpense, renderEditor, the draft keeping, volunteerSheet and delete in public/app.js. Nothing was run or changed.

## Problem 1: notes-only treasurer save wiping the treasurer

**Would it fix it?** Yes. The wipe happens because an absent `treasurer_name` becomes an empty string, and an empty string means "remove". Treating absent as "notes only" removes that. The sheet's "Step down" sends an explicit empty name, and the open-trip Save always sends a name because the field is required, so neither of those changes.

**Would it break anything that works today?** Not as stated, but the plan opens a new hole that final trips never had.
- **Wrong treasurer's notes overwritten.** Lisa opens the notes sheet on the final trip. The trip is reopened, and Bob is made treasurer with his own Venmo in the notes. Lisa taps Save. The notes-only path overwrites Bob's payment details with hers, and the app tells families to pay Lisa. On a final trip this can't happen because the treasurer is locked. On an open trip it can. The plan has the request carry no identity at all, so the server can't tell whose notes these are.
- **Fix:** have the notes-only request name the treasurer it was written for (the treasurer's family tag, or at least the name). The server refuses with the existing "out of date" answer if it no longer matches, much like the family-tag check the full save already does. This is small.
- **Notes with no treasurer.** Today, "no treasurer" always goes with empty notes, because removal blanks them. A notes-only save on an open trip with no treasurer, for example after someone else stepped down, would leave notes on a trip with nobody to send to. The next treasurer's form pre-fills them from `t.treasurer_notes`, so they'd inherit a stranger's Venmo. The notes-only update on an open trip needs a condition that a treasurer exists and that the trip is open and not deleted, in the same UPDATE. The current final-trip branch has no such guard either, and a reopen-and-step-down between its read and write would do the same thing. Put the guard on both branches.
- **Log text.** The audit line should stay "updated the treasurer's payment notes" on this path. Otherwise it would read "removed the treasurer" or "updated the treasurer details".

**Is the same problem left elsewhere?** The same pattern appears nowhere else in this route. One related thing: the final-trip branch currently ignores any name or family sent with it. That is fine, but the identity check above should apply there too, so both branches stay one rule.

**More than needed?** No. The core change is a few lines. The identity check and the existence guard are the only additions worth making.

## Problem 2: the refused edit with a stale revision

**Would it fix it?** Mostly. It would make the stuck loop recoverable, but the plan leaves several gaps.
- **The refusal is unlabeled.** The stale-revision 409 has no code and only a message. The client can't tell it from "deleted on another phone", "receipt replaced", or the generic "trip just changed" 409s. Family changes already have a code, `family_changed`, so add similar codes here. Don't match on message text. The deleted case needs its own code too.
- **Reused ids make "deleted meanwhile" wrong.** The server says ids can be reused once the newest expense is deleted. After reloading, the form would find an unrelated expense under the same id and carry its revision. It must compare `created_at` as well as the id. A mismatch means deleted. Otherwise A's edit silently overwrites a different expense.
- **A replaced receipt traps A again.** If B replaced the receipt, the server deleted the old file. A's form still holds the old key. Saving then fails with "That receipt was replaced", another 409, and A is stuck again. The form needs to take B's receipt unless A changed the receipt herself. If the plan really means "keep all of A's values", it must at least handle this field.
- **Silent reverts of B's other edits.** A changed the amount and B changed the date. "Save to replace theirs" reverts B's date without A ever seeing it. A cheap middle path is to keep only the fields A actually touched over B's version. That needs a snapshot of what A opened with, so it may be more than needed. At minimum, say which fields differ in the message. Frank should pick one of these.
- **Message wording.** The server also uses this refusal when A's own earlier save went through but the reply was lost and the retry no longer matches. "Someone changed this expense" would be wrong then. Use neutral wording, such as "This expense changed since you opened it."

**Would it break anything that works today?**
- **Pickup-where-you-left-off.** `renderEditor` keeps an existing draft when the id matches, so reusing it is natural. But the draft is only written to the browser's session storage on input and click events. After the revision swap, call the draft-keeping function explicitly, or a reload brings back the stale revision. This still ends up refused and recovered, but it is untidy.
- **Family and "who is on the trip" checks.** The full-screen reload after the swap should reuse the same "still here" guard the `family_changed` handler uses. The plan already says to. `saveExpense` also compares the trip it fetched at the start of Save against the one the form opened on. That check keeps working because `S.trip` gets replaced.
- **Finalized meanwhile.** `renderEditor` shows the read-only view and leaves the draft sitting. The plan's message would not make sense there, so only apply the new handling for the revision code.

**Is the same problem left elsewhere?** Yes, one place. Delete from the editor sends the draft's stale revision, gets the same unlabeled refusal, and the user is stuck the same way. Deleting from the list is less bad because opening the list reloads the trip. The refreshed-revision handling should cover the editor's Delete too: after a stale refusal, refresh the draft's revision, or let Delete send the freshly loaded expense's revision. Also, `saveExpense` already fetches the fresh trip just before the PATCH. A client-side comparison against it could avoid most refusals, but the server check is still needed for the race, so don't rely on it.

**More than needed?** The plan's core is right and proportionate: keep A's typing, carry the new revision, tell her plainly. Don't add a merge UI, a diff view, or automatic retry. Back-from-a-new-expense discarding stays as it is. That is the usual way to cancel, and the existing "Picked up where you left off" draft keeping already handles accidents.

## What holds up
- A missing name is never a removal: the right principle, and the explicit empty-string for step-down matches how the sheet already works.
- Not auto-saving on the user's behalf. A knowingly pressed second Save is the right design given the existing lost-reply idempotence logic (`rev - 1` with identical fields).
- Doing the reload only "if still on that form" matches how the family_changed handler works. Reuse its pattern.
- The deleted-meanwhile branch going back to the list is right, and it has a precedent in the 404-means-deleted handling in the delete flow.

## Questions for Frank
1. For Problem 1, is it acceptable to refuse the notes save when the treasurer has changed since the sheet opened? The alternative is the silent overwrite.
2. For Problem 2, should A's save replace the whole expense (as planned), or only the fields A edited? The first is simpler but can silently undo B's unrelated edits.
