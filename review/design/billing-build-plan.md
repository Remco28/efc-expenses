> **Status (2026-10-23): built**, with one change from below: a new fencer starts with no fencing days (Frank, round 11), so a forgotten fencer is flagged rather than charged for every day. The test scripts are in review/code/briefs (see its README).

# Building the new split (billing-model.md): the plan

## Stored data
- **People:** `is_fencer` and `fencing_days` (the days fenced, a list of trip days), stored directly. Unticking Fencer keeps `fencing_days`, so ticking it again brings them back. `days`, `own_days`, `rest_days` (people) and `days` (families) are no longer read or written; the columns stay.
- **Expenses:** `basis` is one of `took_part`, `per_fencer`, `fencer_day`. For `took_part`, `split` is `{ familyId: headCount }` (whole numbers, 1 to 50, staff never). For the other two, `split` is `{}`. The kind (`category`) fixes the basis; only `other` may carry any of the three, and the server enforces it. An expense keeps its date, for display only.
- **Kinds:** `meal` (team meal or outing: took_part), `coach_meals` (fencer_day), `coach_travel` (per_fencer), `coach_stay` (hotel and getting around: fencer_day), `other` (any; starts on took_part).

## The money (public/split.js, shared by the server)
- `took_part`: each listed, non-staff family still on the trip counts its head count.
- `per_fencer`: each family counts its fencers.
- `fencer_day`: each family counts its fencers' fencing days.
- An expense with zero units is "nobody included": flagged on the list and blocks finalize, as today. The server also refuses to save a `took_part` expense with nobody ticked.
- Rounding, balances and the treasurer plan are unchanged.

## Guards kept or changed
- Finalize's fingerprint covers what now moves money: every expense's amount, payer, basis and split; each person's `is_fencer` and `fencing_days`; families' kind. The screen sends the fingerprint it showed (round 10).
- The expense form's "who's on the trip changed" check compares the families, their kinds and sizes, and each person's `is_fencer` and `fencing_days`.
- A new expense names the families it ticks by their tags (`split_uids`) as well as the payer's; the server refuses if any tag doesn't match. With that, every new expense can wait on the phone with no signal.
- Removing a family takes it out of every expense's split (as today); a family that paid can't be removed (as today).
- Shortening the trip drops fencing days outside the new dates, and the "Shorten the trip?" prompt lists the fencers who lose days.

## Screens
- Family screen: the people, Fencer, and each fencer's fencing-day ticks. No "days at the trip" or "own days".
- "Fencing days" (replaces "Check a day"): every fencer on one screen, by family, with a tick per day.
- Expense form: the kind first; for who took part, each family with a tick and a head count (starts at the family's size, editable, can go higher), and "Tick everyone"; for the other two, the shares shown, nothing to tick; for Other, a choice of the three.
- PDF: a fencing-days grid instead of attendance; statement lines say "2 of 9 people" for who took part, "1 of 6 fencers", "3 of 11 fencing days".
- Every piece of help and the tour, the README, the receipt reader's kinds and hints.

## Data
- Migration 0013 changes no columns. A one-off, run by hand after deploying, clears the live site's trips (including recently deleted ones) and re-seeds the practice trip in the new model.
- `src/sandbox.js` is rewritten: no attendance days, fencing days per fencer, meals with ticked families and head counts.

## Tests
- `test/split.test.mjs` rewritten for the three splits.
- The API scripts: the ones written for attendance days (round 3's day rules, round 9's added days, round 10's rest days) are replaced by checks of the new rules. The rest (revisions, tags, keys, finalize, payments) are kept and updated where they used attendance.
