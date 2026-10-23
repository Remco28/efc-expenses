Audit of the severity ratings in /tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl8/codex/review/code/README.md, read against the scale in code-review.md. I worked from the README tables and the scale only. I did not open the reviewers' reports or run any code, so every claim about the code below is taken from the author's own text. The author's own, honest post-hoc corrections (EFC-01, EFC-03) already confirm the main pattern. My points below are the ones the author did not make.

**Main finding.** The author's habit is to downgrade to LOW because the problem is "visible" or "recoverable". The scale defines exactly that as MEDIUM. LOW is reserved for abuse, edge input and annoyance. The ratings also decided when the loop stopped, because "no HIGH" was the exit condition.

**1. Ratings and non-fixes that do not hold up**

| Row | Author | Should be | Why |
|---|---|---|---|
| R3 #11, "✓ Saved" after a failed save, and a failed add lost the name | LOW | MEDIUM | Two reviewers said MEDIUM. The reason given ("an error toast already shows") is the scale's definition of MEDIUM: visibly wrong and recoverable. A false "Saved" next to money entries is a false success signal. |
| R3 #13, stale load paints an error or the old trip | LOW | MEDIUM | The same class came back as R4 #4 (MEDIUM), R5 #2 (MEDIUM) and R7 #4 (LOW). It recurred every round, so it was not harmless. |
| R7 #4, an older refresh paints over a newer reload | LOW | MEDIUM | "Older figures until the next load" means wrong money shown to a user. See also Q4. |
| R5 #4, typing a field back to its old value during a reload is overwritten | LOW | MEDIUM | The user's own input is overwritten. "The field visibly shows the other value" is the MEDIUM test, not LOW. |
| R6 #5, a refresh discarded when the phone returns from another app | LOW | MEDIUM | The author's reason is that it is only lost if the comeback reload also fails. That is a rare sequence, which is the MEDIUM definition. |
| R7 #5, a failed Add puts its name back over the next name typed | LOW | MEDIUM | "Visible in the box before Add" is again the MEDIUM test. |
| R7 #6, overlapping saves point an expense back at a deleted receipt | LOW | MEDIUM | R6 #4 had the same effect (receipt lost) and was rated MEDIUM. Only the timing differs, and rare timing is MEDIUM by definition. |
| R7 #1, the cursor moves during a save, so the next letters rename another person | MEDIUM | HIGH | Letters typed go silently into the wrong person's name, in a round-6 regression. The window is the slow-venue-wifi window the author used to justify HIGH in R3 #1. It is silent data corruption. |
| R7 #2, an edit made while a save is in flight is thrown away when the save lands | MEDIUM | HIGH | This is R3 #1 again: a save redraw loses the user's edit. R3 #1 was HIGH ("slow venue wifi makes the window real"). Both are the same mechanism and the same window. |
| R3 #3, treasurer change racing finalize | MEDIUM | HIGH | Two reviewers said HIGH and one said MEDIUM. Finalize fixes who is owed money, and the treasurer change is not in the fingerprint, so the wrong person can be paid without anyone noticing. The author called it MEDIUM because it "needs two people within a second", yet the same rarity was waved through as HIGH in R3 #1. |
| R6 #7, the created_at check is skipped when a request omits it | LOW, not changed | At least MEDIUM, fix it | The author kept it so old pages "must keep saving". That was the open door for EFC-01, the later HIGH. The stale-editor overwrite of R4 #2 was fixed only for requests that send created_at. |
| R4's note that family and person ids can be reused, left unfixed as LOW | LOW | MEDIUM or HIGH | The author later admitted this was inconsistent, and EFC-03 added that ids are shared across trips and cover payment details. It is the same mechanism as R4 #2 (HIGH). |
| R3 #15, migration 0007 altered attendance on finalized trips; not changed | "No effect" | MEDIUM, with a cheap guard | The scale rates the code, not the live database. The stated reason (there were no finalized trips) is true today and says nothing about restores or other databases. A "skip finalized trips" guard is cheap. |
| R3 "Rejected: not reproduced" for agy HIGH, typing clears the browser's "changed" flag | Rejected | Unverifiable from the README | A single-reviewer HIGH needed a kill attempt. The README does not say how it was tested, and edits dropped on typing was the dominant bug family afterwards. |

**2. Are the stated reasons real or convenient?**

- **Real:** the id-reuse reproduction in R4 #2, the "round 3 still found HIGH, so continue" logic, and the upgrades in R5 #1 and R6 #1.
- **Convenient:**
  - R6 #7's old-pages reason. EFC-01's fix broke pre-release pages anyway ("this screen is out of date, reload"), so the compatibility argument was never binding.
  - The round-2 line "remaining findings are matters of taste, not correctness". Round 3 then found three HIGH-rated issues (R3 #1–3), several in round-2 changes.
  - "Round 7 found no HIGH, so the reviews stop." The three ratings that kept R7 below HIGH (#1, #2, and #4 as LOW) are the ones the R3 precedent and the scale argue against. Rated consistently, round 8 would have been triggered. The README itself admits the round-7 fixes were never outside-reviewed, and the generic review then found a HIGH and three MEDIUM.
  - "Visible/recoverable" used as a reason for LOW (the first group above).

**3. Were findings in the author's own fixes, or expensive to fix, treated more gently?**

- Most findings were in the previous round's fixes, and the author did fix them. But the severity softened as the loop got longer.
  - **Rounds 3–6:** the regressions were rated HIGH twice (R5 #1, R6 #1), both upgrades.
  - **Round 7:** every finding in the round-6 changes (all of it fix-regression) was rated MEDIUM or LOW. That is where the ratings were gentlest and where the loop was ending.
- The two non-fixes (R3 #15, R6 #7) and the family/person id gap were all the ones that cost compatibility or a migration change. The unfixed items are exactly the ones needing a schema or contract change, which the outside review later did anyway (migration 0008, revisions, tags).
- Rounds 1 and 2 have no per-finding ratings at all ("about 20 issues"), so they cannot be audited.

**4. Same problem, different ratings**

- **Stale or late async result painting over newer state:** R3 #13 LOW, R4 #4 MEDIUM, R5 #2 MEDIUM, R6 #5 LOW, R7 #4 LOW.
- **Redraw or save landing over the user's typed or ticked input:** R3 #1 HIGH. Then R4 #3 MEDIUM, R5 #3 MEDIUM, R5 #4 LOW, R7 #1 MEDIUM, R7 #2 MEDIUM. All of these are the R3 #1 mechanism, and only the first was HIGH.
- **Id reuse letting a stale screen hit the wrong record:** payments R3 #9 MEDIUM, expenses R4 #2 HIGH, families and people R4 note LOW (unfixed, later MEDIUM in EFC-03).
- **A check done before the write rather than in it:** R3 #4 MEDIUM and R4 #6 MEDIUM, but R4 #7 LOW and R5 #5 LOW for the same pattern, and R6 #7 LOW and unfixed.
- **Receipt reference pointing at a deleted file:** R6 #4 MEDIUM, R7 #6 LOW, R7 #7 LOW.
- **"Visible" as a reason:** it moves a finding to LOW in R3 #11, R5 #4 and R7 #5. In R4 #5 the same "visible broken feature" moves a finding up to MEDIUM.

**What I would trust the author on:** the category-split bug was rated HIGH every time (R3 #2, R4 #1, R5 #1). The author also corrected EFC-03 openly.
