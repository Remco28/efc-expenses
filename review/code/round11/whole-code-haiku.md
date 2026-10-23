Review of the copy at /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl11/whole-haiku (commit 60fcc7d). Verdict: no HIGH findings in the parent flows I checked. One MEDIUM and one LOW.

MEDIUM: a phone's "This is us" family can silently become a different family after a family id is reused.
- The phone stores its family as a bare number (public/app.js:432-433, myKey / myFamily: `S.trip.families.find(f => f.id === Number(v))`), with no uid check.
- Steps: Phone A taps "This is us" on Jones (id 2). Another parent removes Jones (Jones paid nothing). Someone adds Lee. Lee gets id 2.
- Ran it on the local server: families Smith=1, Jones=2, delete Jones (200), then the next family POST returned id 2. Migration 0001 uses `id INTEGER PRIMARY KEY` with no AUTOINCREMENT, so this is expected whenever the deleted family was the newest.
- Phone A now shows "Lee family" on its You card, pre-highlights Lee under "Who paid?" on new expenses, and pre-fills Lee as treasurer family in "Be the treasurer".
- The server does not catch this, because the uid check passes for the form as shown. The parent sees the wrong name on screen and can change it with one tap, so it is visible and recoverable, but it is easy to miss on a phone.
- Reasoned from the code for the phone side; ran the id reuse.
- Fix: store the family's uid next to the id and resolve by both.

LOW: stale comment in src/index.ts (POST /tournaments/:id/families) says a family not listed on an expense "counts as automatic". split.js unitsFor() does the opposite for took_part: an unticked family gets 0 units. The behaviour is right, and the design (billing-model.md) says unticked means did not take part. A future edit that trusts the comment could break it. review/code/README.md's "Changed design" line repeats the stale claim. Code only; no wrong result today.

Checked and fine:
- Split math: ran a fuzz of 20,000 random trips (scratchpad/rl11/fuzz/fuzz.mjs). Every expense's shares sum to the cent, staff never pay, balances net to zero, and the treasurer pot equals the treasurer family's own balance. 0 problems. Unit tests in test/split.test.mjs: 16/16 pass when run as a file. (Running `node --test test/` as a directory failed; I did not dig into that.)
- Finalize: the fingerprint, the activity check and the single guarded batch cover the races I could construct. Reopen, payment ticks and edit/delete guards (rev, created_at, uid) look right.
- Queued offline expenses: keys, the "already" answer and the uid checks hold. Read only.

Accepted by design, but worth knowing: a queued expense that reaches the server after finalize is refused. It then appears only on the payer's phone under "Couldn't send", and the treasurer's final numbers omit it (saving-design-v4 section 4). Only that payer sees the refusal, and only when the app is open.

Not done: no browser/UI run. Read the browser code, not clicked through.

Housekeeping: I started wrangler on 8862, applied migrations to the copy's .local-db, and created one test trip ("Idreuse test ..."). Server stopped; ports 8862 and 9862 are free. Nothing outside the copy was touched.
