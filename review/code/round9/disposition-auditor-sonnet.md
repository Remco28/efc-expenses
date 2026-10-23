Audit of Round 8 in review/code/README.md (scratchpad rl9/whole-sonnet). I read the five round-8 reports, the scale in code-review.md, SKILL.md step 4, and checked claims against src/index.ts and public/app.js. I changed nothing.

**Short answer.** The ratings for the eight table rows mostly hold. The weak spots are in the "not fixed" and "known LOW" lines, in two reasons that are the same "visible" reasoning the author's own response to the previous audit rejects, and in one regression the fix for row 3 introduced.

## 1. Ratings or non-fixes that do not hold up

**A. "Tag checked just before the write rather than in it" (fix auditor), left as known LOW, unfixed.**
- It should be MEDIUM, and it is a cheap fix.
- The scale says "wrong only in a rare timing" is MEDIUM. The fix auditor's own reasoning (id reused inside one request's window) is a rare-timing case, not an annoyance.
- I checked the code. `DELETE /families/:id` does `DELETE FROM families WHERE id = ?1 AND ${can}` with no uid in the WHERE. The uid is compared earlier in JS (src/index.ts ~line 531-535). The same holds for person DELETE. This is a delete of a family or person on a possibly reused id, which is the EFC-03 mechanism the previous audit made the author re-rate.
- The author accepted R7 #6 (overlapping saves, rare timing) as LOW to MEDIUM, and the audit named "check done before the write rather than in it" as a pattern rated inconsistently. Round 8 repeats that pattern as LOW and unfixed, and the response never mentions the pattern.
- The fix is putting `AND uid = ?` in the WHERE clauses. SKILL.md step 4 allows leaving it only if it is unverified tier 2. The README does not say anyone tried to kill or confirm it, and "known LOW" is not a triage outcome.

**B. Row 7, "12,50" read as $1,250, LOW. The reason given is the exact one the author calls a mistake.**
- The reason is "shares show before saving", which is "the user can see it". The author's own list of mistakes puts that first: "Visible and recoverable is MEDIUM".
- The scale does have "edge-case input" under LOW, and that could carry the rating. But it is not the reason the author wrote. Neither Sonnet nor the author argued that comma decimals are rare for this club.
- A 100x money error is a wrong result in a plausible entry. I would rate it MEDIUM, or LOW only with the edge-input argument stated. It was fixed anyway, so this matters for consistency, not outcome.

**C. "Adding a day to a family doesn't make its fencers fence it", listed as judgement, not a defect, LOW, unfixed. This is the mirror of row 5.**
- Row 5 (untick/re-tick Fencer gives every day) was rated MEDIUM and fixed. The effect is a wrong fencer-day count in the coach's stay split, "visible on the family screen".
- C produces the same wrong fencer-day count in the other direction, and the money specialist called it "inconsistent with the stated default". It is rated LOW with the reason "the form shows the state". That is the same visibility, rated differently.
- One of the two is wrong. Either both are MEDIUM, or the author should explain why a missing fencing day is intended and an extra one is not. The honest answer may be that intent is unknown, which is what "for the human" should say. It currently says LOW.

**D. "A family added with no days gets the whole trip", labelled design.**
- This is Haiku's own label, and the brief may name it as intended. I did not find that in the briefs. I only skimmed that part.
- It sits next to row 4, where a family joining mid-expense is charged and the author called it MEDIUM. The earlier-expenses version charges a late-arriving family for everything before it arrived, silently, until someone sets its days. Rated as a design question with no rating, it dodges the scale.
- Fine to hand to the human. The README should give it a rating, and MEDIUM looks right.

**E. Row 8, draft PDF table doesn't add up, LOW "drafts only".**
- Borderline. A visibly wrong money figure on a document parents read is MEDIUM by the scale's "visibly wrong and recoverable". Both reviewers said LOW and the "draft only" reason is not the visibility reason. I would not insist.

**F. "PDF test-embed doubles the work on large receipts… unmeasured, which is the cost reader's job."**
- No cost reader ran in this round, so this defers to a role that was not used. Doing the measurement was cheap: one large PDF receipt, timed.
- It is a client-side phone cost. LOW is a guess, not a rating.

**Rows that hold.**
- Row 1 HIGH holds on Haiku's repro. The shortening and its confirmation fix are fine.
- Rows 2, 3, 4 and 5 as MEDIUM are defensible.
- Row 6, Sonnet LOW to MEDIUM, is correct and is the clearest case of the audit changing a rating.

## 2. Are the stated reasons real?

- Mostly real. The author separated what Sonnet reproduced from what it reasoned, and rows 2, 4 and 5 cite runs.
- **Row 1 overstates the reproduction.** "Two reviewers… both ran it" is not quite true. Sonnet's report says it did not watch ticks being dropped in its run and read that part from the code. The HIGH rests on Haiku's repro. It holds, but the justification is padded to look like convergence, and the cast note admits these two share a lineage.
- **Convenient:**
  - Row 7's "shares show before saving".
  - Row 8's "drafts only" combined with LOW.
  - "Left as known LOW" for A. It sounds like a decision, but no check or kill attempt is recorded.
  - "The cost reader's job" for F.

## 3. Did the response to the previous audit change round 8, or only the description?

Partly changed:
- Row 6 was explicitly upgraded "by the scale".
- Row 5 is MEDIUM and fixed.
- The README now says how the agy claim was tested.

Not changed, or only described:
- The audit's actual diagnosis was "visible/recoverable used to argue LOW". Round 8 still uses visibility to hold LOW (rows 7, C), and still labels a mirror case as "judgement".
- The audit's pattern list included "check done before the write", rated LOW three times and fixed twice. Round 8 repeats it as LOW and unfixed, and the response table does not touch it.
- The response table covers R3 #11, #13, R5 #4, R6 #5, R7 #1 and #2, #4 to #6, R3 #3, and the id-reuse note. It silently skips the audit's R6 #7 and R3 #15 non-fix points. R6 #7 is now harmless: PATCH and DELETE require `rev`, and `b.rev !== old.rev` refuses a missing one. But the README never says that, and R3 #15 is simply left unanswered.
- "Round 8 found a HIGH, so a round 9 follows" keeps the exit rule the previous audit blamed: stopping on "no HIGH" by the author's own rating. It was not revisited.
- This round's ratings were not given to the disposition auditor. That auditor read only the old README (a rl8/codex copy). It never saw round 8, so round 8 is self-rated.

## 4. Same problem, different ratings within and across rounds

- **Rows 5 and C**: fencer-days wrong in one direction, MEDIUM and fixed; the other direction, LOW and unfixed (see C).
- **Row 2 against the unfixed tag-check line**: both are id reuse landing on a stale write. Row 2 is MEDIUM. Item A is the same mechanism with a shorter window, LOW. The window length is the only difference, and under the scale a shorter window does not make it LOW.
- **Rows 4 and D**: a family added meanwhile is charged for something the screen didn't show. MEDIUM for the expense form; unrated design for the earlier-expenses version.
- **Row 3 against R7 #6 and the receipt rows**: consistent. No complaint.

## Extra problem not in the author's table: a regression in the fix for row 3

I did not run this. It is reasoned from the code.
- `client_key` is made once when the new-expense form opens (public/app.js:845) and sent unchanged with every save.
- The server answers a repeated key with `return json({ id: made.id }, 200)` (src/index.ts ~line 663), before looking at the body.
- Scenario: Save succeeds but the reply is lost, the draft stays on screen, and the parent corrects the amount and taps Save. The server says "already made" and returns OK with the old figures. The correction is dropped, and the form presumably navigates away as on success.
- That is a silent wrong result introduced by round 8's own fix, needing a lost reply plus an edit before retry. Rare sequence, so MEDIUM, though silent.
- The edit-side retry path is safe because it compares the content (`same`). The create-side retry does not.
- The Checks line lists no case for this. The fix needs either a body comparison or a new key when the draft changes.

## Overall

Nothing here changes the HIGH on row 1 or the claim that round 9 is needed. The things to fix are the unrated or LOW-labelled leftovers (A, C, D, F) and the create-retry regression. A and the create-retry regression are the two I would not let go unfixed.
