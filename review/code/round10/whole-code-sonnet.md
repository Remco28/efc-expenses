I found one problem worth fixing and one rare race. The rest of the money paths held up. I read all of `src/index.ts`, `public/split.js`, most of `public/app.js`, and the migrations. I ran the app and exercised the family-day behavior through the API. The server is stopped.

**1. MEDIUM: Unticking a family day and re-ticking it silently deletes a fencer's fencing tick for that day.** I ran this.
Steps, on a 3-day trip (Fri to Sun), with a fencer who follows the family's days:
1. A parent unticks Sun under "Fences on". The fencer's fencing days are now Fri and Sat.
2. A parent taps Sat off on the family's "Days at the trip", by mistake or to fix a day. The fencing days are trimmed to Fri.
3. They tap Sat on again. The family and person days return to Fri, Sat and Sun, but the fencing days stay at Fri, and Sat's fencing tick is gone.

I confirmed this through the API. After step 1 the fencing days were `[Fri, Sat]`. After the off/on of Sat they were `[Fri]`.
- Code: in the `PATCH /families/:id` days branch, fencing days are trimmed to the new days, and the re-add only restores them when `fencing_days = days`. In `PATCH /people/:id`, the final `.filter(d => days.includes(d))` does the same.
- Effect: the app has no warning for this, and the fencer still has one day ticked. Anything split per fencer-day, such as the coach's stay, then charges that family less and everyone else more.
- Fencers who fence every day are not affected, because the "fences all days" rule restores them.
- The same loss happens if the trip is shortened and then lengthened. The "Shorten the trip?" prompt warns about that case.

**2. LOW: Finalize can slip past its "something changed" check in a very narrow window (reasoned from the code, not run).**
- The server compares `seen_activity` with the newest activity row. Every write commits first and logs afterward, in a separate statement.
- If Phone A's expense or attendance write has committed but its log row is not in yet, and Phone B (which loaded before A's change) hits Finalize in that gap, the activity check passes.
- The server fingerprint is then taken after A's change, so B finalizes numbers that include something B never saw. B's confirmation dialog did not show it.
- The window is a few milliseconds, and the trip is reopenable, so this is rare and recoverable.

**Checked, no problem found:**
- Split rounding: shares always sum to the amount.
- Treasurer plan with and without the treasurer's own family.
- Staff paying and being paid back.
- Expense edits and deletes retried after a lost reply.
- The offline waiting queue.
- Expense revision and created_at guards.
- Family removal rewriting splits in the same statement.
- Reopen with ticked payments.
- The finalize fingerprint against concurrent edits.

Files: `/tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl10/whole-sonnet/src/index.ts` and `.../public/app.js`. The repro script is `/tmp/claude-1000/t1.sh`.
