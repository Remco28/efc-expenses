Verdict: v2 holds up on the bug it targets, but has a few holes to close before coding. I read the plan and the touched parts of src/index.ts (loadTrip, the family days PATCH, the people PATCH and POST, the trip-dates PATCH, the fingerprint SQL, the sandbox seeding) and public/split.js, pdf.js and app.js. I ran nothing.

WHAT HOLDS UP
- Both reported bugs go away. The Sat-off-and-on case comes back as it was, and the guesswork about "every-day fencer" is gone.
- Storing rests instead of fences makes an unknown day default to fencing, which matches how a new fencer starts. Nothing has to read intent from the stored lists any more.
- The family-days update gets simpler. Today it has a CASE expression that rewrites fencing days, and v2 leaves the person's rest list alone there. That also removes a race on the compare-and-swap.
- Deriving fencing days in loadTrip leaves the money math, the PDF, the screens, the "no fencing days" warnings and the client's change-detection signature unchanged. The API shape stays the same, so cached phones keep working.
- The migration is right for the common case: stored fencing days were always trimmed to be within days, so "days minus fencing days" is well defined. A non-fencer with no remembered picks gets an empty rest list, which reproduces today's "tick Fencer, fence every day".

WHERE IT CAN STILL GO WRONG OR GET WORSE
1. A fencer with NO fencing days changes behaviour, which is stronger than the "some days" change the plan admits. Today a fencer with all ticks off (the app warns "has no fencing days") stays that way when a day is added. After migration their rest list is every day, so any added day is fenced and the money shifts quietly. The plan should name this, or the migration should handle that case deliberately.
2. A full fencing_days list sent to PATCH /people could wipe remembered rests. The plan says POST stores "days minus that list". If PATCH does the same, it overwrites rest days outside the person's current days, which is exactly the memory v2 exists to keep. The app itself uses single ticks, so only API callers or old clients would hit it. Specify that PATCH touches only rest days inside current days and leaves the rest alone.
3. The finalize fingerprint would raise false alarms. It hashes the stored list, so rest days outside someone's days, or rest days on a non-fencer, would change it even though money doesn't. The result is spurious "changed, reload" refusals at finalize, not wrong money. Hash the effective fencing days (rest limited to days) plus is_fencer instead.
4. Stale rests return after a trip is shortened and extended. "Rest days outside the trip mean nothing" is true only until the trip is lengthened again. A day that was rested then reappears as rested, which contradicts "a day never there is fenced". It is visible as a tick, so minor, but mention it.
5. Rollout window. Between the migration and the new code going live, old code keeps writing fencing_days, which v2 ignores, so taps in that gap are lost. A rollback would also show a stale column. Probably acceptable for a handful of users, but state it.
6. Loose ends that must be converted: the sandbox seeding (around line 247 of src/index.ts), the POST insert (rest days must be computed in SQL because a follower's days are known only inside the insert), the trip-dates trim, and the fingerprint SQL. Store rest lists sorted, because the compare-and-swap compares strings.

IS IT MORE THAN THE PROBLEM NEEDS?
Slightly more than the minimum, but fair. The smaller option, "stop trimming, show the overlap, keep the every-day rule", still has the intent-guessing flaw the four reviewers found. v2 costs one column, one migration and a fingerprint tweak, and removes both the trimming and the guessing rule. I would not cut it down.

BOTTOM LINE
Go with v2 after fixing items 1 to 3. Items 1 and 3 are one-line decisions, and item 2 is a one-sentence spec change.
