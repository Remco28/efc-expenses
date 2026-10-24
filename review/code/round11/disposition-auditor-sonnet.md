Audit of round 11 (README.md lines 422-453, the five reports in round11/, billing-model.md, the code-review severity scale, SKILL.md step 4). I read the code only for rows 8 and the finalize fingerprint, at HEAD 3b667fe. I did not run anything. Row 9's mechanism and row 11's waiting card are taken from the reports.

**Summary.** The author's one upgrade (row 1) is defensible. The real problems are three LOW ratings that the scale and the author's own round-10 reply say should be MEDIUM or HIGH, a false reason, and one finding that never reached the table. Round 11 ratings were applied differently from the round-10 rulings.

**1. Ratings and decisions that do not hold up**

- **Row 9 (a family removed while a meal ticking it is saved leaves a dead id in the split). Rated LOW, not fixed. It should be MEDIUM, and it falls under "fix tier 1".**
  - The scale's MEDIUM is "wrong only in a rare timing". The README's round-10 reply says exactly this: "'Wrong only in a rare timing' is the scale's MEDIUM." That reply upgraded round-10 row 12 for the same kind of reason. Row 9's reason, "needs two phones within ms", is the same reasoning the audit rejected.
  - The wrong result is silent. The removed family's part is absorbed by everyone else. The reason says "finalize blocks it visibly", but that holds only if that family was the sole one ticked.
  - The reviewer's LOW was copied. The reviewer proposed a fix (check the ticked families inside the insert/update statement). The author did not take it.

- **Row 8 (a retried trip-details save blames "another phone"). Rated LOW, not fixed. The stated reason is false.**
  - The reason is "can't tell its own earlier save from another phone's without more state". In `src/index.ts` (about line 404), the server already holds both the requested dates and the current dates. If they are already equal, the retry could simply return ok. That needs no new state.
  - The same class, "retry after a lost reply blames someone else", was fixed in round 10 row 6 by rewording, and the equivalent expense retry was made idempotent. Round 11 leaves the same class unfixed in one place. The reason offered is a convenient one, not a real constraint.
  - The falsely stated reason is also the same pattern the round-10 audit found in row 12.

- **Row 5 (toggling Fencer off and on silently changes a person's days). Rated LOW. It is the same class as round-10 rows 1 and 2, which were rated HIGH.**
  - Round 10 row 1 (off/on loses a fencer's ticks) and row 2 (the same on another path) were rated HIGH. The audit raised row 2 from MEDIUM to HIGH because "a path few people use" was "asserted, not shown".
  - The fix auditor ran this one and said it changes the coach's hotel and own-meal shares. It also said the warning disappears and "nothing says why". That is a wrong share with no explanation.
  - The author's own row 1 (HIGH) is the same mechanism: the "start on every day" rule firing on a fencer with no days. Row 5 is the second path of that rule and should carry the same rating. "Gone with row 1" explains why it was fixed. It does not support the LOW rating.
  - This is the round-10 mistake #1 again: a rule judged on the path where it was first found.

- **Row 4 (a reused family number, with "Open it to fix", ticks the wrong family). Rated LOW. Row 2, the same cause (family numbers reused), is rated MEDIUM.**
  - Row 4 can charge a meal to a family that did not attend. Row 2 only shows the wrong family name on the "You" card. The difference in rating is unexplained.
  - The fix auditor's point that the tag check "passes because the tags are rebuilt from the current trip" is not addressed in the README. The row says "only families whose tag still matches stay ticked", with no sign the author checked that the fix actually closes the case the auditor described.

- **The finalize fingerprint is not in the table at all.**
  - Both Sonnet readers noted it and did not rate it. In `src/index.ts` (line 394), GET `/tournaments/:id` reads the trip and the fingerprint with `Promise.all`, as two reads. A change landing between them puts a newer fingerprint on older numbers, so finalize would accept numbers the treasurer never saw.
  - This is the "finalize locks numbers the treasurer hadn't seen" class: HIGH in round 9, MEDIUM in round 10 row 12. The round-10 reply claimed to close it "by the numbers themselves", but the fingerprint and the numbers are fetched separately.
  - Both reviewers called it covered by the activity check, and the round-10 audit had just shown that check has a millisecond hole. The author took the reviewers' non-rating, not the audit's lesson. At minimum it deserved a row, probably MEDIUM, and the fix is small: compute the fingerprint from the loaded trip.

- **Row 1 (new fencer starts on every day). The HIGH is defensible, but the reason given is not a scale criterion.**
  - The rules reviewer (MEDIUM) said the Fencing days screen and treasurer check make it visible and recoverable until finalize. By the scale's wording that is MEDIUM. The author's HIGH follows from round-10 precedent (a silent wrong share) and from the warning never firing, which I accept.
  - The reason given in the table is "My own default, chosen without asking". That is about authorship, not severity. The "Predictions" section then counts the author's own upgrade as "HIGH right in number".

- **Row 11 ("not a finding", superseded by Frank's billing decision). The reason is stretched.**
  - billing-model.md says a meal can wait on the phone. It does not say anything about hand-set shares. The reviewer's other point was that the waiting card shows only description and amount, so the parent can't check the split they chose. That is not answered.
  - Hand-set shares may no longer exist after the rebuild, in which case the row is moot. But then the answer should be "no hand-set shares remain", not "Frank decided". I did not check the card in the code.
  - Round-10 mistake #2 was cutting something from a design without changing it. Here the design note is left as "history".

- **Other items the readers raised and the table drops without a row.**
  - Five old test scripts crashed in the fix auditor's copy and were not followed up.
  - Whole-code Sonnet's "1.250 read as $1.25".
  - Whole-code Haiku's queued expense refused after finalize, seen only on the payer's phone. Haiku called it accepted by design.
  - Triage without a record of why is what the round-10 audit complained about.

**2. Real or convenient reasons**
- Real: row 3 (old drafts). Real: row 7 (stale finalize screen), but the fix was wording and a catch-up only. Real: row 10, helped by the browser check that caught the stray reference.
- Convenient: row 8's reason, which is false. Row 9's reason, which is the one the round-10 audit overruled. Row 5's "gone with row 1". Row 11's "superseded".
- Also asserted rather than shown: "visible" and "recoverable" are used for rows 5, 8 and 9. The round-10 audit rejected exactly that kind of assertion.

**3. Did the round-10 responses change round 11?**
- Only partly. What carried over: the author upgraded row 1 above the readers, and asked Frank about the default instead of deciding it. That is the memory rule on confirming decisions, and the "Mistakes" section says so.
- What did not carry over:
  - The "rare timing is MEDIUM" ruling (row 9).
  - "Same class, same rating" (rows 5 vs round-10 rows 1 and 2; row 4 vs row 2; row 8 vs round-10 row 6).
  - "Assert and don't show". The audit asked that the table say how each finding was checked. Round 11's table has no such column. The only checks stated are "(ran it)" attributed to the readers and "(browser check)" on rows 2 and 3.
  - Most "Ours" entries still copy the reviewer's rating (rows 2 to 11 all match). The only difference from a reviewer is row 1, and row 11 is "not a finding".
- So the audit changed how the author described things (the table is more careful, with a "Believed, and wrong" section) more than how they rated the unfixed LOW items.

**4. Same kind of problem rated differently**
- Retry after a lost reply blames someone else: LOW and reworded (round 10 row 6), LOW and not fixed (round 11 row 8).
- A rule firing the wrong way on Fencer/days: HIGH (round 10 rows 1 and 2, round 11 row 1), LOW (round 11 row 5).
- Reused family number selects the wrong family: MEDIUM (row 2), LOW (row 4).
- Rare timing: MEDIUM when it was round-10 row 12 after the audit, LOW now (row 9).
- Finalize reading unsynchronised snapshots: HIGH (round 9), MEDIUM (round 10 row 12), unrated (round 11).

**Not checked:** the waiting-card contents, whether the row 9 race really exists in the insert/update code, and whether the reused-number fix in row 4 closes the case the auditor described.
