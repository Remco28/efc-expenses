# Plan v2: what's left after the first peer pass

The six fixes from plan.md are already built (commit 0baca71). Four peers (peer-*.md beside this file) found gaps in them. Frank agreed to all of the following. No code is written until a fresh pair has checked this.

## Gaps in what was built

1. **Expired login during a save.** Every way out of `saveExpense` that shows the login screen first unfreezes the form (the freeze is a flag on the whole app, so it survives a redraw). This covers the first check and the send.
2. **Leaving during the save.** If the parent leaves the form while the save is in its first check, the save carries on to the send instead of stopping silently; nothing is redrawn, and the parent sees the usual "Expense saved", or the no-signal "waiting on this phone" message.
3. **Family tags checked in the expense write itself.** The expense insert and update require, in the same statement, that every family in the split still has the tag the screen sent (`split_uids`), and that the payer still has its tag (`paid_by_uid`) when one is sent. A mismatch is refused with the existing "a family ticked on this was removed" message.
4. **The payer's tag on edits.** An edit sends the payer's tag too (from the tags kept with the form), and the server checks it on edits as it does on new expenses.
5. **After a refusal because a family changed,** the form reloads the trip and redraws; the existing reopen check then clears the picks whose family changed, with its message, so the next save doesn't repeat the refusal.
6. **The treasurer's family.** Choosing the treasurer's family sends its tag, and the save requires it in the write.
7. **Adding a person to a family deleted that moment** answers "this screen is out of date, reload" instead of a server error.

## Tidying

8. The "you" label (the name sent with each change, with "(Coach)" for staff) finds this phone's family with the same tag check as the "your family" card.
9. Old unfinished forms with no tags kept: the message says "This expense was started before an update. Check who paid and who took part." rather than claiming families changed.
10. Finalize compares the fingerprint read with the trip (now in one batch) with its snapshot, instead of a third read.
11. Family-screen and fencing-day saves capture the trip they started on, and check against that.
