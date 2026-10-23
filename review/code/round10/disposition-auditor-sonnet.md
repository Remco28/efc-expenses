Audit of round 10 ratings (README "Round 10", reports in round10/, checked against the code where noted). I changed nothing.

Overall: the HIGH on row 1 is sound and is a real change from past practice. The weak spot is the finalize cluster (rows 11 and 12), which is rated LOW against the author's own HIGH precedent. Two or three "not fixed" reasons are asserted, not shown, which is the habit the previous audit named.

## 1. Ratings or decisions that do not hold

**Row 12 (finalize activity check misses a change in the gap between a write and its log line): LOW, not fixed. Should be MEDIUM at least, and the stated reason is wrong.**
- The scale's LOW is "abuse by someone already trusted, edge-case input, annoyance". "Wrong only in a rare timing" is the scale's MEDIUM definition, word for word. The reviewer's LOW and the author's both slipped past it.
- The class is "finalize locks numbers the treasurer hadn't seen". That is round 9 row 7, which the author re-rated HIGH ("the same class as R3 #3, already accepted as HIGH"). Row 12 is the same class at LOW.
- The reason given is "the fingerprint still covers money changed before the batch". I checked `src/index.ts` (finalize, around lines 422-446). The fingerprint is a server-side snapshot taken after the request arrives. It is compared with itself, not with what the user's screen showed. If phone A's write has committed but is not yet logged, phone B's finalize passes the activity check. The fingerprint then snapshots A's change and locks it. So the fingerprint does not cover this case, and the reason does not answer the finding.
- "Reopenable" is true, but reopening clears ticked payments (the round 9 row 12 warning). That is recoverable, not harmless.
- "Milliseconds" is asserted. Nobody measured or showed it. This is exactly the "rare sequence asserted, not shown" that the round 9 audit rejected.
- Not fixing a LOW is fine. Rating it LOW on a wrong reason is the problem.

**Row 11 (finalize reads `seen_activity` after the confirm sheet, so a waiting expense sent meanwhile on the treasurer's own phone is locked unseen): LOW. Should be MEDIUM, arguably HIGH by the author's own precedent.**
- It is the same "locks unseen numbers" class as round 9 row 7 (HIGH) and row 12 above (LOW).
- The trigger is realistic. A treasurer finalizing with an expense waiting on their phone, which is the bad-signal use the app is built for.
- It was fixed, so no behaviour is lost. But the rating feeds the stop rule, and row 11 and row 12 sit at LOW while the same class sat at HIGH one round ago.

**Row 2 (own days / switch back to the family's days: a fencer's day not fenced): MEDIUM, reason "same mechanism as 1, on a path few people use". Should be rated with row 1, or the reason should be shown.**
- It is the same silent wrong per-fencer-day share as row 1, in a different place.
- "A path few people use" is a frequency claim with no evidence. The round 9 audit rejected that kind of reason. The scale does not rate by how many users reach a path.
- Without the number of own-days users, this is row 1 at one level lower for no stated reason. The auditor would not die on this one, but the reason is convenient.

**Row 3 (family added without days counts for every day, including before it arrived): MEDIUM is defensible, "Not fixed" is not well supported.**
- The round 9 disposition audit (round9/disposition-auditor-sonnet.md, item D) already said this should be rated MEDIUM and not left as "design". The author did rate it MEDIUM this time. That part follows the audit.
- But it was deferred to "Frank" twice with the same reason ("every day" is the default). The reason defends the default. It does not answer the scenario: a family joining after expenses exist is silently charged for earlier costs.
- Haiku ran it (tier 1 by the skill: checkable against the artifact). Rows 7, 8, 10 and 11 were reasoned by one reader and fixed. The best-verified MEDIUM was the one left alone.
- The rejected option "from today" is a straw man. The third option, which the author did not consider, is to require or confirm days when expenses already exist.
- Sending a design choice to Frank is legitimate. Leaving the rating and the decision both open, again, is not a closed finding.

**Row 9 (identical "Alex" in the same family after an unsure add): LOW, "that is the duplicate guard working". Weak, borderline MEDIUM.**
- The fix auditor said the toast says "added" while no second record appears. In `app.js` the person form toasts `${n} added` from famSave regardless of the server's already answer. A success message over a discarded action is the scale's HIGH class in round 9 (row 1), so LOW needs more than "rarer than the duplicate it prevents".
- That comparison is asserted. Two same-named people in one family is a real case for a club (siblings, or two families called Smith), and the add key is kept for 24 hours.
- It is visible in the list, so I would not push above MEDIUM. LOW, with that reason, is not supported.

**Rows 6, 7, 8, 10 (LOW): hold.** They are visible annoyances or misleading messages, with no silent loss.

**Rows 1, 4, 5: hold.**
- Row 1 HIGH is right: a realistic mistake-and-undo gives a wrong share with nobody told. Raising it above the reviewer's MEDIUM is consistent with round 8 row 1.
- Rows 4 and 5 at MEDIUM are visible and recoverable-ish. They match the round 9 row 13 precedent.

## 2. Real or convenient reasons

- **Real:** row 1 (shows the realistic path); rows 4 and 5 (the author admits dropping something from the design and owns it, "Believed, and wrong").
- **Convenient:** row 12 (the fingerprint reason is false, see above). Row 2 ("few people use"). Row 9 ("rarer than"). Row 3 ("default on purpose", sent twice to Frank).
- The pattern is that the not-fixed and downgraded rows all rest on frequency or on a design label, and none shows how often.

## 3. Did the previous audit's response change how round 10 was rated, or only how it was described?

- **Changed:** row 1 rated HIGH, above the reviewer's MEDIUM, on the scale's words. Row 3 rated MEDIUM when it had been unrated "design". The headline "No reader rated anything HIGH" still opens the section, but the author's own HIGH sits right below it, so it no longer stands in for the verdict.
- **Not changed:** every other row copies the reviewer's rating exactly. In round 9 the author differed on many rows. Only rows 1 and 2 add independent judgement.
- **Not carried over:** the response named the "visible, so recoverable" reasoning and the "finalize locks unseen numbers" class (HIGH). Round 10 gives the same class LOW twice (rows 11 and 12). The lesson was learned for that row and not for its siblings.
- **Process:** the house rule is that each finding's record says how it was checked. The table has no such column. Rows 4, 5, 7, 8, 10, 11 were single-reader and "reasoned" yet were fixed with no recorded check or kill attempt (SKILL.md step 4, tier 2). The browser checks for rows 4 and 5 came after the fix.
- **Missing:** the README does not say whether a round 11 follows, which the round 9 text did say. It only says a disposition audit is expected before any stop decision. This audit is that step.

## 4. Same problem rated differently in different places

- **Finalize locks unseen numbers:** round 9 row 7 HIGH, round 10 rows 11 and 12 LOW. The sharpest inconsistency.
- **Silent wrong fencer-day share:** row 1 HIGH, row 2 MEDIUM, round 9 row 9 MEDIUM, round 8 "money F4" LOW. Row 2's MEDIUM follows round 9's, but not row 1's HIGH.
- **Success message over a discarded action:** round 9 row 1 HIGH; round 10 row 9 LOW.
- **Silent wrong charge to a late-joining family:** round 9 row 5 (family joining mid-expense) MEDIUM; round 10 row 3 MEDIUM. Those two agree, but the first was fixed and the second was not.

## Things I did not check

- Whether the row 1 rest-days redesign (migration 0012) has a new silent behaviour of its own. It says a fencer who rests every day and is given a new day will fence it. That is the "guess intent from the lists" the peers criticised. I did not run it.
- Whether `log()` can fail after a commit and leave a permanent hole in the activity check (row 12). I did not run or read that path.

Key files: /home/frank/Dev/efc-expenses/review/code/README.md (Round 10, lines 353-395); /home/frank/Dev/efc-expenses/review/code/round10/ (fix-auditor-sonnet.md rows 4 and 6, whole-code-sonnet.md finding 2, whole-code-haiku.md finding 1); /home/frank/Dev/efc-expenses/review/code/round9/disposition-auditor-sonnet.md (item D); /home/frank/Dev/efc-expenses/src/index.ts (finalize, ~422-446); /home/frank/Dev/efc-expenses/public/app.js (person add toast, ~line 850).
