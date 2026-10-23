Review of round 10 plan (fencing days get lost). Read-only; nothing in /home/frank/Dev/efc-expenses was changed or run.

Short version: the core idea (stop trimming the stored fencing list, and filter it on read) is sound and is about the smallest fix for bug 1. The every-day rule for bug 2 is where the plan goes wrong, and there are two places in the plan that could produce wrong money if implemented as the code is written today.

Where it still gives wrong results

1. The read filter must live in loadTrip, not in the GET route. src/index.ts:167-180 (loadTrip) is used by both GET /trip (line 375) and by finalize (line 431). Finalize computes the payments from loadTrip's output. If the plan's "intersect with days" is added only to the GET handler, finalize will count hidden ticks in the per-fencer-day split and charge the coach stay wrongly, and the screen will show something different from what was finalized. Put the intersection in loadTrip, so the screens, the PDF and finalize all see the same thing.

2. The every-day test has to be an intersection, not equality. The existing rule at src/index.ts:592 is `people.fencing_days = people.days` on the raw stored list. Once hidden ticks are kept, that equality fails for an every-day fencer as soon as a day has been dropped. Example: trip Fri-Sun, a fencer fences all three days, a parent drops Sat, then the trip is extended and Mon is added to the family. With the literal equality, Mon is not ticked for the fencer, although the fencer fenced every day they were there. The plan needs to say "stored list contains every current day," and the same test has to be used in the PATCH /people path too.

3. The every-day rule reads the current state, so removing a day you did not fence makes you look like an every-day fencer. Example: trip Fri-Sat, a fencer ticks Fri only. A parent takes Sat off and back on. Sat now shows as ticked for the fencer. Today's code does the same thing (after the trim, stored equals days, so the rule fires), so this is not a regression. But bug 2 asks the rule to run on more paths (own days, back to family days), and each one inherits this wrong join. The stored list cannot tell "never fenced Sun" apart from "fenced Sun, then it was dropped", because removed days are not remembered. The plan does not fix this. A real fix needs an explicit per-person flag ("fences every day"), which is a small migration. The plan says no migration, so this is a trade-off the author should decide on, not something to slip in.

4. Shortening the trip hides a loss. Trip-dates PATCH (src/index.ts:388-402) still trims both lists, which is right. But the warning in app.js (about lines 643-648) only lists people whose days fall outside the new range. Hidden fencing ticks outside the new range disappear with no warning. Low impact, since those days were already off, but it is a silent change.

5. Comment at src/index.ts:525-526 ("fencing days always stay within the days a person is there") becomes false. Update it with the change so the next reader is not misled.

6. Test coverage: test/split.test.mjs only covers the split math, and there is no server test. The plan says "reproduced through the API" but adds no test for the hidden-tick read path or the every-day rule. Add at least a loadTrip test for the intersection.

What holds up

- Not trimming on family or own-day change is the simplest way to make the Sat-off-then-on case come back. It avoids reconstructing lists later.
- Intersecting on read means every screen, the expense form, the day view and the PDF are fixed in one place, instead of each one filtering.
- No migration is fine. Stored lists are already trimmed; they only start holding hidden ticks after the next change.
- The guarded writes (the WHERE clauses that compare the old stored value) keep working, since they compare the raw stored value that the client sent back.
- The trip-date trim stays unchanged, which is correct, since a range change is the one case where the user has been warned.
- The fingerprint used by finalize compares the raw stored lists. That is harmless: it only makes the check stricter, not wrong.

Is it more than the problem needs?

Bug 1 needs only the no-trim change plus the intersection in loadTrip. That part is no more than needed. Bug 2 is the part that adds risk: extending the every-day rule to every path spreads the inference flaw in point 3. My suggestion is to ship bug 1 alone first, and decide the every-day rule separately, with an explicit flag or with the author accepting point 3 in writing.

