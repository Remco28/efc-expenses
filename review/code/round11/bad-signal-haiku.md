Review of /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl11/field at commit 60fcc7d, from the parent-on-a-phone-with-bad-signal lens. No HIGH findings. Three LOW findings, two of them run and one reasoned from code.

What I did: read the server (src/index.ts: expense POST/PATCH/DELETE, finalize, payments, trip PATCH) and the client save/queue code (public/app.js: api(), saveExpense, holdExpense, sendWaiting, the trip-details form, the delete and rewait actions), plus split.js. Started the app locally, ran a script (scratchpad/rl11/t/retry.mjs) simulating a lost reply by sending each change twice, then stopped the server. Port 8864 is confirmed free.

Ran, verified:
- New expense POST sent twice with the same client_key: second answer is already/same:true, one expense. Correct.
- Expense PATCH sent twice with the same rev: second answer is ok, edit applied once. Correct.
- Payment split check: 7000 cents, Alpha 2 people, Beta 1 person gives 4667/2333 (largest remainder), and the treasurer plan puts 2333 in from Beta. Correct.
- Finalize sent twice: first ok, second 409 "This tournament is finalized. Reopen it to make changes."

Findings:

1. LOW (ran). Trip-details save, retried after a lost reply, shows the wrong reason. The first PATCH (dates 11-01..11-03 to 11-01..11-02, sent with seen_start/seen_end of the old dates) landed. The retry returns 409 "This screen is out of date: something changed on another phone. Reload to see the current version." Nothing is wrong in the data (the dates are the saved ones), but the parent is told someone else changed things. Steps: parent changes dates on a weak signal, the reply is lost, the form stays open, parent taps Save again, and gets a false "another phone" message. Recovery is a reload. Code: index.ts PATCH /tournaments/:id (seenStart check runs after the first save changed start_date); app.js tripedit onsubmit (line ~651) does not reload on error.

2. LOW (ran). Finalize retried after a lost reply reads as a failure. The first finalize landed. The second returns 409 "This tournament is finalized. Reopen it to make changes." The act() helper only toasts, so the treasurer's screen still shows the Finalize button until it is reloaded. Nothing is lost. The message is wrong-looking and the screen is stale. Reload fixes it.

3. LOW (reasoned from code, not run). The design rule for hand-set shares is not implemented. review/design/saving-design-v4.md section 1 says an expense whose shares were set by hand "isn't held" and the form stays open with "This one needs a signal, because its shares were set by hand." app.js saveExpense calls holdExpense on any unsure reply with no check of the split, so hand-set expenses go to "Waiting to send". Impact: the waiting card shows only the description and amount, so the parent cannot see the split they chose once they have left the form. The item is sent exactly as typed later, so no money is silently changed, but the parent loses the chance to check it. Relatedly, the "unsent draft" card in the Waiting list (app.js ~line 555, unsentDraft/keptDraft with an `unsent` flag) is dead code: nothing ever sets `unsent`.

Checked and not a finding: waiting items resend under the same key and are de-duplicated by the server; a waiting expense arriving after finalize is refused and listed as "Couldn't send" (as the design says); payment ticks send an explicit paid value, so a retry is safe; rev and created_at guard edits and deletes; the 404-on-retry delete path is fine; receipt orphan cleanup only runs on trip purge and practice reset, so it cannot remove a receipt a waiting item still needs.

Not run: the browser behaviour of the queue (holding, the 30-second resend, the phone-background case). Those are reasoned from the code only.
