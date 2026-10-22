# Review loop ledger: EFC Trip Expenses

Success question: can a non-technical parent, using only the app on their phone, complete their job on a trip (add a shared expense with its receipt, find what their family owes and where to send it, act as treasurer, set up a trip) without guessing, and does the app look finished enough to trust with money?

Method: each reader gets a private copy of the app (its own database and port), seeded with the trip state its task needs. Readers see the app only in a headless browser (agent-browser), never the repo. Receipt auto-reading is off in the test copies (no API key), so readers are told the "receipt reading isn't set up" message is expected.

## Round 1: 2026-10-22, commit aa37296
Cast: 8 readers, all claude-haiku-5-5 (single model, so a convergence is a strong hint, not proof).
- Task readers 1 to 6: Tunde (add the lunch expense with its receipt), Priya (find what I owe), Lisa (be treasurer, finalize, tick off a payment, send the group message), Dana (set up a trip), Paola (B2 English, explain the settle page), Mark (laptop, add parking).
- Specialists 7 and 8: visual and trust, accessibility.

Outcome: every task passed. Nobody got stuck. The visual specialist said "Yes, almost." Accessibility: a keyboard-only user can add an expense and read what they owe.

Tier 1 (fixed in 415d657 and 601c2fe):
1. The Treasurer tab told every viewer "Your own family's balance is +$172.45", which is the treasurer's family's number (reader 2; checkable against the code).
2. "Settled in the pot" not understood (readers 3 and 5). Now states the amount the treasurer's family keeps or adds.
3. Family breakdowns not noticed as tappable (readers 2 and 6). Each row now shows owes/owed plus "details", there's a hint, and a "How was this worked out?" link from the your-family card.
4. "None" next to amounts read as a missing amount (readers 2 and 7). Now "No receipt".
5. The family picker: required? does it change data? (readers 2, 3 and 6). Now says it only changes what this phone shows.
6. Sign-in Continue gave no feedback, and readers thought it failed (readers 1 and 2). Now shows "Checking…".
7. Ticking a family with zero people that day gave a ticked row counting 0 (reader 1; reproduced). It now starts at 1 and focuses the count.
8. The treasurer sheet defaulted the family to "Not on this trip" (reader 3; checkable). Now uses the picked family, else a guess from the name, and says which.
9. Focus dropped to the page top after re-renders (reader 8; checkable). Focus is now restored, including after picking a family.
10. The receipt picker couldn't be reached by keyboard (reader 8; checkable). The input is now visually hidden but focusable.
11. Every family button was named just "Edit" (reader 8). Each now has a per-family accessible name.
12. On a final trip, Edit looked like full editing (reader 7). It's now "Payment details", and the sheet says only those can change.
13. Coach meals showed a bed icon (reader 7). The coach-stay category now uses a neutral icon.
14. In dark mode the list icons nearly disappeared (reader 7). They're gold now.
15. Paired buttons wrapped to four lines on a phone (reader 7). They stack under 480px.
16. The group message read "X will pay: Rossi" and lacked payout details (reader 3). Reworded, with each family's payment details.
17. The trip screen had no h1 (reader 8). The bar title is now the h1.
18. The focus ring was faint on white (reader 8). Gold ring with a navy edge.
19. Hint text referred to colour ("grey numbers") (reader 8). Reworded.
20. A tap outside a panel threw away typing (reader 4; possibly a headless date-picker artifact). Panels with edits now close only on Cancel.

Tier 2/3 collected, not acted on: arrow-key movement in radio groups (reader 8); native select styling (reader 7); several copy buttons (reader 3); the default fencing days in the add-person sheet (reader 4); "fencer-day" as a word (reader 5, mitigated by the help text under each choice).
Tier 0: the chat-message link shows 127.0.0.1 (test copy); a date typed into the native field in the headless browser.

Predictions scored (PREDICTIONS-R1.md): "who's included" ambiguity, partly landed (reader 1 paused but passed). "Fencer-day" jargon, landed (reader 5). Steps text too long, did not land (nobody mentioned it). Sideways grid, did not land. Sheets not trapping focus, did not land; the real problem was focus loss on re-render. Tier-1 count predicted 3 to 6, actual 20. I underestimated how much small wording costs.
Believed, and wrong: "the readers will mostly find layout things; the wording is fine because I wrote every hint deliberately." Most tier-1 findings were wording.

## Standing rule for the cast (Frank, 2026-10-22)
Most readers in every round must be representative of real users: fencing parents and grandparents across the whole range of tech experience. Specialists and auditors are extra, never the majority. Personas not yet used: a new fencing parent who doesn't know the sport's terms; a tech-savvy, skeptical parent who checks the numbers; a rushed parent at the venue, using one hand; a parent with an older phone and large text.

## Round 2: 2026-10-22, commit 601c2fe
Cast: 5 readers, all claude-haiku-5-5. A fix auditor; Gail (anxious grandmother, adds the pizza with its receipt); Tunde (impatient dad, what do I owe and why); Paola (B2 English, first-time treasurer, whole settle-up); the accessibility recheck.
Outcome: every task passed. The fix auditor found all 13 checked fixes GONE, with one leftover (the breakdown said "is owed" for the treasurer's family, while the line above said "keeps").

Tier 1 (fixed in this commit):
1. The progress step was labelled "Settled" while payments were still outstanding (Paola; checkable). Now "Payments".
2. Picking a family by accident went unnoticed (round 1 Mark, round 2 Paola: two readers). Now a confirmation toast names the family and how to switch.
3. Focus went to the page top on every new screen (accessibility; checkable). It now lands on the new screen's h1.
4. The breakdown used "is owed" for the treasurer's family (fix auditor; checkable). Now "keeps" or "adds".
5. Paying out before collecting gave a negative "In hand" with no explanation (Paola; reproduced). Now a confirmation, and the line reads "Paid out ahead of collecting".
6. "Per person" didn't say the head counts are filled in, so Gail switched to per family out of worry (Gail; checkable against the help text). The help text now says so.

Tier 3, not acted on: on Settle up the treasurer's card comes before your own answer (Tunde; the your-family card above the tabs answers it); the receipt photo isn't compared with the entered amount (Gail; with auto-reading on, the AI fills the amount); radio groups tab through every option (accessibility, known); a doubled name on grid cells (accessibility; probably how the snapshot computes names).

Predictions scored (PREDICTIONS-R2.md): fixes 2, 3, 4, 5, 7 and 9 landed as predicted. Round tier-1 count predicted 0 to 3, actual 6. "Landed and broke something adjacent" happened once, as predicted (the breakdown wording, from fix 2). The fix auditor finding a fix applied in one place and missed in another: yes, the same item.
Believed, and wrong: "a step bar whose last step is called Settled reads as a goal." One reader took the highlighted step as the current status.
