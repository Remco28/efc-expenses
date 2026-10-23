Review of the copy at /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl10/whole-haiku (commit 6cc7e4d). I read src/index.ts, public/split.js, the expense editor and split UI, the queue and save paths in public/app.js, and the migrations. I ran the unit tests (17 pass), applied migrations, ran the app locally, and drove the API with two scripts in .../scratchpad/rl10/scen/ (s1.mjs, s2.mjs). The server is stopped.

Finding 1: MEDIUM (wrong but visible, recoverable). A family added late, without its days set, is charged for days it was not there.
- Steps: a trip runs 10 to 12 June. Alpha and Beta are on it. Alpha pays a $9.00 lunch for 10 June, split per person. A third family ("Late") is added on 11 June. A parent adds it and its person, and never opens the day picker.
- Why: POST /tournaments/:id/families sets days to every trip day when none are sent (index.ts: `b.days == null ? [...all]`). The client's addFamily sends only the name. The person POST copies the family's days. So Late counts for 10 June.
- Ran it (s2.mjs): the Late family's days came back as 10, 11 and 12 June. Shares for the 10 June lunch, from split.js with those days: {A:300, B:300, Late:300}. If Late were on 11 and 12 June only: {A:450, B:450}.
- The expense view shows the shares, so it is recoverable. But a parent who skips the day step gets a silent wrong split on earlier costs. Defaulting to "all days" for a new family, or requiring days at creation, would avoid it. This is a design choice that the README and design docs do not mention.

What I checked and found correct:
- Share math: shares always sum to the amount, with largest-remainder rounding. Balances net to zero. Staff pay correctly and get no shares.
- Treasurer plan: with the treasurer's family owing 333 cents, the plan pays Alpha 333 out of the treasurer's pocket and leaves the pot at -333, which is the treasurer's own balance. Correct.
- Finalize: fingerprint covers amounts, payers, bases, dates, splits, people's days, fencing days, families and treasurer. A fingerprint change or an activity id newer than the screen's refuses the finalize. Payments and status are written in one batch.
- Reopen and payment ticks: the count of ticked payments is checked in the same statement.
- Automatic-share expenses that wait offline are resent under the same key and answer "already added" if the first send landed. Changing a resent key's content only reports a difference; it never changes the expense.
- Expense edits check the revision and created_at in the write. Stale editors get a 409.
- Family and person changes check the uid tag in the write.

No HIGH findings. I reasoned the other areas from the code, and did not run them: the offline queue under real signal loss, the reset path, and the receipt upload race.
