Judgement on plan v2 (rest_days). Read-only: I changed, created and ran nothing in /home/frank/Dev/efc-expenses. I read the plan, the server routes for family days, person PATCH and POST, trip dates, loadTrip and the finalize fingerprint, plus the readers in split.js, pdf.js and app.js, and the sandbox seed.

Short version: the core idea holds and is the right size for the bugs. But the plan misses one concrete regression that works today, and it leaves a few behaviour changes unstated.

Where it breaks

1. A lost-update regression, the main one. Today the person PATCH guards its write with the stored fencing list: it only writes if nobody changed that list since this phone read it. Plan v2 says the fencing column is no longer read or written, so that guard becomes a no-op unless it is moved to rest_days. The plan does not mention it. Example: phone A loads Emma, phone B taps Sat off (Sat goes into rest), then phone A renames Emma. A's stale read still has no rest for Sat, so its write puts Sat back to fenced. The tap is silently undone, and today the guard catches it. The guard must be rewritten to check rest_days, and a test should cover this two-phone case.

2. Stale rest days come back. The plan says rest days outside the trip "mean nothing" and that shortening trims nothing. That is true on screen, but a day rested before a shorten is still rested when the trip is extended again and the family re-adds it. Today the same day comes back unfenced too, so this is not worse. But it is a choice the plan should name, and rest_days grows without any trim. The same applies to moving the trip dates onto overlapping days. I would accept this and say so.

3. The one behaviour change is bigger than the plan's wording. The plan describes a fencer who fences only some days, given a day they were never there for, who now fences it. It also covers a fencer who ticked no days at all: a new day added later is now fenced, where today it is not. In both cases the coach-stay money goes up for that family. The tick is visible on screen, but a parent may not look, and nothing is written to the activity log. I would add a log line or a warning for that case.

What holds up

- Storing the rest instead of the fenced days removes the trimming and the every-day guess together. Both reproduced bugs are fixed: a day taken off and back on keeps its state, and a family or own-day change no longer touches the person's picks.
- The every-day edge the peer critics raised holds up: a fencer who fences all days, loses Sat, then gets Mon added, gets Mon fenced.
- Trip shortening no longer silently drops hidden ticks, which answers the fourth peer-critic point.
- Every reader filters on is_fencer (split.js counts only fencers, pdf.js and app.js check it), so computing a fencing list for non-fencers is harmless.
- The finalize fingerprint is only compared inside one request (snapshot, then recheck). Nothing is stored, so the migration does not break finalized trips.
- The sandbox seed still produces the right state by default, since its fencers fence every day they are there. Its insert still names the dead column, and it should be changed to write rest_days so the seed says what it means.
- The migration rules agree with today's behaviour for never-picked non-fencers and for trimmed lists.

Is it more than the problem needs?

Roughly the right size. The extra pieces are the compatibility inputs (a full fencing list on add and on PATCH). The app never sends them, so they are optional and could go unless an outside client uses them. The migration is the real cost: it flips what the column means. That is the price of making "rested" the stored fact. I would not start over.

Recommended before coding: rewrite the person-update guard to use rest_days, state the stale-rest and fenced-by-default behaviour in the plan, and decide whether the new-day-fenced case needs a visible notice.
