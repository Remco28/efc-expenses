I found one clear failure of the author's own rules and four smaller problems. The ratings of rows 1, 2, 3, 4 and 6 hold.

What I read: README "Round 12" and the earlier audit responses, all five round-12 reports, the profile, billing-model.md, saving-design-v4 and the r12 briefs. I checked claims in src/index.ts and public/app.js. I did not run anything, and I did not check live data.

**1. Ratings and decisions that don't hold**

- **Row 5 (LOW, not fixed): the second half is a wrong-reason LOW, and the first half's reason is unchecked.**
  - The fix auditor's second item is a regression. A treasurer save on a trip finalized a moment ago used to say "finalized" (`closed()`). It now says "out of date" (`stale()` on the `sameFam` branch). The author's reason is "visible, and a reload fixes it". That is the pattern the profile rules out ("'Visible' or 'recoverable' alone never makes a finding LOW"). Round 8 was audited for exactly this.
  - A wrong message may still be LOW as an annoyance, but then the reason must say that. It should have been a LOW that is fixed. Rows 4 and 6 are also wording-only LOWs and are being fixed. Row 5 is the only wording defect on a regression that is left alone.
  - The first half ("the live data was cleared, so it can't occur") is a claim about live data. It was not checked. The clear happened at the rebuild before round 11. The old code let a treasurer's family be deleted until 64a1243, so a trip created in between could be affected. One query on the live database settles it. Until then, "can't occur" is asserted.
  - Two unrelated defects are bundled in one row, so one reason covers both.

- **Not rated at all: a save that was left and then refused.**
  - The fix auditor's "Minor" paragraph: if the user leaves the form while Save is checking, the save still goes. If the server then refuses it with a 4xx, the draft is already gone and the user sees only a toast.
  - In `saveExpense`, `left` is true, `thaw()` does nothing, and the `family_changed` redraw only runs `if S.draft === d`. So the typed expense is lost to a toast, on whatever screen they are now on.
  - This is the author's own round 10 row 4 / round 12 row 2 mechanism, "typed work lost after a save that couldn't land". That was MEDIUM both times. The README neither rates it nor lists it as "not given a row". Round 11 had a "Not given rows, and why" paragraph, and round 12 has none.
  - It should be a MEDIUM row, or a LOW with a reason. The fix auditor's own text ("the cost of the decision") is not a rating.

- **Other omitted reader observations.**
  - Haiku whole-code: a family removal bumps expense revisions. An open editor can therefore be refused for a reason the parent never saw. This is part of row 2's mechanism and appears nowhere in the README.
  - Haiku bad-signal listed three residuals: a refused waiting item is lost if the phone's storage is cleared, a deleted-then-resent item comes back, and the edit path under bad signal was not checked at all. The README says only "no reader rated anything HIGH".
  - The bad-signal lens never covered edits, family adds or receipt cleanup. "No reader found HIGH" is thinner than it reads, and the README does not say so.

- **Row 1 (MEDIUM) is rated correctly, but a sibling is missing.**
  - The same endpoint has the opposite race. A treasurer sheet opened on an open trip sends name, family and notes. If the trip is finalized before the PUT, the `t.status === "final"` branch updates the notes only and returns `ok`. The treasurer change is silently ignored and "Saved" is shown.
  - The plan's fix ("missing `treasurer_name` is never a removal") does not touch this. It is the same class (the server guessing intent from a stale status read) and is unrated.
  - Row 1's "visible afterwards" is soft reasoning. The MEDIUM is justified by the rare-timing rule, not by visibility.

- **Row 7, "not findings", is partly unjustified.**
  - The waiting-expense-after-finalize part is covered: the brief named saving-design-v4 as "chosen on purpose".
  - "Shortening then lengthening a trip doesn't bring fencing days back" is not named in the brief. The author cites billing-model and saving-design-v4 for it, but I found no sentence in either that covers it (billing-model's only line is that a fencing day lost by shortening is warned). The warning was reported to cover shortening. Whether it covers lengthening back was not shown.
  - Attribution is also off. Row 7 credits "rules, whole-code Sonnet, bad-signal". The shortening point came from the rules reader and Haiku whole-code. Sonnet whole-code and bad-signal raised the waiting-expense point.
  - "Not findings — —" removes both items from rating, which the profile does not allow. They should be LOW or MEDIUM with the "chosen on purpose" reason stated.

**2. Are the stated reasons real?**
- Row 3 ("the parent chose to leave, and Back is how the form is cancelled today") is partly real. But the `leaveDraft` comment in app.js says a new expense that needed a signal stays kept, and the function drops it unconditionally. Sonnet pointed at this. The code and its comment disagree, and the row does not mention it. LOW is defensible, and it is a question for Frank.
- Row 5 "can't occur" is unchecked, and "a reload fixes it" is a banned reason (see above).
- Row 2's precedent claim is real.
- Rows 1, 4 and 6 give real reasons.

**3. Did the earlier audits change round 12 or only its description?**
- Mostly the ratings. Rows 1 and 2 cite precedent and use the rare-timing rule. Nothing was softened to LOW on "visible" in the main rows.
- The old habits survive in the margins: row 5 ("visible, reload fixes it"), row 7 (unrated "not findings"), and the unrated left-and-refused save and the dropped reader observations, which are items the audits said not to drop.
- Round 11 had Predictions, Mistakes the next author will make, and "Not given rows". Round 12 so far has none of these.
- The stop-rule line ("round 13 follows") is not written, though it follows from the planned MEDIUM fixes.

**4. Same kind of problem rated differently?**
- Lost typed work: row 2 is MEDIUM, row 3 is LOW, and the left-and-refused save is unrated. The distinction (the parent chose Back versus the app forced it) is reasonable. The left-and-refused save is the app forcing it, so it belongs with row 2.
- Wording defects: rows 4 and 6 are LOW and fixed. Row 5's wording defect is LOW and not fixed, with no reason for the difference.
- A server guessing intent from a stale read: row 1 is MEDIUM, and its mirror (a treasurer change lost to a finalize race) is not recorded.
