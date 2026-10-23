I found one real problem, MEDIUM severity, and a few LOW ones. I did not find anything HIGH, meaning a wrong settlement or lost work nobody would notice in ordinary use. I read all of src/index.ts, public/split.js, the migrations and the family and trip-details parts of public/app.js. I did not read all of app.js and did not look at pdf.js. I ran the server for the one reproduction below.

Port 8831 was already held by another workerd process, from /home/frank/Dev/efc-expenses. I left it alone and ran my copy on port 8851, then stopped mine.

**What I checked and found sound**
- The split math is sound. Shares always add up to the amount, balances net to zero, and the treasurer plan matches the balances.
- Finalize is atomic and guarded by the fingerprint. Payment ticks, expense revisions and the person and family tags all hold up when I traced the stale-screen cases.
- A family is blocked from deletion while it has paid an expense, and its entry is removed from every expense's split.
- Shortening a trip's dates shows a warning in the trip-details form.

**MEDIUM: a stale trip-details form silently reverts the dates and drops the newest day's attendance (ran it)**
1. Phone A opens the Trip details form while the trip runs Nov 6–8.
2. Phone B extends the trip to Nov 9 and parents tick Nov 9 on their family screens.
3. Phone A, still showing the old form, changes only the tournament name and taps Save.
4. The form always sends all four fields, so the server sees the old end date as a deliberate shortening. It sets the end date back to Nov 8 and removes Nov 9 from every family's and person's days and fencing days.
5. The save returns OK, and neither the toast nor the list shows that dates changed or ticks were dropped. Expenses dated Nov 9 will then show "nobody included".
6. I confirmed by running it: extend to the 9th, then PATCH the name with the old dates, and end_date came back as 11-08. In that run nobody had ticked the 9th, so I did not watch ticks being dropped. I read that part from the code.
- The server only checks that the dates it just read are unchanged. It never checks that the dates the form was opened with are unchanged. A fix is to send the original start and end with the PATCH and refuse with a 409 if they differ.

**LOW: reopening a final trip from a stale screen wipes the payment ticks without the warning (reasoned from the code)**
- Reopen deletes all payments with no check on the server.
- The "Payments already ticked off will be cleared" warning depends on what the phone last loaded. If another phone ticked payments since, this phone shows the plain "Reopen" message.
- The ticks are lost, and the next finalize starts everything unticked. The settlement amounts themselves stay correct.

**LOW: a retried Save after a timeout can create a duplicate expense (reasoned from the code)**
- Creating an expense has no idempotency token.
- If the save succeeds but the response is lost on bad venue wifi, an error toast appears and a second tap on Save adds the expense twice.
- The duplicate is visible in the list and can be deleted, but until someone notices, that family is over-charged.

**LOW: the amount parser (cents() in app.js line 914) strips commas, so "12,50" becomes $1250.00 (reasoned from the code)**
- The expense screen shows the shares before saving, so this is visible.
- It only bites if someone types a European-style decimal.
