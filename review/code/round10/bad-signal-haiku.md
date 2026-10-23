Review of the saving path at commit 6cc7e4d, from a parent on a phone with a bad signal. I read the queue, the save and hold paths, the api() wrapper and the server's expense, edit, delete and payment routes. The core queue is sound: keys are unique per expense, a resend after a lost reply is answered "already" and not added twice, unsure answers are never treated as saved, and refused items don't block the rest. I found no HIGH problems. Three findings below.

1. MEDIUM. Hand-set expenses are lost if the parent leaves the form after an unsure save. (Reasoned from code, not run.)
- Steps: the parent enters a new expense with a custom or hand-changed split and taps Save. The reply never comes. saveExpense() takes the needs-signal branch: the toast says to save again, and the form stays open. The parent taps Back, the bar's link to the trip. show() for a trip path runs dropDraft() and sets S.draft = null (app.js ~line 261).
- The expense was either never sent or may have landed, and nothing on the phone holds it. The parent gets no reminder and must reconstruct it.
- The design says this case is "what they typed is kept as it is today", so it matches the design's wording. But the design's stated goal is that the parent never types a lost expense again, and this path breaks it for hand-set expenses only. Nothing in the code warns about leaving.

2. MEDIUM. The "Couldn't send" item can't be opened to copy, though design v4 section 2 promises it. (Reasoned from code: grep for "refused" in public/app.js shows only the list label and the Remove action.)
- Steps: a held expense is refused, for example because the trip was finalized, or the payer family was removed, or a receipt expired. The trip shows "Couldn't send: <reason>" with only the label ("Lunch, $45.00"). The only button is Remove, and its confirm says it "wasn't added".
- The stored body (date, vendor, split, receipt) has no UI route. The parent has to re-enter the expense from memory, including any split and the receipt, which is now unreachable. The fix is to make the refused row open the saved fields into a new draft, as the design says.

3. LOW. A retry of an edit after a lost reply, with changed content, gets a false blame message. (Ran it against a local server.)
- Steps: PATCH A (amount 4500 to 5000, rev 0) lands and becomes rev 1, but the reply is lost. The parent corrects the amount to 6000 and saves, sending rev 0 again. The server returns 409 "Someone changed this expense after you opened it. Go back and open it again to see their version." Stored value stays 5000, rev 1, and no one else touched it.
- The parent may think another phone changed the expense. Recoverable by reopening and re-saving. The code path is server-side (src/index.ts, PATCH branch, the `same` check), so the fix is to tell "our own earlier save" apart from "someone else".

Checked and found sound: the expense POST dedupe and its ordering before the finalized check; the paid_by_uid guard for reused family ids; the DELETE 404 treated as already deleted; payments as explicit paid values rather than toggles; finalize's activity and fingerprint guards; the 25s abort covering the body read; double taps on Save (the same key, one stored entry); the sending loop not blocking on a refused item; and typed text surviving a redraw in renderTrip.

I ran the local app, created a trip and expense, and tested finding 3 with curl. I stopped the server afterwards (ports 8854 and 9854 are free). Nothing outside my copy was touched.
