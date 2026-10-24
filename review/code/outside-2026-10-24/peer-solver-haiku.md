I read problems.md, the whole of src/index.ts and all of public/app.js in /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/prefix/. I changed, created and ran nothing. Line numbers below are in those two files.

1. Late refresh lands on the wrong trip (app.js)
Fix: stop loadTrip from assigning the global trip. It should return the data, and each caller should assign it only after checking it is still the same trip and screen. The screen code in show() and refresh() already does this check. Capture the trip id and hash when the save is queued, not when it finishes. This touches loadTrip (167-ish, app.js 287) and its two callers, famSave (797) and fencingSave (901).
Cost: small, a few lines. Nothing else changes.
Might break: any code that relies on loadTrip's side effect. I found only those two callers.
Same problem elsewhere: the family-screen save and the fencing-day save are both affected, as the report says. refresh(), show() and saveExpense are guarded and fine. Minor related point: a queued save builds its tags from whatever trip is current when it sends, not when it was tapped. Family ids look global, so this is probably harmless, but it is the same kind of drift.

2. A correction typed during Save's first check is lost (app.js saveExpense, 1212-1268)
Cause: the request body is built from the form before the fresh trip check (line 1221). The form only freezes after that check (1249-1251). Typing during the check changes the draft but not the body that is sent.
Simplest fix: build the body, and run the amount/payer checks, after the check returns, from the form as it stands then. Nothing can be typed between that and the freeze, since it is all one synchronous step. The server's tag checks still cover a family replaced during the wait.
Alternative: freeze the form before the check. This needs an unfreeze on every early return, including the error toast, so it is more fragile.
Cost: small. Might break: if the split is changed during the check, the client-side whoIs comparison no longer matches exactly what is sent. The server's tag check catches that case.
Same problem elsewhere: the Save button is also enabled during the check, so a double tap sends two saves. They share a key, so the server keeps one; it is harmless but untidy. The add-person box is fine because the redraw keeps typed text.

3. An unfinished meal reopened after a family was replaced on the same number (app.js keptDraft 1204, renderEditor 921, saveExpense 1223-1225)
Cause: the draft keeps ticks and the payer by family number. When saving, the tags (uids) are looked up in the trip as it is now, so the replacement family's tag matches and the server accepts it. The waiting-expense path (rewait, 1444-1459) already does this correctly: it stores the tags when the expense is held and filters on them when reopening.
Simplest fix: store the payer's tag and each ticked family's tag in the draft when they are set (markPaid, drawSplit). Keep them through keepDraft. Send those stored tags in saveExpense. On restore, drop any tick or payer whose stored tag no longer matches the family, and tell the user. Use the same rule for old drafts that have no tags: drop the tick, or ask. This is a decision for Frank.
Cost: small to medium. Might break: old drafts saved before the change have no tags, so the choice above applies to them.
Same problem elsewhere: yes, for editing an existing expense too. keptDraft works for edits (k.d.id === id), and the paid-by tag is only sent for new expenses (1223), so an edit restored from a draft can silently move its payer to the replacement family. The server's PATCH does not check the payer's tag at all.

4. Changing a name undoes a Fencer change, or the reverse (src/index.ts person update, 646-675)
Cause: the single UPDATE writes both name and is_fencer every time (line 672). A name-only change sends no is_fencer, so the server writes is_fencer from the row it read at the top of the request (line 670). A Fencer-only change does the same to the name. The client sends only the one field that changed (app.js 836-839), so the client needs no change.
Simplest fix: in the SQL, write each column only when it was sent, using the same COALESCE trick the fencing_days column already uses. Keep the current rule that a blank name keeps the old name. Null means "not sent".
Cost: small, server only. Might break: nothing I can see. Check that is_fencer = 0 still counts as sent (0 is not null, so it does).
Same problem elsewhere: the trip-details PATCH (line 418-419) reads the trip's name and location at the start of the request and writes them when the client omits them. The client always sends both, so this is latent, not live. The family PATCH is fine because each field has its own guarded statement. The treasurer PUT always writes its three fields together from the form; that is intended whole-form saving, not this bug.

5. The trip screen can show one treasurer with another's fingerprint (src/index.ts loadTrip, 167-186; fingerprint 121-129)
Cause: the trip row is read on its own (line 168), before the batch. The batch reads the other tables and the fingerprint, and the fingerprint includes the treasurer fields. A treasurer change between the two reads gives a mismatched pair. The finalize check then accepts it, because it compares the fingerprint the screen was sent with the same fingerprint computed from the same mixed state.
Simplest fix: add the trip row as the first statement in the same batch, and take the trip object from that result, including the deleted-trip 404. Then the screen and the fingerprint come from one snapshot.
Cost: one extra row in the batch, which is cheap. Might break: the 404 check for a deleted trip has to move onto the batch result.
Same problem elsewhere: finalize itself is safe. It re-computes the fingerprint after loadTrip and refuses if anything moved, so the mixed read cannot get through. The other GET users (the trip list, settle, the PDF data) all come through this same loadTrip, so they get the fix too. The write guards that read the trip row separately are fine, since each checks status in its own statement.

6. A person added to a family that just replaced theirs (src/index.ts person add, 618-645)
Cause: the family's tag is checked by a separate read (line 626-627), and then the INSERT (634-637) uses the family's number with no tag check. A family deleted and recreated on the same number in between takes the person. The family DELETE already does this correctly: its guard (line 607) checks the tag inside the same statement.
Simplest fix: add the same inline tag check to the INSERT's WHERE. Also check for a missing family before reading its tag, since a null row currently throws and returns a 500.
Cost: tiny, one extra bound value. Might break: nothing. A stale screen gets a 409, which the client already handles.
Same problem elsewhere: yes. The expense POST checks the payer's tag (703-706) and the split tags (224, via expenseInput) in separate reads, and the INSERT (708-711) guards only the numbers. The expense PATCH (736-745) has the same gap for the split tags and the payer. The window is small, but it is the same bug. The person PATCH and DELETE, and the family PATCH and DELETE, already guard tags in the statement, so they are fine.

Decisions to confirm with Frank before coding: for item 2, freeze-before-check or rebuild-after-check (I recommend rebuild, it has fewer unlock paths). For item 3, what to do with old drafts that have no tags (drop or ask). Each of these fixes is small, but none needs a schema change.
