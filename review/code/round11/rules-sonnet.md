Review of commit 60fcc7d against review/design/billing-model.md. Short answer: the money math follows the rules, and I found one real disagreement with them plus one stale line of text. I also ran the 16 unit tests (all pass), started the app, and stopped it; port 8865 is free.

**What matches the rules (read from the code and the tests; I didn't try every case in the browser)**
- `public/split.js` and `src/index.ts` agree with the rules on:
  - the five kinds of expense and their fixed splits (only Other lets the person pick, and it starts on "who took part");
  - head counts saved as entered, and a family left out by unticking;
  - coaches and staff never paying a share;
  - largest-remainder rounding, so shares add up to the cent;
  - finalize blocked when an expense has nobody to split it among;
  - a family that paid can't be removed;
  - removing a family takes it out of every expense;
  - waiting expenses naming ticked families by their tags;
  - a fencer with no days paying coach travel but nothing toward the hotel;
  - the "has no fencing days ticked" warning blocking nothing.
- The PDF shows fencing days and has no attendance left. The receipt reader's list of kinds is current.

**1. MEDIUM: a new fencer starts with every day of the trip ticked, not none (ran it)**
- The rules say fencing days are "the days actually fenced". The rules' "Ava has no fencing days ticked" warning only makes sense if a new fencer starts with nothing ticked. The v1 critic also assumed nothing ticked.
- Steps:
  1. Create a 3-day trip and a family.
  2. Add a fencer (`POST /families/:id/people` with `is_fencer: true`).
  3. The new fencer comes back with `fencing_days` = all 3 days.
  - The code is `src/index.ts`, "A new fencer starts fencing every day of the trip". Ticking Fencer on an existing non-fencer who has no days (PATCH `/people/:id`) also fills in every day.
- A parent who adds a kid and never opens the day chips is silently charged for every day on the coach's hotel, getting around and own meals. The "no fencing days" warning never fires for them. The cost lands on the other families, and the treasurer's check on the Fencing days screen is the only safety net.
- It is recoverable until finalize, so I rated it MEDIUM. If the club wants "tick every day" as the default, say so in the rules. Otherwise start at none and let the existing warning do its job.

**2. LOW: the expense list still says "transport and supplies" are shared (read the code)**
- `public/app.js` line 565 says "Shared costs only: team meals, the coach's travel and stay, transport and supplies."
- The rules removed both kinds, and the README says supplies are not tracked. A parent could reasonably enter team supplies or ground transport as an expense.
- The line should read like the README: meals and outings, and the coach's travel, hotel, getting around and own meals.

**3. LOW: stale comments (no effect on behaviour)**
- `migrations/0012_rest_days.sql` says `fencing_days` "is no longer read or written" and fencing days are "days minus rest days". The code reads and writes `fencing_days` and ignores `rest_days`. Nothing is wrong at runtime, and the live data was cleared.
- The comment at `src/index.ts` ~line 570, "shares existing costs automatically (see unitsFor)", describes the old model. Under the new rules a late family is only included in per-fencer and by-fencing-days expenses. It is not added to meals, which is correct.

Nothing else disagreed with the rules.
