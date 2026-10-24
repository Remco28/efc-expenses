Both plans aim at real gaps, and I could break parts of each. Problem 1's plan would not work as written, because an existing line wipes the kept draft. Problem 2's plan would give wrong answers in some cases. I read public/app.js (saveExpense, refusedAfterLeaving, show, renderEditor, famSave, fencingSave, api, act). I changed and ran nothing.

PROBLEM 1 (an edit refused or unanswered after the parent left)

Would it fix it? Not as written, for two reasons.

1. show() calls leaveDraft() on every route that isn't the editor, and that call deletes the kept draft. This happens on any change of tab on the trip page, since a tab change is a hash change. It also happens when the phone comes back to the app, because the visibilitychange handler calls route() whenever there is no in-memory draft and the parent isn't on a family screen.
   - The refusal arrives while the parent sits on the list. The very next tab tap, or the next unlock of the phone, wipes what the plan just saved.
   - That is the likely sequence after a no-signal failure, so the "Open it again to pick it up" message would often point at nothing.
   - The kept slot needs protection from leaveDraft. For example, keep it under a separate key or flag that only opening, saving or deleting that expense clears.
2. The "already keeping a different draft" test is unclear. The storage slot is single and is overwritten by keepDraft on every input, click and hide, as soon as any other form is open. So a kept edit for expense A is lost the moment the parent opens expense B and clicks anything. If the check looks only at sessionStorage, it can miss the draft the parent is typing in right now, because that one may not be written yet. Check the in-memory draft too.
   - One case is not covered. The parent left, reopened the same expense and started editing again, and then the old save is refused. The plan must say the newer draft wins, so the stale one doesn't overwrite it.

Would it break something that works? The code for opening a kept draft already handles a changed expense by rebuilding it. It works by number and creation time and keeps only the parent's changes. That rebuild is the strongest part of the plan, and it needs no new code. Two edge cases remain:
- expense_deleted: renderEditor sends the parent back to the list when the expense is missing, so a kept draft for a deleted expense can never be reopened. The message "Open it again" would then be false. For a deleted expense, give only the message.
- If the trip has been finalized, the editor shows a read-only view. The draft is unreachable there too.

Unanswered saves. A save with no answer may have landed. That path today uses toast(e.message), which has the honest "may or may not have saved" wording. The plan's message "couldn't be saved" would be untrue for it. Keep the unsure wording, and say the draft is kept in case it didn't. If the save did land, reopening finds a newer rev and runs the rebuild, which just reproduces the parent's own change. The toast then says "changed since you opened it", which is mildly confusing but harmless. Keeping the draft is the right call for an unanswered save.

Same problem elsewhere?
- The initial trip fetch inside saveExpense, when it fails after the parent left with a real refusal, already goes through refusedAfterLeaving, so it is covered.
- The login-expired case (AuthError) while the parent has left just shows the login. The draft is already gone, so an edit is lost there too. That is probably acceptable, but worth knowing.

More than needed? No. The only extra thing needed is the protected slot.

What holds up: reusing the one kept-draft mechanism and the existing rebuild, rather than building an edit queue like the new-expense one. The sessionStorage-only limit is honest and fine.

PROBLEM 2 (a failed tap still showing as saved on the family and fencing-days screens)

Would it fix it? Partly. Today a reload failure just leaves the optimistic DOM. The flips are DOM-only and S.trip is never changed by a tap, so redrawing from S.trip does show what was known before the taps. The plan has holes:

1. A queue of several taps shares one reload. If tap 1 succeeded and tap 2 got no answer, then the reload failed, a redraw from S.trip unticks tap 1 as well, even though it is saved.
   - Redrawing also shows "unticked" for a save that succeeded but whose reload failed.
   - The message "that change wasn't saved" would be false for those, and a parent may redo or distrust work that is fine.
   - famFailed and the fencing queue only hold a yes/no today. Record each tap's outcome (succeeded, refused, no answer). On reload failure, apply the successful ones to S.trip locally (or leave them showing) and revert only the others.
2. Existing wording says "may or may not have saved" for no-answer saves, and the plan says "wasn't saved". An unanswered tap may have landed on the server. Unticking it shows the safe state, because retapping is idempotent for fencing days and the other single-field changes, so the plan is safe in practice. Make the message say "may not have saved; check when you have signal" rather than a flat "wasn't".
3. A refused save with a failed reload (say the trip got finalized, then the signal dropped) is also left stale. The plan's condition, "no answer and the reload can't happen", should be just "the reload couldn't happen".

Would it break something? The text-field part is the risk.
- Today, when the reload fails, a name or pay note the parent typed and left stays on screen, so the parent still sees it and can retry.
- The plan would replace it with the saved value and only name it in a message, which deletes their typing. Better to keep the typed text and mark it as not saved, or at minimum put the text in the message.
- The field currently being typed in is preserved by the existing redraw logic. The same logic is needed on the fencing screen if it ever has fields (it has none today).
- Redrawing while offline also loses scroll and focus. Pass focusKey as famSave does now.

Same problem elsewhere? Check the places where the same famSave and fencingSave pair is used: the family screen's Fencer checkbox, fencing-day buttons and staff fields, which the plan covers, and the fencing-days screen's catch, which sets only the status to "" and redraws nothing. Those are the two sites to change. The add-person form already restores the typed name on failure. The paid tick in settle-up is not flipped before the save, so it is fine.

More than needed? No. Redrawing from S.trip is the smallest fix, and it needs no new state beyond the per-save outcome in point 1.

OVERALL
- Problem 1's plan needs three changes before coding: a kept slot that leaveDraft does not wipe, a rule for the same expense or a different draft already present, and no "Open it again" for a deleted expense.
- Problem 2's plan needs per-save outcome tracking so that earlier successful taps are not unticked, and softer wording than "wasn't saved".

Relevant file: /home/frank/Dev/efc-expenses/public/app.js. The key spots are show() and leaveDraft at about lines 255 to 1293, the visibilitychange handler at about line 218, refusedAfterLeaving at about line 1240, saveExpense at about lines 1298 to 1372, famSave at about lines 797 to 830, and fencingSave at about lines 902 to 913.
