I found nothing that gives a parent a wrong result or loses their work in realistic use, so I have no HIGH findings and no MEDIUM findings I could demonstrate. I read all of src/index.ts, public/split.js and public/app.js. I checked the code against billing-model.md and saving-design-v4.md.

**What I ran**
- The unit tests: 16 of 16 pass. Running `node --test test` on the folder reports a failure, but that is the runner treating the directory as a file. `node --test test/split.test.mjs` passes.
- A randomized check of split.js: 20,000 trips with random families, fencers, fencing days, head counts, amounts and a coach (staff) payer. I checked three things each time:
  - Each expense's shares add up exactly to its amount.
  - All family balances sum to zero.
  - With the treasurer's family left out of the plan, money collected minus money paid out equals that family's balance (or zero if the treasurer is not on the trip).
  - There were 0 failures.
- A server started on 8861 with a trip and three families created through the API. I did not drive concurrent requests. Port 8861 is stopped and free.

**What I reasoned from the code**
- Finalize can only apply to the numbers the treasurer saw, because the guard is checked inside the same database batch as the writes.
- The one-day fencing taps are idempotent and applied to the stored list, so two phones can't undo each other.
- Family and person tags, expense revision numbers, and the add-keys guard against reused ids and double adds.
- Shortening a trip's dates is a guarded batch.
- Removing a family takes it out of every expense, and a family that paid can't be removed.
- The offline waiting list and its replies follow saving-design-v4.md.

**Two minor findings, both reasoned only (not run)**

1. LOW (rare timing): a family can be removed while a meal expense that ticks it is being saved.
   - Step by step: phone A saves or edits a meal ticking family X. The server checks that X exists and that its tag matches. Phone B removes X in the milliseconds before A's insert or update runs. B's removal only rewrites expenses that already have X in their split.
   - Result: the saved expense keeps a dead family id in its split. The split code ignores unknown families, so everyone else silently absorbs X's part. If X was the only ticked family, the expense shows as having nobody to split it among, and finalize blocks it, so that case is visible.
   - Why it is rare: it needs two phones within about 50 ms, on a family that never paid.
   - A fix would check the ticked families inside the insert or update statement.

2. LOW (annoyance): ticking Fencer off and on again resets the days.
   - Step by step: a fencer who deliberately has no days ticked (the app warns about this) has Fencer unticked and then ticked again. The server sees "no days, not a fencer", treats them as new, and ticks every day of the trip.
   - Result: the person is then charged for every day of the hotel and coach meals. This shows on the Fencing days screen, and the person already had a warning, so it is visible and recoverable.

**Things I looked at and left alone**
- A new fencer defaults to every trip day. The code comments call this deliberate, and it is visible on the Fencing days screen.
- A staff member can be chosen as the payer and gets a pay-back line. That matches the design.
- A cost that someone enters as "1.250" is read as $1.25, because a period is always a decimal point. This is unlikely for US parents.
- The trip screen reads its data and its finalize fingerprint in two separate steps. A change landing between them would be caught by the activity check at finalize, so I count it as covered.
