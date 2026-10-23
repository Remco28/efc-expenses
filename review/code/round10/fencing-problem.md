# Round 10: fencing days get lost

## The problem

Each person has the days they're at the trip (`days`) and, if they fence, the days they fence (`fencing_days`), stored as two lists. Whenever a person's days shrink, the server trims `fencing_days` to match. When the day comes back, the fencing tick doesn't, except for a fencer who fenced every day (a rule from round 9: "fencing_days equals days, so follow").

Found in round 10, both reproduced through the API:
1. A fencer fences Fri and Sat of a Fri-Sun trip. A parent taps the family's Sat off (by mistake, or to fix something) and back on. The fencer's Sat fencing tick is gone. Expenses split per fencer-day now charge that family less and everyone else more, and nobody is told.
2. The round-9 rule (an every-day fencer fences a day added) is applied when a family's days change, but not when a person's own days change, or when they switch back to following the family.

The code: `PATCH /families/:id` (the days branch: the UPDATE of people), `PATCH /people/:id` (the `.filter(d => days.includes(d))` at the end of `fencing`), the trip read (`tripData`), and the trip-dates PATCH, which trims both lists to the trip's range.

## The author's plan

Stop trimming. The stored fencing list remembers ticks on days the person isn't there; the server only ever shows the part that overlaps their days.
- The trip read returns `fencing_days` as the stored list intersected with `days`. Every screen, the money math and the PDF use that, so they don't change.
- A family-day or own-day change no longer trims the stored list.
- The every-day rule applies everywhere days are added (family days, own days, back to family days): if the person is a fencer who fences every day they're currently there, the added days join the stored list.
- Shortening the trip still trims both lists to the trip's range (it already warns).
- No migration: lists already stored are already trimmed, so nothing changes for them until the next change.

## Pass 1 (peer-critic-*.md, peer-solver-*.md)

All four agreed on the core: stop trimming, and show only the overlap, in one place (`loadTrip`, which finalize uses too). All four found the weak spot: the every-day rule guesses intent from the lists as they stand, so it can still add a fencing tick nobody wanted (a deliberate Sat untick, then Sat off and on, looks like "fences every day"), or miss one. Three suggested remembering intent explicitly.

## The plan, v2: remember the days they rest, not the days they fence

- Each person stores the days they are there but **not** fencing (`rest_days`), instead of the days they fence. Their fencing days are always their days minus their rest days, worked out in `loadTrip` for every screen, the money math, the PDF and finalize.
- That removes the every-day rule and all trimming. A day taken off and put back comes back as it was: rested if it was rested, fenced otherwise. A day a person was never there for is fenced when it's added, the same as a new fencer, who fences every day they're there.
- Ticking or unticking a fencing day adds or removes it from `rest_days`. Unticking Fencer keeps `rest_days`, so ticking it again brings back the days as picked.
- Changing a family's days, a person's own days, or switching back to the family's days never touches `rest_days`. Shortening the trip trims nothing extra; rest days outside the trip mean nothing.
- Migration 0012 adds `rest_days` and fills it from today's lists: days minus fencing days for fencers, and for non-fencers who have remembered picks; empty for non-fencers who never picked. The `fencing_days` column is no longer read or written. Finalize's fingerprint uses `rest_days`.
- The API keeps returning `fencing_days` (worked out), and still accepts a full `fencing_days` list when adding a person (stored as days minus that list).
- The one behaviour change beyond the fix: a fencer who fences only some days, given a day they were never there for, fences it. Today they wouldn't. Either is a guess; this one matches how a new fencer starts, and the tick is shown.
