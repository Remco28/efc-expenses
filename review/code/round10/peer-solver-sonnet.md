**Recommendation: stop deleting fencing days when a person's days shrink. Keep the ticked days as they were, and ignore any that fall outside the person's current days when you read them.**

**Why it happens.** `fencing_days` is trimmed to `days` at write time in three places:
- the family-days UPDATE (`src/index.ts` ~592),
- the `.filter(d => days.includes(d))` in the person PATCH (~671),
- the trip-dates `keep()` trim (~400).

The trim destroys information, and no later rule can recover it. The round-9 "follow if equal" rule is a guess at what was lost. It only exists in the family branch, which is why bug 2 happens.

**The fix, in four steps.**
1. Stop trimming the stored `fencing_days` to `days` in the family UPDATE and the person PATCH. The stored list means "days this person fences, if they're there". Add and remove still work on the stored list, so a tap on one day doesn't disturb the others.
2. Do the clipping in one place, `loadTrip` (~176). When it builds `people`, set `fencing_days` to the stored list filtered by the person's `days`. Everything else reads this value: `split.js` (the per-fencer-day count), `pdf.js`, and the "no fencing days" warnings and day chips in `app.js`. So no client change is needed. The client only sends single `fencing_day` toggles, not whole lists, so it can't write the clipped list back.
3. For the "every-day fencer follows added days" rule, you need to know who "fences every day". Today that's inferred from `fencing_days == days`, which breaks once the list is no longer trimmed. The clean way is a small boolean column such as `fences_all`:
   - It is set when a fencer is created (the default is every day).
   - It is set when a tick makes the list equal the days.
   - It is cleared when the user unticks a fencing day.
   - When it is true, the effective fencing days are simply `days`.
   - That makes the rule one line at read time and removes the family-branch CASE. Person-level day changes and switching back to following the family then behave the same way, because there is nothing left to apply at write time.
4. The trip-dates trim can stay as it is. That change is deliberate, and `days` is trimmed there too. Don't trim `fencing_days` there, so the read-time clip covers it, or leave it. Either works.

**Cost.** This is small:
- One migration to add the column. Existing rows can be backfilled with `fences_all = (fencing_days = days AND is_fencer)`.
- One change in `loadTrip`.
- Removal of two trims and the CASE expression.
- A flag set or cleared in the person PATCH, the person POST and the family PATCH.

**Cheaper variant without a column.** Keep the "equal means follow" heuristic, but apply it in one shared place for both family and person changes. It is ambiguous, though. Someone who fenced Fri and Sat of a Fri-Sun trip, with Sat tapped off, looks like an every-day fencer (the effective list equals the days). Adding Sun would then silently add a Sun fencing tick. I'd skip this variant and use the flag.

**What might break.**
- **Hidden state is now stored.** Stored fencing days outside a person's days are invisible, but they come back when the day returns. That is the intent. Someone who deliberately removes a day and re-adds it weeks later will get the old tick back. Everyone else gets what they expect.
- **Direct readers of the column.** Anything reading the raw DB column instead of `loadTrip` would see the unclipped list. `FINGERPRINT_SQL` (~123) is one. It includes raw `fencing_days`, so it can change when nothing in the money changed. That only causes a spurious "stale" and is harmless, but it's worth knowing. The person PATCH's own concurrency check compares the raw stored value, which is correct.
- **Finalized trips.** The fingerprint for these may now differ on first load after migration if any stored lists weren't equal to their effective lists. None should be, since old data was already trimmed.
- **Stale flag.** If the person PATCH forgets to clear `fences_all` on an untick, the person silently fences every day. Test that path explicitly.

**Tests to run.**
- Bug 1: Fri and Sat fenced, tap Sat off and on, and Sat is still ticked.
- Bug 2: an every-day fencer gets a day added through the family, then through their own days, then by switching back to following the family. In all three cases they fence the new day.
- A partial fencer is never auto-extended.
- Shrinking the trip dates, then widening them again.
- Un-fencer then re-fencer.
