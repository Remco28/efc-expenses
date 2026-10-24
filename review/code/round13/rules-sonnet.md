Verdict: I found no HIGH or MEDIUM problems. The app does what billing-model.md says everywhere I checked. This is mostly a read of the code. I did not start the server or drive the app in a browser. I did run `node test/split.test.mjs`, which passes with 0 failures.

**Checked against the rules (read in `public/split.js`, `src/index.ts`, `public/app.js` and `public/pdf.js`):**
- **Who took part:**
  - The split is by head count among ticked families. Nobody is ticked at the start, and a count starts at the family size (minimum 1, maximum 50).
  - Counts are saved as entered, so a later sibling doesn't change past meals. Unticking leaves a family out.
  - "Tick everyone" only ticks real families. Staff are skipped in the arithmetic (`unitsFor`) and also dropped on the server.
- **Equal per fencer and By fencing days:**
  - A fencer with no days still pays an equal share of coach travel and pays nothing toward the hotel.
  - Unticking "Fencer" keeps the days but stops counting them.
  - The server forces the split from the kind of expense, and only "Other" lets the person choose.
- **Rounding:** cents go by largest remainder, so shares always add up to the amount.
- **Coaches:**
  - Coaches never pay a share, and they can be the payer.
  - The treasurer's own family is correctly left out of the payment list.
- **Fencing days:**
  - A new fencer starts with none ticked, and the warnings appear on the family screen, the trip-wide fencing-days screen, the expense view and the settle tab. None of them block anything.
  - Shortening a trip removes the dropped days, with a warning.
- **Family removal:**
  - Removing a family takes it off every expense, and a family that paid can't be removed.
  - Finalize is blocked when an expense has nobody to split it among.
- **PDF and practice trip:**
  - The PDF shows fencing days rather than attendance.
  - The practice-trip seed uses the new model, with its meals ticked.

**LOW, wording or display only (all read from the code, none run):**
1. **Wrong advice on the settle tab.**
   - When a coach-hotel or coach-travel expense ends up with nobody to split it among (no fencers, or no fencing days ticked), the settle tab says "nobody included... Open it from Expenses and tick who's sharing."
   - Nothing is ticked on those splits. The fix is to tick fencing days or add fencers.
   - The text is in `tabSettle` in `public/app.js`, around line 1426.
2. **Hotel can't be entered before fencing days are ticked.**
   - `saveExpense` in `public/app.js` (around line 1305) refuses to save a by-fencing-days expense while no fencer has days ticked ("No fencer has fencing days ticked yet").
   - The server accepts it, and the rules say the warning "blocks nothing". It is only about order: the treasurer must tick days first, and the message says so.
   - The same check blocks a coach-travel expense before any fencer exists.
3. **Misleading label in the PDF.**
   - The family table in `public/pdf.js` (line 177) shows "N going, M fencing", which counts everyone listed in the family.
   - Under the new model there is no "going" for the trip.
   - It will be read as attendance.

**Not findings:** the limits listed under "What it doesn't handle, on purpose" in saving-design-v4.md, which I took as chosen and did not review.
