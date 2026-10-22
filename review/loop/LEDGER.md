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

## Round 3: 2026-10-22, commit a77177e
Cast: 5 readers, all claude-haiku-5-5. Following Frank's rule, 4 of 5 are real-user parent personas. Jordan (new fencing parent, adds the coach's hotel); Raj (skeptical engineer dad, verifies every number); Marco (rushed at the venue, 90 seconds); Dolores (grandmother, large text on a small phone, 320px at 1.25 zoom); plus a fix auditor.
Outcome: every task passed. Raj reproduced every share by hand and would pay. The fix auditor found all 6 round-2 fixes GONE.

Tier 1 (fixed in this round's commit):
1. Choosing a day silently dropped a family that wasn't there, and Marco re-ticked them, overcharging them (reproduced). Those rows now say "Not there that day".
2. The day field does nothing for per-fencer and per-fencer-day splits, but invites a choice (Jordan and Raj: two readers). A note under the field now says so. **The policy question goes to Frank:** should a single coach-hotel night be split by that night's fencers?
3. Large-text layout (Dolores, confirmed from her screenshots): tabs clipped (now 2x2 under 380px); the Balances column cut off (scrolls, and hides Share under 340px); the Venmo handle broken mid-word (payment details now on their own line); the toast covering payment details (moved down); step labels clipped (only the current one shows on small screens).
4. Three status words for one state: "Settling", "Final", "Finished" (Dolores; checkable). Now "Final" everywhere ("Final · 2 of 3 paid").
5. Tapping an expense on a final trip did nothing (Raj; checkable). Now a read-only view with the split and the receipt.
6. The treasurer tab said "is owed" where Settle up says "keeps" (fix auditor). Aligned.
Regressions I caused and caught while proving the fixes: the small-screen rule hiding column 2 also hid the amounts in the new expense view (now scoped to the Balances table); the h1 focus showed a ring on page load (now suppressed for programmatic focus).

Tier 3, surfaced to Frank: how coach-hotel nights relate to fencing days (above); requiring receipts (Raj wants an amount source).

Predictions scored (PREDICTIONS-R3.md): the large-text reader finding clipping, landed (bigger than predicted). The new-fencing-parent reader stumbling on "fencer-day": partly; the help text carried the meaning, and the real confusion was what the day field does. Raj: numbers reconcile, landed. Fix auditor: all landed, landed. Tier-1 count predicted 0 to 2, actual 6. Three rounds in a row I have underestimated; the cast change in this round (new kinds of parent) is what found new things, not leftovers.
Believed, and wrong: "the day field is harmless on coach costs; it's just a date." Two readers read it as part of the split.

## PDF (separate from the rounds)
Rebuilt at Frank's request: navy and gold summary page (key figures, who pays what with settlement and status, every expense with receipt numbers); family statements; one framed receipt per page, with PDF receipts scaled into the same frame; page X of Y. Proven by rendering a test trip with a JPEG receipt and a 2-page PDF receipt. Three layout faults were found and fixed while doing that (a note overlapping the table, zebra rows clipping sub-lines, a lone totals row on page 2).

## Round 4: 2026-10-22, commit 0d7a880
Cast: 6 readers, all claude-haiku-5-5. 4 of 6 are parent personas new to the review: Dave (never used an expense app; adds gas and breakfast); Ngozi (Splitwise-using organizer; fixes attendance, judges it against a spreadsheet); Gia (16-year-old fencer doing it for Mom); Priya (work laptop, checks her family's days, adds Zelle). Plus a fix auditor and Helen (retired bookkeeper on the club board, reviewing the PDF as page images).
Outcome: every task passed. Ngozi would recommend it over a spreadsheet. Helen: "Almost. I would file it once the basis is shown." The fix auditor found all 6 round-3 fixes GONE.

Tier 1 (fixed in ed13372):
1. A family dropped by the day choice still goes unnoticed (Marco R3, Dave R4, Ngozi R4: three readers). The Day note now names them: "Not there that day, so not sharing: Okafor, Patel."
2. The PDF had no attendance or fencing basis, so fencer-day counts couldn't be audited from paper (Helen; checkable). Added a "Who was there, by day" table (x = there, F = fenced).
3. The PDF had no rounding rule, so a one-cent difference looked like a plug (Helen). Added a rounding note.
4. The PDF had no total balance (Helen). Added $0.00 as the check figure. Wording clarified: "Treasurer's family: keeps …", "Paid … by the treasurer"; payment status labelled as of the print date.
5. When a family is owed, nothing said what happens next (Gia; checkable). Added a hint.
While proving these I found and fixed two PDF layout faults: the basis table header orphaned from its rows, then its section title orphaned.

Tier 0: Dave's "form cleared after picking the day" (couldn't reproduce; the fields persist; most likely the browser typing before the first render).
Tier 3, for Frank: per-person shares inside a family; settling across trips; asking for the name before the access code (Priya); Helen's bookkeeping extras (sign-off, document number, settlement method and reference).

Predictions scored (PREDICTIONS-R4.md): every task passes, landed. Tier-1 count 0 to 2: missed, 5 (3 of them in the PDF, whose first reviewer this was). Splitwise mom asking for scope: partly (she asked for a missing-attendance warning instead, which was a real finding). PDF reviewer calls it professional: landed, with the audit-basis finding. Fix auditor all landed: landed.
Believed, and wrong: "a record that adds up is auditable." It adds up but couldn't be recomputed without the attendance basis.

## Stopping here
App findings went 20, then 6, then 6, then 2 (round 4, app only). Every task has passed in every round across 23 readers. What's left is tier 3 and the questions only Frank can answer (below). Per the skill, that is the hand-off point: the question is now "is this good", which is the human's.

**Open for Frank:** (1) should a single coach-hotel night be split by that night's fencers, or keep pooling coach stay costs by fencing days across the trip? (2) Should receipts be required? (3) Any of the tier-3 scope ideas above.

## Mistakes the next author will make (so Frank can catch them)
- Running a round with mostly specialists or same-shaped personas. The new kinds of parent (large text, rushed, new to fencing, skeptical) found the most in later rounds. Frank's rule: mostly real parents.
- Predicting a small tier-1 count. Every round here beat the prediction. If a prediction says "0 to 2", plan for 5.
- Adding a CSS rule for one screen that silently hits another (the column-hiding rule hid amounts in a different table). After any small-screen rule, check every table.
- Treating "the numbers add up" as "auditable". Show the basis.
- Forgetting that wrangler d1 create and r2 bucket create append a remote:true binding to wrangler.jsonc.

## Round 5: family screens at scale, 2026-10-22
Cast: 6 readers, all claude-haiku-5-5. 5 parent personas (Dana, organizer, adds a 4-person family with a one-day dad; Walter, 72, adds his own family; Sean, impatient dad, wife leaves mid-week; Rachel, accountant, cross-checks a day; Grace, large text) plus 1 accessibility specialist. Trip: 15 families, 37 people, 7 days.
Outcome: every task passed. Check a day and the expense splits agreed exactly (Rachel). Kate's early departure cut the Murphy share by $44.07 (Sean).

Tier 1 (fixed):
1. **Families added after expenses weren't in them** (Walter; reproduced). Brooks showed "$0.00, even" despite Sunday dinner. Root cause: splits stored a fixed family list at entry time, so new families and corrected days never reached old expenses. Now every expense covers every family on "automatic" (who was there decides); only deliberate choices are stored (a hand-set count, or 0 for unticked); a new family is added to existing splits automatically. Three new unit tests cover this, and an end-to-end check shows Brooks counted Sunday, not Thursday, owing $191.03, nets 0.
2. Quick taps on day buttons overwrote each other (Sean; Walter likely hit the same). Saves now queue, and each tap sends the row as shown.
3. Editing an old expense showed absent families as ticked (Rachel). Rows on automatic with nobody there now read "Not there that day", unticked.
4. Day buttons' on/off state only shown by colour (Dana, Walter): a "Selected: Fri 2–Sun 4" line now sits above each row.
5. Focus lost after "Different days?" and "Use the family's days again" (accessibility): it now lands on that person's own days, or their name field.
6. Day rows unnamed for screen readers (accessibility): each row is now a named group ("Liam fences on").
7. Name fields squeezed to "Etha" at large text (Grace): they now wrap onto their own line.
Tier 0: "Add a person does nothing" (accessibility). I was editing the save code while that reader ran; it works on current code (4 people to 5, focus back on the field).
Housekeeping: readers wrote screenshots into the agent-office repo root and left a find / running; both cleaned up. Future briefs should repeat the screenshot path rule more forcefully.
Believed, and wrong: "storing the families on an expense at the time it's entered is fine." It froze the split against every later change.
