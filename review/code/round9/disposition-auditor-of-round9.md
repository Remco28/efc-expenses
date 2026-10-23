Audit of the Round 9 ratings in /home/frank/Dev/efc-expenses/review/code/README.md. I read all five reports in round9/, the scale in code-review.md, step 4 of SKILL.md, and the relevant code. I changed and ran nothing.

**Bottom line.** Row 1 should be HIGH and row 7 is at least borderline HIGH. Those two change the answer to question 5 and the "stop when no HIGH" decision. One reviewer finding was left out of the table. The rest holds up. The author applied the previous audit's lessons to the LOW-versus-MEDIUM boundary but not to the MEDIUM-versus-HIGH boundary, where the same audit had told them to move.

## 1. Ratings or decisions that do not hold up

**Row 1 (retried new expense drops the correction): MEDIUM, should be HIGH.**
- The scale's HIGH is "gives a wrong result, loses or corrupts data ... without anyone noticing", in realistic use. This finding meets every part of it:
  - The user sees a success toast ("Expense saved") while the correction is discarded.
  - Four readers ran it (fix auditor, Haiku whole-code, bad-signal, and the server half by Sonnet whole-code).
  - The trigger is a lost reply, which is the app's stated use case (round 8 row 3: "venue wifi makes it real").
- The author's reason is "a lost reply then a correction is a rare sequence, though the result is silent". That does not support MEDIUM. The MEDIUM wording is "wrong only in a rare timing or unusual sequence".
  - The only evidence of rarity is the author's assertion. No frequency argument is made.
  - "Though the result is silent" concedes the HIGH criterion and then does not apply it.
- The previous audit's own re-rating makes this HIGH. The author accepted R7 #2 ("an edit lost when a save lands") as MEDIUM to HIGH, and R3 #1 (a save landing over typed input) was HIGH. Row 1 is the same class: a correction silently discarded.
- Round 8 row 3, the same retry scenario, was MEDIUM because it made a visible duplicate. The same scenario with the visibility removed is a step worse by the scale's own axis, not the same.
- All five readers rated it MEDIUM. They are not independent on severity: same brief and scale, and four of them Sonnet or Haiku. Unanimity on rating is weak evidence. The README leads with "No reviewer rated anything HIGH" as if it were strong.

**Row 7 (finalize locks in numbers the treasurer hadn't seen): MEDIUM, should be HIGH, or at minimum flagged as contested.**
- The previous audit re-rated R3 #3 (treasurer change racing finalize) from MEDIUM to HIGH, and the author accepted it. Row 7 is the same class: finalize racing a concurrent edit.
- It is also a case of "lets through an action that should be blocked". Finalize is what produces the "please pay X" messages to parents.
- Its reason, "visible afterwards, recoverable by reopening", is the visibility reasoning the author said is MEDIUM at best. Here it is used to cap at MEDIUM something the author already rated HIGH in an earlier round.
- The one genuine counter-argument is that the payment list appears immediately after finalize. The author did not make it. That argument would also have applied to R3 #3.

**Row 13 (typed text lost when the phone switches apps): LOW, should be MEDIUM.**
- Row 4 (the expense draft lost when the phone reloads behind the camera) is MEDIUM. Row 13 is the same mechanism: the phone discards the page and typed work is lost.
- The reviewer's "narrow" is its own reason, not the author's. The author took the LOW without a reason of their own.
- Nothing warns the parent, so the loss is unseen. It was fixed anyway, so only the record is wrong.

**Omitted from the table: bad-signal MEDIUM 2.**
- Finding: after a lost reply on a new expense, the parent leaves the form and adds it again. That is a new `client_key`, so the expense is stored twice and the balances double-count it.
- It is not in the 13 rows and not in "still for the human". Triage rule: every finding gets a disposition.
- The fix may partly cover it. In `api()`, the changed message now reads "may or may not have saved. Check before trying again", but there is no dedupe. I can't tell whether this was a deliberate decision or a merge into row 3.
- The same shape remains in row 2's fix: add keys are in memory and keyed on the request's content. Lose the reply, correct the name ("Av" to "Ava") or reload the page, and you get a duplicate again. This is the author's own "mistake 1" (a retry is the same request only if its content is the same), left in the add paths.

**Row 6 (delete sends the newest revision): MEDIUM is defensible, but it is inconsistent with row 1.**
- Row 6 needs three conditions at once and is MEDIUM. Row 1 needs two, is silent, and is also MEDIUM.
- If row 6 is MEDIUM for rarity, row 1 cannot be at the same level on the same reason.

Rows 2, 3, 4, 5, 8, 9, 11 and 12 hold.
- Row 5's rating is fine, though "Haiku MEDIUM, bad-signal LOW" was resolved without a stated reason.
- Row 12 is correctly LOW. The note about round 8 claiming a count the dialog didn't show is honest.

## 2. Are the stated reasons real?

**Real.**
- Row 8: checked, and the earlier audit confirmed in the code that the DELETE has no uid in its WHERE.
- Row 9: handled well.
- The PDF cost was measured instead of deferred.
- Admitting that round 8 row 1 rested on one reproduction, not two, is honest.

**Convenient.**
- Row 1's "rare sequence" reason (see above).
- Row 7's "visible afterwards" reason (see above).
- Row 10's "edge-case input for this club" is asserted without evidence. The same README treats "12,50" as plausible enough to fix twice, and the new `cents()` says decimal commas are normal. A club that types "12,50" will type "12,5". LOW is arguable, but the stated reason does not show it. The honest reason is that the preview shows the result, which is the reasoning the author said they stopped using. The 1000x error on "1.250,00" is the bigger worry.
- The README's "Believed, and wrong" is correct about the round 8 fix. But it records the miss as a regression in one fix. It does not record that five readers rated a silent data-discard as MEDIUM.

## 3. Did the response to the previous audit change round 9, or only the description?

**It changed:**
- Rows 6 and 7 were raised to MEDIUM from reviewer LOWs.
- Rows 8 and 9, which the previous audit flagged, were fixed.
- Row 10's reason was rewritten honestly.
- The PDF cost was measured.

**It did not change:**
- The previous audit's biggest accepted change was raising R7 #1, R7 #2 and R3 #3 to HIGH, with the note that "the reviews should not have stopped there". No round 9 finding got that treatment, although row 1 is R7 #2's class and row 7 is R3 #3's class.
- The prose describes consistency. The table keeps MEDIUM as the ceiling. Every finding that would have been HIGH under the accepted re-ratings sits at MEDIUM. The author relabelled the LOW/MEDIUM boundary and left the MEDIUM/HIGH boundary where it was.
- The README promised that "round 9's ratings get the same [audit] before any decision to stop". That is what this audit is. The headline "No reviewer rated anything HIGH" and the prediction "HIGH 0: right, by every reader's rating" still treat the readers' ratings as the verdict, which is the habit the audit named.
- The question "should 'stop when no HIGH' rest on the author's own ratings" was left "for the human". The author should have recorded this as a problem with the exit rule, not only a question.

## 4. Same problem, rated differently

- Row 1 against R7 #2 and R3 #1: an edit silently lost. HIGH earlier, MEDIUM now.
- Row 7 against R3 #3: finalize racing a change. HIGH earlier, MEDIUM now.
- Row 13 against row 4: typed work lost to the phone discarding the page. LOW against MEDIUM.
- Row 1 against row 6: row 6 is rarer and about as silent, yet both are MEDIUM. Compare also round 8 row 3, where the same scenario with a visible result was also MEDIUM.
- Rows 2 and 5 against row 1: all three are wrong results from the same lost-reply cluster. Rows 2 and 5 are visible and row 1 is not.

## 5. Does "no HIGH" hold, strictly against the scale?

No. By the scale's wording, round 9 had at least one HIGH (row 1), and a second (row 7) on the author's own earlier precedent.

- Row 1 is a regression from the round 8 fix, five readers found it, and it is silent. The author's "rare sequence" reason is not enough to override "without anyone noticing".
- Row 7 is the same kind of problem the author already accepted as HIGH.
- Row 6 could go either way. It deletes a correction the parent never saw, which is data loss. Calling it MEDIUM because three conditions are needed is defensible.
- If the stop rule is "no HIGH" and that rests on the author's own ratings, round 9 should not be the stopping point. Round 10 is warranted, at least on the retry paths (new-expense retry, adds keyed on content, a lost reply followed by a correction).

My own uncertainty: I did not re-run anything. Row 1's severity comes down to whether "lost reply, then a correction" counts as realistic or unusual. I think the scale's own words (silent, and the app's stated bad-signal use) push it to HIGH, but this is a judgement call the record should have shown as contested, not settled at MEDIUM.
