I found no place where the app disagrees with `review/design/billing-model.md`, and nothing HIGH or MEDIUM. I did not start the server, so port 8875 was never used and there is nothing to stop. Everything below comes from reading the code, plus one script run on the shared maths. I did not run the app's own flows end to end.

What I checked against the rules:
- **Three splits** (`public/split.js`): the same module is used by the browser, the server, the PDF and the finalize check.
  - Who took part: the saved head count per family. Staff are always skipped. A family not listed is out.
  - Equal per fencer: each family pays once per fencer, so a fencer with no days still pays coach travel.
  - By fencing days: every day each fencer competes is one share. I ran your example (five fencers on day 1, one of them on day 2) with a $100.01 bill and a coach as payer: 6 shares, the two-day family pays 2, and the shares add up to the cent. A second expense also summed exactly.
- **Kinds fix the split.** `expenseInput` in `src/index.ts` forces the basis from the kind, and only Other takes the chosen one. A took-part expense must have at least one family ticked, and head counts must be whole numbers from 1 to 50. In the editor, Other starts on who took part.
- **Head counts.** Nobody is ticked to begin with, "Tick everyone" works, and a ticked family starts at its size. The count is saved as entered and can go above the family size. A late family joins coach costs but not past meals.
- **New fencers** start with no days ticked (`src/index.ts` ignores any days sent). The warnings and the Fencing days screen match the rules, and nothing is blocked.
- **Removing a family** takes it out of every expense in the same database statement. A payer or treasurer family can't be removed.
- **Finalize.**
  - It is blocked when an expense has nobody to split among.
  - Every write that changes money is refused once the trip is final.
  - Settling goes through the treasurer, and the treasurer's own family gets no payment.
  - Coaches who paid are paid back.
- **Wording.** The old "attendance", "days at the trip", "supplies" and "ground transport" are gone from `app.js`, the PDF, the README and the practice-trip seed. The help text and the PDF's fencing-days note match the rules.

Small things, all LOW and reasoned from the code only:
1. **Shortening a trip's dates drops fencing days, and lengthening it again doesn't bring them back.** The edit screen warns about this first (`app.js` around line 665), so it is visible and fixable.
2. **PDF family statements leave out an expense where a family's share rounds to 0 cents.** This only happens with an amount of a cent or two. The family's totals are still correct.
3. **The PDF note says an asterisk marks "someone who fenced".** The code marks anyone ticked as Fencer, whether or not they have days. This is wording only.
4. **The PDF's "Total shared costs" leaves out an expense nobody is splitting, while its expense list and "Expenses" figure include it.** Finalize refuses such a trip, so this only shows on a draft.
