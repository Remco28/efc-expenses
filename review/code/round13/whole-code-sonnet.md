Nothing found at HIGH or MEDIUM. In the ways parents really use it, I could not find a case where someone gets a wrong result or silently loses work. I did not start the server. I read all of src/index.ts, public/split.js and the money, save, offline-queue, finalize and settle code in public/app.js, and ran `npm test` (16 of 16 pass). Everything below is reasoned from the code, not run.

What I checked and found sound:
- **Split math** (public/split.js): shares use largest-remainder rounding, so they always add up to the cent. Only expenses someone shares count toward balances. Coaches and staff never pay a share but can be paid back. Since finalize refuses any expense nobody shares, the balances net to zero.
- **Treasurer plan:** the treasurer's own family is left out, and what is left in the pot equals that family's balance. With no treasurer family, every family gets a payment and the total is zero.
- **Finalize:**
  - It is guarded three ways: the activity id the screen saw, the fingerprint of expenses, people and treasurer, and the same fingerprint plus "still open" inside the write batch.
  - The fingerprint covers amounts, payer, basis, date, split, people, fencing days, family kinds and treasurer. I found no input to the money that it misses.
  - Reopen, payment ticks and the stale-payment checks hold up.
- **Two phones at once:**
  - Day taps send an absolute on/off for one day.
  - Family removal, date changes and person edits are all done in SQL against the current row, with the trip-open check inside the write.
  - Expenses carry a revision, a created-at check and family tags, so a stale form is refused instead of overwriting.
- **Lost replies:** adds carry client keys, so a retry returns "already added" instead of adding twice. Waiting expenses sent after a trip is finalized or a family is removed are kept visibly as "couldn't be sent".
- **Typed amounts** ("12,50", "1,234", "1.234,50", "$12.5") parse correctly.

LOW findings (visible, recoverable, or annoyances):
1. **LOW, PDF record loses non-Latin-1 characters.** `clean()` in public/pdf.js turns any character outside Latin-1 into "?". A family or person named in Polish, Vietnamese or Chinese script, or one with a "ł" or "ő", shows as "?" in the downloaded PDF. The on-screen app is fine, and Latin-1 accents such as José and Müller survive. Reasoned from the code.
2. **LOW, a typed amount with three decimals rounds silently.** `cents()` reads "12.345" as $12.35 with no warning. A US keyboard rarely produces this.
3. **LOW, coach hotel or meals cannot be saved until a fencer has a fencing day ticked.** On the coach hotel/meals (by-fencing-days) kinds, the app says "No fencer has fencing days ticked yet" and blocks saving. This is a visible message, and the cause is the design choice that new fencers start with no days. A parent entering the hotel bill on arrival day has to tick days first or choose Other.

The server was never started, so there was nothing to stop and port 8881 was never opened.
