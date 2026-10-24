Review of the round 13 plan (scratchpad peer13/plan.md) against /home/frank/Dev/efc-expenses/public/app.js. Read-only; nothing changed or run. Line numbers are app.js.

PROBLEM 1: an edit walked away from, then refused or unanswered, is lost

Would it fix it? Mostly, for the case the plan names: a refused edit, reopened directly from the expense, comes back through the existing rebuild (renderEditor ~964-972, rebaseEdit, mergeOnto). Edits carry the base that mergeOnto needs, so that path works.

What the plan misses or gets wrong:
- Writing the kept draft needs its own write. keepDraft() (~1289) returns at once when S.draft is null, and by the time the refusal arrives the parent has left and S.draft is null. The plan has to write the draft to the session entry directly, with the trip id.
- Same walk-away loss, not covered: if the pre-save check (the trip GET at ~1331) fails with no answer after the parent left, the edit is dropped. Nothing was sent, but the toast says "may or may not have saved". The plan's "refused (or unanswered)" wording does not reach this branch.
- Wrong wording for the unanswered case: the plan says the change "couldn't be saved". With no answer it may have saved. The message should say it may not have saved, and reopening then runs the existing rebuild, which handles a save that did land.
- The kept draft is dropped by the next trip-screen route. show() calls leaveDraft() (~259) for the trip main, family and fencing screens, and the visibility route (~222-226) runs it when the app comes back to the front. So tapping a tab after the refusal loses the edit. "Open it again" only works if the parent goes straight back to that expense. Either leaveDraft should spare a refused edit, or the plan should say so.
- One slot for everything: the input and change listeners (~1294-1296) overwrite the session entry on any typing in another expense form. The "different draft" guard only runs at refusal time. The plan accepts this as "as all kept drafts are", but the message then promises something that can silently be gone.
- The message promise is wrong for two refusals. expense_deleted: reopening redirects to the trip (~965 area, renderEditor's "id && !e" line) and the draft is dropped with no explanation. trip finalized (closed or trip_changed): reopening shows the read-only expense view and nothing picks the draft up. These need their own wording or no "open it again".

Breaks something that works today? Not that I can see, provided the new-expense path (which already waits or is held) is left alone and the new write only runs when d.id is set.

More than needed? Lean. The "different draft" guard is needed.

What holds up: reusing the existing rebuild on reopen; keying the kept draft by trip id; the new-expense waiting path already being right.

PROBLEM 2: a failed tap on the family or fencing screen still shows as saved

Would it fix it? The display bug, yes, if the redraw is added to famSave's failure path (~818-825). But the plan names only "the family and fencing screens", and fencingSave (~902-912) is a different function: it swallows errors with no failure flag and has no redraw on failure. It needs its own change.

What breaks or is wrong:
- Redrawing "from the trip as last loaded" is wrong for taps that did save. S.trip changes only when a load succeeds. In a batch of quick taps where one or more saved and the reload then failed, the successful taps would revert on screen. And when the save went through but the reload failed, the message "No signal: that change wasn't saved" is false. The plan needs per-call success tracking, or a message that says the screen could not be confirmed.
- AuthError: loadTrip throws AuthError on a 401 (api, ~104-111). act() has already drawn the login screen. The new redraw would paint the family screen over it. The redraw and the message must skip AuthError. Today the catch just ignores it.
- The message wording contradicts what the app already says. For a no-answer save, the existing message is "may or may not have saved". "wasn't saved" is only true for a refused save. The message should separate the two cases.

Same problem elsewhere: the staff screen (save1 ~752), add-person (~859), remove-person (~1590) and the name and pay-note fields all go through famSave, so one change covers them. But add-person's "put back what they typed" step (~863-870) acts on the old form node, which the new redraw replaces. Check that path. The settle-tab ticks (toggle-paid ~1649) did not show an optimistic flip in my read; I did not trace them fully.

More than needed? The redraw itself is the smallest fix. Fine.

Timing: a tap shows as on for up to the 25-second save timeout plus the 25-second reload timeout before it reverts. The plan does not mention this; acceptable, but the parent should know.

What holds up: the queue and the failed flag in famSave; reusing renderFamily; keeping typed text in a field still being typed; the reload-after-save design generally.

Summary of the asks: for Problem 1, write the draft explicitly, cover the pre-check branch, fix the unanswered wording, stop the trip-screen route dropping a refused edit, and give deleted and finalized refusals their own messages. For Problem 2, track which saves succeeded, skip AuthError, fix the message wording, and add the fencing function.
