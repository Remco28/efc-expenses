# Round 10: fencing days get lost

## The problem

Each person has the days they're at the trip (`days`) and, if they fence, the days they fence (`fencing_days`), stored as two lists. Whenever a person's days shrink, the server trims `fencing_days` to match. When the day comes back, the fencing tick doesn't, except for a fencer who fenced every day (a rule from round 9: "fencing_days equals days, so follow").

Found in round 10, both reproduced through the API:
1. A fencer fences Fri and Sat of a Fri-Sun trip. A parent taps the family's Sat off (by mistake, or to fix something) and back on. The fencer's Sat fencing tick is gone. Expenses split per fencer-day now charge that family less and everyone else more, and nobody is told.
2. The round-9 rule (an every-day fencer fences a day added) is applied when a family's days change, but not when a person's own days change, or when they switch back to following the family.

The code: `PATCH /families/:id` (the days branch: the UPDATE of people), `PATCH /people/:id` (the `.filter(d => days.includes(d))` at the end of `fencing`), the trip read (`tripData`), and the trip-dates PATCH, which trims both lists to the trip's range.

