Round 10 fix, plain words. I read only (no changes, no commands run in efc-expenses). I read the problem file, src/index.ts, public/split.js, public/pdf.js, and the first 660 lines of public/app.js. For the rest of app.js I grepped the fencing-day sites only.

Root cause: the server stores fencing_days as a trimmed copy of days. When a family day is switched off, the family PATCH (the `IN json_each(?1)` filter on people.fencing_days) and the trailing `.filter(d => days.includes(d))` in PATCH /people/:id throw the tick away. Switching the day back on can't restore it. Bug 2 is the same root: the every-day-fencer rule compares stored fencing_days to stored days, and that rule is only applied on family day changes, not on a person's own-day changes or a switch back to family days.

Simplest right fix:
1. Stop removing fencing ticks when a day leaves. Remove the trim in the family days UPDATE and the trailing filter in PATCH /people/:id. Keep the trim when trip dates shrink, since the UI tells people that is permanent and it is intended.
2. Make the read side the only place that intersects. loadTrip in index.ts is the one place people data reaches the app, split.js, and pdf.js. Map fencing_days to "stored ∩ current days" there. Writes keep comparing against the raw stored list. The client sends single-day flips (fencing_day, own_day), so it cannot overwrite the stored memory with a trimmed list.
3. Rewrite the every-day rule as "every day they were there (old days) is in their fencing list" rather than "fencing equals days". Apply that same test in PATCH /people/:id when own days change or they switch back to family days, and add a newly added day as a tick for them when it passes.

Cost: about five edits in src/index.ts, one mapping in loadTrip, and tests for the two repro cases plus the own-days switch. Probably a few hours with tests.

What it might break:
- Any new code that reads people.fencing_days straight from the database instead of through loadTrip will see the untrimmed list. The comment that fencing days always stay inside days becomes false and needs updating.
- Days already trimmed by the bug cannot be recovered.
- A removed-then-restored day now comes back ticked. That is the intent, but say so to the team.
- The every-day rule's behavior changes in edge cases for fencers whose lists were already trimmed.

Lowest-risk fallback if you want no storage change: when a family day that has fencing ticks is switched off, show a confirm sheet, the same pattern as the existing "Shorten the trip?" prompt. This does not fix a mistaken tap that the person then wants to undo, so it is weaker, but it is about ten lines and nothing else moves.
