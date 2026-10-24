Review of plan v2 against the current code (public/app.js, src/index.ts). Nothing was changed or run.

**Summary:** the plan is mostly sound. Items 3, 4, 6, 7, 10 and 11 close their gaps. Four items need a correction before anyone writes code: 2, 3, 5 and 6. Each of those has a hole that would either leave the gap open or add a new bug. Items 8 and 9 are cosmetic and could be dropped.

**What holds up**
- The tag-in-the-write idea (3, 4, 6) is the right fix. Today's checks are a read followed by a write: expenseInput reads the family tags, the payer's tag is a separate read (src/index.ts ~711), and the treasurer family is a separate read (~545). The race window is real, and putting the check in the same statement closes it. The person insert and the family delete already work this way, so it matches the codebase.
- Item 7 is a genuine crash. `fam` at src/index.ts line 631 can be undefined if the family is deleted between lines 625 and 631, so `fam.uid` throws. A plain null guard answering stale() fixes it. The insert itself is already guarded.
- Item 10 is safe. loadTrip's batch carries the fingerprint, and a D1 batch runs as one consistent unit. The final write is still guarded by "fingerprint equals snap", so dropping the third read loses nothing.
- Item 11 is correct. famSave and fencingSave work out "am I still on this screen" from `S.trip.tournament.id` at completion time. S.trip may have been replaced by then, and that is the original problem 1 again.
- For edits, rev already protects the original picks. Deleting a family bumps rev on every expense that ticked it, and a payer who has expenses can't be deleted. So only newly picked families and a newly picked payer need tags on an edit, and tagOf already records those on tick.

**Item 1: expired login during a save**
- It would close the gap. The bug is real: `app.inert` stays true when renderLogin runs, so the login form can't be typed into.
- It leaves the same gap elsewhere. Fixing this at each exit of saveExpense is fragile, because the next person to add an exit forgets. One line in renderLogin itself (`app.inert = false`) covers every caller: saveExpense, the receipt upload, delete, and act().
- It is more than needed if done at each exit. The renderLogin version is smaller.
- thaw() only acts when `S.draft === d`. If the parent already left, show() has already cleared the flag, so that case is fine.

**Item 2: carry on to the send after the parent leaves**
- It breaks something if done as written. After the first check, saveExpense compares `fresh` with `S.trip`. If the parent has moved to another trip, S.trip is now that other trip, so the comparison is always a mismatch. The mismatch branch then paints trip A's editor over trip B's screen. The plan says "nothing is redrawn", but the code needs two changes to get there: capture the trip at the start of saveExpense and compare against that, and skip the redraw when the parent has left.
- The plan doesn't say what happens if "who's on the trip" changed and the parent has left. For "who took part" the server tag check (item 3) catches it. For the two fencer-based splits, sending anyway silently charges amounts the parent never saw. Decide one of two things. Either refuse and say so with a toast ("not saved, who's on the trip changed"), or accept the different amounts. I'd refuse with a toast.
- This item changes today's behaviour from "stop quietly" to "save after leaving". That is a policy choice. Stopping quietly with no message may be the real defect, and a toast alone might be enough. Frank has already agreed to carry on, so just make sure the toast names the trip, because it may now appear on a different trip's screen.
- Minor: a leftover kept draft can reappear if the parent returns to the form. That is harmless, because the same client_key makes the second save a no-op. For an edit, the second save gets the "changed after you opened it" message, which is already handled.

**Item 3: tags checked in the expense write**
- It would close the gap, with three pitfalls.
  - **Wrong error message.** The insert uses ON CONFLICT DO NOTHING RETURNING, so a mismatch returns no row, and the code then throws closed(), the wrong message. The no-row case needs a follow-up read to tell apart closed trip, duplicate, and tag mismatch. The PATCH path has the same problem: a no-change result already reads as "changed on another phone".
  - **Compare against the stored split.** The comparison must be against the keys of the stored split, not against whatever keys split_uids happens to hold. A ticked family whose uid was undefined on the phone vanishes from the JSON. In SQL use "is not" semantics so a missing tag counts as a mismatch, not a pass.
  - **Old phones.** A phone with the old app, or a held expense from before the update, sends no tags. The plan says "when one is sent", which is right and should stay. Say so explicitly, so nobody makes tags mandatory and refuses every old held expense.
- It is not over-built. The read-then-write version in expenseInput can stay as the early friendly message, with the in-statement check as the real guard.

**Item 4: payer's tag on edits**
- It would close the gap, but the PATCH code today never checks paid_by_uid. Only POST does, at line 711, and the client sends it only when `!d.id`. Both sides need to change.
- The edit draft is built as `{...e, ...}` with no `tags`, so for an edit `d.tags?.[d.paid_by]` is empty. The code falls back to `payer.uid` from the current S.trip at save time. For an unchanged payer that is harmless, because that family can't be deleted. For a payer changed during the edit it is fine only because the click handler calls tagOf. Check that the kept-draft round trip preserves `tags` for edits.
- Old kept edit drafts have no tags and will just send the current tag.

**Item 5: reload and redraw after a refusal**
- This one has two problems.
  - **Edits loop forever.** The "reopen check" that clears picks whose family changed (renderEditor, lines 931-941) runs only for new expenses (`!S.draft.id`). If item 4 makes edits refuse, the redraw won't clear anything, and every save repeats the refusal. The check has to run for edits too. There, picks that match the stored expense stay trusted, and only newly ticked ones are checked. Applying the new-expense rule as it stands would wipe every pick, because edit drafts have no tags.
  - **No way to recognise the refusal.** The client can only see status 409 and a message. There are several unrelated 409s: expense changed, receipt expired, trip closed. Matching on the message text is brittle. Add a small code to the error body, e.g. `family_changed`.
- The plan doesn't say the reload needs the "still here" guard. It is the same shape as problem 1: a slow reload landing after the parent moved on. Use the same guard, and also check `S.draft === d`.
- A second round trip on a weak signal can fail. In that case do nothing but the toast; the message already says what to do.

**Item 6: treasurer's family tag**
- It would close the gap. The current PUT checks the family with a read at ~545 and then updates unconditionally, so a replacement on the same number slips through. Put the tag in the UPDATE's WHERE clause (uid = sent tag, kind = 'family', same trip).
- The tag must be captured when the sheet draws its options, e.g. as a data attribute on each option. If it is looked up from S.trip when the parent confirms, a background refresh in between turns it into the replacement's tag and defeats the check. The sheet can sit open a long time.
- It matters even when the family is unchanged. The column has ON DELETE SET NULL, so a deleted treasurer family is cleared. But a stale sheet that re-saves the old number would attach the replacement. That is the case this closes.
- "Not on this trip" sends no family and so no tag.
- An old phone sends no tag. Say whether that is refused or accepted. Refusing with "reload" is fine because this action is rare.
- Outside the plan, worth a line: deleting the treasurer's family silently makes the treasurer "not on this trip" and changes the money, with no warning at the delete. It is not one of the six problems, but it is the same family of gap.

**Item 8: the "you" label**
- It would work but is small. whoNow() finds the family by number alone, so a replacement family could add or drop "(Coach)" on the name sent with changes. That is a cosmetic mislabel only.
- Switching it to myFamily() has a side effect: myFamily writes the tag on first use. whoNow runs on every request, so the first call after a stale pick would bind to whichever family holds the number then. The "your family" card has the same weakness, so it is not worse, but it is not closed either: setMe followed by myFamily binds to whatever family currently has that number.
- myFamily also returns "none" or null, so whoNow must handle both. Worth doing only if it is a one-line change.

**Item 9: message for old drafts without tags**
- It is more than needed. Those drafts live in sessionStorage, so they exist only across a deploy, in tabs already open. The code also sets `d0.tags ||= {}` right after the check, and new drafts always have `tags: {}`. Telling the two apart means checking for a missing tags object before that line.
- It is harmless and the wording is better than a false "families changed". Do it only if it costs nothing; skip it if it takes any new branch.

**Items 10 and 11:** no problems found beyond the points above. For item 11, capture the trip once at the start of each queued save and use that for every "still here" test, including the loadTrip call.

**Overall:** keep 1 (done in renderLogin), 3, 4, 6 (with the tag taken when the sheet draws), 7, 10 and 11. Keep 2 and 5 only after fixing the capture-the-trip problem, the edit case, and the error code. Items 8 and 9 are optional.
