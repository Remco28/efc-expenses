Review of billing-model-v1.md against the current efc-expenses code (read-only; nothing changed or run in that folder).

WHAT HOLDS UP

- The core idea is sound. Meals opt-in, coach costs split by what they were for, coaches never paying a share, and fencing days as the only per-day fact are all simpler and fairer than today's "everyone there that day" rule, which is what made meals split across people who weren't there.
- Two of the three split methods (equal per fencer, by fencing days) stay automatic from the roster, so adding a fencer or changing ticks flows through without anyone re-entering anything. That is the same mechanism the app already uses, and it is the right one to keep.
- The one-treasurer, one-payment-per-family settlement and the cent-exact rounding are untouched, and the design correctly leaves them alone.
- Saying "how it's stored is not decided here" is honest and leaves the build room. Good.
- No conversion of old expenses is the right call for a practice-stage app, provided the next point is settled.

GAPS: THINGS THE DESIGN DOES NOT SAY WHAT TO DO WITH

1. "Reset" for the live trips. The design says the live site's trips are test data and will be "reset". The only reset that exists in the code (src/index.ts, resetSandbox) works on the practice trip alone and refuses any other trip. Other trips can only be deleted, which is restorable for 30 days, and a finalized trip must be reopened before deletion. So "reset" for real trips means something the app does not do today. Also, the repo cannot tell whether any live trip holds real money: a finalized trip with unpaid families would be wiped. Frank should confirm, trip by trip, that nothing real is in there, and the design should say whether "reset" means delete or wipe-and-keep.

2. Who-took-part ticks and head counts are hand-set. Today the app lets an expense with automatic shares be saved on a phone with no signal and sent later (it refuses only hand-set shares offline). Under the new model nearly every team meal is hand-set, so the most common expense will need a signal to save. The design is silent on whether that is accepted. It is a quiet regression for parents at a venue with poor reception.

3. Head counts do not follow the family. A head count "starts at the family's size" and is then a stored number. If a sibling is added later, or a family is removed from the trip, the design doesn't say whether old meal counts change. Today a family removed from the trip is stripped out of every expense automatically; the design should say the same is required.

4. "Nobody is ticked to begin with." A meal saved with nobody ticked can't be settled, and finalize is blocked on it today. The design doesn't say whether that block stays, or what the app does with a meal nobody ticked when the trip is finalized.

5. Fencers with no fencing days. Today the app warns "X has no fencing days" and says they pay nothing toward the coach's stay. The design says warnings get rewritten but doesn't say whether this warning survives. It also doesn't say whether a fencer with zero days still counts as a fencer for "equal per fencer" (the current code counts them). A fencer who was entered and then withdrew has no way to be removed except deleting them, which the design doesn't mention.

6. Trip dates shrinking. Today, shortening the trip silently removes days from everyone's attendance and fencing ticks. The design doesn't say whether fencing-day ticks outside new dates are dropped (and with what warning) or kept.

7. Live recalculation. Splits are computed live from the roster. If someone unticks a fencing day after the coach's hotel was paid, everyone's share of that bill moves. This is true today too, but the design should say whether that is intended, since finalize is the only lock.

8. Coach supplies and parent supplies. "Supplies are the coach's responsibility" and "snacks one parent buys aren't shared" are stated, but a coach who buys team supplies and wants paying back, or a parent who buys team supplies, has no clear kind. Only "Other" is left, and the design doesn't say whether supplies can be reimbursed.

9. Parent-driven van. "Ground transport" as a kind is removed. Its items (van, gas, parking) move under "Coach hotel and getting around", which is defined around the coach. A parent's own van used for the team has no obvious home except "Other". Today a van is split equally per family; under the new model it would be split by head count or by fencing days, a real change to who pays for it that the design doesn't mention.

10. Receipt reading. The receipt reader's category list and its hint ("a meal for one person is usually the coach's") are built from the current categories. Removing supplies and ground transport and changing the splits needs the reader's prompt changed too, which the design's "every explanation is rewritten" list does not name.

CONTRADICTIONS AND UNCLEAR RULES

A. The fencer-day example is wrong as written. "Five kids fencing day 1 and one kid fencing both days: 6 shares." If the "one kid" is one of the five, the count is 6 (5 on day 1 with the two-day kid counted once, plus one more day for that kid, giving 4 + 2 = 6 only if the kid is among the five). If the one kid is additional, it is 7 (5 + 2). The example needs fixing so the rule is unambiguous. It also mentions "2 nights of hotel" while the rule counts days, which will confuse parents.

B. Coach at a meal. "Team meal... coach included or not" is split by who took part, and the coach's plate is paid by the families present. But "Coach's own meals (breakfast, coffee, lunch at the venue)" is split by fencing days. A team lunch at the venue that the coach joins could fall under either. The design needs a rule for a meal the coach and some families share, and for the coach eating alone at a team breakfast.

C. "Who took part" with head counts and the "Other" choice. "Other" lets the entering person choose one of the three methods, which includes "who took part". So "Other" can require ticks, but the design doesn't say which of the three is the default for "Other" (today it's per family), and nothing says what "Other" should default to.

D. "Or goes" in the Check a day line. "Who's fencing which day, or goes" leaves open whether the screen is kept. The PDF change depends on the answer.

E. The "Who took part" default is nobody ticked, while every "Coach's own" and "Coach travel" line has a fixed default. That is consistent, but it means a team meal will almost always be saved in an unsplit state. The design should say whether the form remembers the last ticks on a trip, since otherwise parents retype the same eight families for every meal.

WHAT THE CURRENT APP DOES THAT A REBUILD COULD QUIETLY LOSE

- The offline save for automatic-share expenses (point 2 above).
- The guard that refuses to finalize while any expense has nobody included (src/index.ts finalize, and the "nobody included" warnings in app.js).
- The "fencing days zero" warnings on the Families and Settle up screens (app.js familyFlags, tabSettle).
- The automatic roster trimming when dates change (PATCH /tournaments, which trims family and person days).
- Family removal stripping that family from every expense's split (DELETE /families, json_remove on splits).
- The hand-set-shares guard that refuses to save shares that name a family which has since changed on another phone (expenseInput and the whoIs check in app.js). A head count that names a removed family has to be handled the same way.
- The PDF's by-day grid, which is the only printed record of who fenced which day. It becomes a fencing-day grid under the design, so the PDF should keep the same per-family, per-expense statement.
- The unit test in test/split.test.mjs and the README's "How costs are split" section; both describe the old rules and must be rewritten with the build.
- The seeded practice trip (src/sandbox.js) uses automatic shares and the old kinds. Re-seeding means every seeded expense needs explicit ticks or a new roster-based split, and the seed's "Parking at the venue" entry has no clean home under the new kinds.

NOT VERIFIABLE FROM THE REPO

- Whether the spreadsheet Frank used before really matches these rules. It is not in the repo, and the design only asserts that it does.
- Whether the live trips are test data, as the design says (point 1).

Files read: /home/frank/Dev/efc-expenses/review/design/billing-model-v1.md, README.md, public/split.js, src/sandbox.js, src/index.ts, and the split, family, expense-editor, settle and PDF parts of public/app.js and public/pdf.js. Not read in full: the whole of app.js and pdf.js, and the tour and hint copy beyond the lines above.
