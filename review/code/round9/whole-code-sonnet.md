Review of the efc-expenses copy at commit 4719bbd: no HIGH findings. I found one MEDIUM and two LOW. I read all of src/index.ts and public/split.js, and most of the expense editor, save/delete and settle code in public/app.js. I did not read the family screen's field-by-field saving (it had eight rounds of review already) or most of pdf.js. I ran one API script. The server's side of the sharing math looks sound. Shares always sum to the amount, balances net to zero, and the treasurer plan excludes the treasurer's own family correctly. Finalize's fingerprint guard holds up on a read-through. The checks I traced from code for the race fixes in rounds 3 to 8 all held.

**1. MEDIUM: a retried new-expense save drops edits made after the first attempt.**
- Reasoned from the code, and the server half reproduced.
- A new expense carries `client_key`, and the server returns the existing row for a repeated key without comparing the fields (src/index.ts, POST `/tournaments/:id/expenses`, `if (made) return json({ id: made.id }, 200)`).
- Sequence:
  1. A parent taps Save on bad wifi. The insert lands but the reply is lost, so the app shows "No connection".
  2. The form stays open and still holds the same `client_key`.
  3. The parent notices the amount was wrong, fixes it (for example $100 to $500) and taps Save again.
  4. The server answers 200 with the old id. The app shows "Expense saved" and goes back to the list.
  5. The expense is still the old amount, and nothing says the edit was discarded.
- Repro: I posted the same `client_key` twice with `amount_cents` 10000 and then 50000. The second call returned 200 with the same id, and the stored amount stayed 10000.
- Fix idea: treat a repeated key as "already saved" only when the fields match, as the PATCH path already does with its `same` check. Otherwise update the row or return a conflict.
- It stays MEDIUM because the amount shows in the list afterwards and can be corrected.

**2. LOW: Delete from the expense editor uses the revision from the page's current copy of the trip, not the revision the editor was opened on.**
- Reasoned from the code.
- In the delete handler, `del-expense` sends `S.trip.expenses.find(...).rev` instead of `S.draft.rev`.
- Normally the two agree, because the page doesn't reload while an editor is open.
- They differ when Save runs into a family that joined or left on another phone. `saveExpense` then replaces `S.trip` with the fresh copy and redraws the editor, but keeps the old draft and its old revision.
- If someone else also corrected that expense in between, Delete is then sent with the newer revision and succeeds, deleting a correction the parent never saw.
- It needs three things together: a family change, a correction to the same expense, and a Delete. The delete is confirmed first, and the trip can be restored for 30 days only if the whole trip is deleted, not the expense.

**3. LOW: Finalize locks in whatever the numbers are when the request arrives, not what the person on the Settle screen was looking at.**
- Reasoned from the code.
- The "Finalize this trip?" confirmation shows no figures, and the server takes its fingerprint at request time.
- If a parent edits an expense on another phone after the treasurer last loaded Settle, the treasurer finalizes the new numbers without seeing them. The payment list is then shown straight away, so the change is visible, and a reopen undoes it.
- Fix idea: send the fingerprint, or a count of expenses and the total, with the finalize request.

Caveats: I did not test the browser app on a phone. Port 8841 was already taken by another process, so wrangler started on 8843, and my first test call hit someone else's server on 8841. I re-ran against my own server on 8843 and got the result above. I stopped only my own wrangler process, not the other one on 8841.
