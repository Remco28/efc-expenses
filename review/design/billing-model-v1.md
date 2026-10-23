# How costs are split: design v1 (agreed with Frank, 2026-10-23)

The app was built on a wrong assumption: that families on the trip eat together by default, so a meal is split among everyone there that day, and so every family and person needs "days at the trip". Frank: team dinners are occasional, often several separate groups; a meal is opt-in. Attendance days aren't needed at all. Fencing days are essential. This replaces the old model; it matches the spreadsheet Frank used before the app.

## Who's on the trip

1. Families, and the people in each, belong to the trip. There are no "days at the trip" for families or people.
2. Coaches and staff are on the trip too, as today. They never pay a share.
3. Each fencer has the days they compete, ticked from the trip's days. It's the only per-day thing.

## Three ways to split

4. **Who took part.** The person entering it ticks the families who took part. Each ticked family has a head count that starts at the family's size and can be changed (a family of 4 with 2 at dinner). The bill is split by head count among the ticked families. The coach is never ticked: the coach's plate is paid by the families who were there. Nobody is ticked to begin with.
5. **Equal per fencer.** Every fencer on the trip pays the same share, however many days they compete.
6. **By fencing days.** Every day a fencer competes is one share, pooled across the trip (2 nights of hotel, five kids fencing day 1 and one kid fencing both days: 6 shares).

## Kinds of expense, each with its split

| Kind | Split |
|---|---|
| Team meal or outing (any meal or activity a group goes to, coach included or not) | Who took part |
| Coach's own meals (breakfast, coffee, lunch at the venue) | By fencing days |
| Coach travel there and back (airfare, bags) | Equal per fencer |
| Coach hotel and getting around (hotel, rental car, gas, Ubers, parking) | By fencing days |
| Other | The person entering it picks one of the three |

Gone: team supplies and ground transport as kinds of expense (supplies are the coach's responsibility; snacks one parent buys aren't shared), the per-person-by-attendance, per-family and custom splits. Custom may come back later if it's missed.

## What else changes

- The "Check a day" screen becomes "who's fencing which day", or goes.
- The PDF shows fencing days instead of attendance.
- The family screen loses "days at the trip" and "own days". It keeps the people, Fencer, and the fencing-day ticks.
- Every explanation is rewritten to match: the help on each split, the app's tour, hints, warnings ("nobody included"), and the README.
- The live site's trips are test data: they are reset, and the practice trip is re-seeded in the new model. No conversion of old expenses.

## Not decided here

How the data is stored and moved (what replaces `days`, `own_days`, `rest_days`; what an expense's `split` holds now). That is the build's job, after this design is checked.
