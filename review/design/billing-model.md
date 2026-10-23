# How costs are split: design v2 (agreed with Frank, 2026-10-23)

The app was built on a wrong assumption: that families on the trip eat together by default, so a meal is split among everyone there that day, and so every family and person needs "days at the trip". Frank: team dinners are occasional, often several separate groups; a meal is opt-in. Attendance days aren't needed at all. Fencing days are essential. This replaces the old model; it matches the spreadsheet Frank used before the app.

## Who's on the trip

1. Families, and the people in each, belong to the trip. There are no "days at the trip" for families or people.
2. Coaches and staff are on the trip too, as today. They never pay a share.
3. Each fencer has the days they compete, ticked from the trip's days. It's the only per-day thing.

## Three ways to split

4. **Who took part.** The person entering it ticks the families who took part. Each ticked family has a head count that starts at the family's size and can be changed (a family of 4 with 2 at dinner). The bill is split by head count among the ticked families. The coach is never ticked: the coach's plate is paid by the families who were there. Nobody is ticked to begin with.
5. **Equal per fencer.** Every fencer on the trip pays the same share, however many days they compete.
6. **By fencing days.** Every day a fencer competes is one share, pooled across the trip. Example: five kids fence day 1, and one of them (Ava) fences day 2 as well: 6 shares; Ava pays 2 of them.

## Kinds of expense, each with its split

| Kind | Split |
|---|---|
| Team meal or outing (any meal or activity a group goes to, coach included or not) | Who took part |
| Coach's own meals (breakfast, coffee, lunch at the venue) | By fencing days |
| Coach travel there and back (airfare, bags) | Equal per fencer |
| Coach hotel and getting around (hotel, rental car, gas, Ubers, parking) | By fencing days |
| Other | The person entering it picks one of the three |

Gone: team supplies and ground transport as kinds of expense (supplies are the coach's responsibility; snacks one parent buys aren't shared), the per-person-by-attendance, per-family and custom splits. Custom may come back later if it's missed.

## Decided after the v1 critics (billing-model-v1-critic-*.md), Frank: "yes to all"

- Each kind's split is fixed; only Other lets the person pick, and it starts on "who took part".
- A head count is saved as entered (a sibling added later doesn't change past meals). It can be above the family's size (a visiting grandparent). Unticking is how a family is left out.
- "Tick everyone" for a big dinner, then untick the few who didn't come.
- Fencing days are the days actually fenced. Anyone can fix them until the trip is finalized.
- A trip-wide "Fencing days" screen replaces "Check a day": every fencer, tick their days; the treasurer checks it before finalizing.
- A fencer with no days ticked still pays their share of coach travel and nothing toward the hotel. The app warns ("Ava has no fencing days ticked") and blocks nothing.
- Parents' own parking and gas aren't shared. Only the coach's getting around is.
- A meal can wait on the phone with no signal, like other new expenses (the ticked families are named by their tags, so a family removed and replaced can't be charged by mistake).
- Kept from today: finalize is blocked while an expense has nobody to split it among; removing a family takes it out of every expense; a family that paid can't be removed; coaches never pay a share; shares always add up to the cent; finalize freezes the numbers.

## What else changes

- The PDF shows fencing days instead of attendance.
- The family screen loses "days at the trip" and "own days". It keeps the people, Fencer, and the fencing-day ticks.
- Every explanation is rewritten to match: the help on each split, the app's tour, hints, warnings ("nobody included", "no fencing days"), the expense view, the PDF's notes, the receipt reader's list of kinds, and the README.
- The live site's trips, including recently deleted ones, are test data (Frank): they are cleared, and the practice trip is re-seeded in the new model, with its meals ticked. No conversion of old expenses.

## Not decided here

How the data is stored and moved (what replaces `days`, `own_days`, `rest_days`; what an expense's `split` holds now). That is the build's job, after this design is checked.
