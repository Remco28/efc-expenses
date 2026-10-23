Verdict: the core idea holds up, and the rest needs a few sharper rules. I read the plan against src/index.ts and public/*.js. I ran nothing.

WHAT HOLDS UP
- Keeping the ticks and showing only the part that overlaps the person's days fixes bug 1 at its root. It also makes a mistaken tap on a day truly reversible.
- Reading is funneled through one place. Only loadTrip (the trip read) turns the stored column into what the app sees. The finalize payments, the money math in split.js, the PDF, the warnings ("has no fencing days") and the change-detection snapshot in app.js all take their data from that read. split.js and pdf.js really do trust that the list is already clean, so intersecting in that one function covers every screen and the money. I found no second server-side reader of the raw column, other than the change fingerprint (see below).
- Shortening the trip still trims, which is right. No migration is fine too, since existing lists are already trimmed. The one cost is that anyone who already lost a tick before the fix doesn't get it back. That is acceptable, but say so.
- The existing guard in the person PATCH (the update only applies if the stored list is unchanged) still works with a stored-vs-visible split, because it compares the stored list.

WHERE IT STILL GIVES A WRONG RESULT

1. The "fences every day" test is ambiguous once you compare against what is shown. It will still silently add a fencing tick the parent never wanted.
- Example: a kid fences Fri and Sun of Fri-Sun, and a parent deliberately unticks Sat because he sat that day out. The stored list is Fri, Sun. A parent then taps Sat off, which leaves days of Fri, Sun, and the visible list equals the days. That now looks like "fences every day." Tapping Sat back on adds a Sat fencing tick, and Sat-per-fencer-day costs shift with no warning.
- This is the same silent wrong result as bug 1, in the other direction. Today's code does the same thing, so it isn't worse, but the plan claims to fix the rule.
- The test needs a memory of intent, not just a comparison against the days now. For example, compare against the days and ticks as they stood before this change, or keep an explicit "fences every day" marker that an explicit untick clears. Decide this deliberately.

2. A person with no days at all passes the test for nothing. With zero days, the empty visible list equals the empty days list. If a parent clears every day and then adds one, the "every-day fencer" rule fires for everyone, including a fencer who had hidden ticks Fri and Sat. They would get the new day as a fencing day too. Require at least one current day, or use the before-state from point 1.

3. The rule needs the state before the change, not after.
- For "back to family days" and own-days edits, the person's old days are being replaced, so "fences every day they're there" must be judged on the old days and old ticks. Judging it against the new days will almost never match.
- For family-day changes, the existing SQL batch decides this inside the database at write time. Keep it there. Doing it in the server code from an earlier read would reopen the race that comment in the code is guarding against, where a fencing tap lands at the same moment.

4. The person PATCH has two places that use the stored list where they should use the visible one.
- When someone ticks Fencer on and has no days ticked (`!p.is_fencer && !wasFencing.length ? days : wasFencing`), a non-fencer holding only hidden ticks would become a fencer with nothing visible. They get the "pays nothing toward the coach's stay" warning instead of the all-days default.
- If the endpoint accepts a full `fencing_days` list, as it does today, it will overwrite the stored list with the visible one. That wipes the hidden ticks. Decide whether a full list replaces the visible part only and merges with the hidden ticks, or replaces everything. The one-day `fencing_day` flip already works on the stored list and is fine. Today's client only sends one-day flips, but the API accepts both.

5. Removing the final `.filter(d => days.includes(d))` means the API will start storing a tick for a day the person isn't there. This is probably harmless, since it stays hidden, but be aware of it. It also means a stored tick can sit behind a day that is later added by some other path, such as a bulk set of days.

MAKES SOMETHING WORSE, OR A SIDE EFFECT
- The change fingerprint (FINGERPRINT_SQL) hashes the raw stored column. Hidden-tick-only changes will now change the fingerprint without changing any money. The only effect is an occasional spurious "someone changed the trip while you were finalizing" refusal. Hash the visible intersection, or accept it. It is small.
- Hidden ticks are invisible, so a parent can't see or remove one. Example: a fencer is off on Sat, the parent wants Sat to be a non-fencing day when it comes back, and the old tick reappears. The tick is then visible and one tap clears it, so this is mild, but the old behavior never surprised anyone this way. A short note in the "day back on" feedback would cover it.

IS IT MORE THAN THE PROBLEM NEEDS?
- The stop-trimming and intersect-on-read half is the right size.
- The every-day rule is the part that can still go wrong, because it is a guess about intent. Making that guess in three more places (family days, own days, back to family days) spreads the weak spot. Better to define it once as "before this change, did the person fence every day they were there, with at least one day," and reuse that definition in all three. Do not add more rules beyond that.

SUGGESTED TESTS
- Fri, Sat fencer: Sat off and on keeps the tick (bug 1).
- Fri, Sun fencer with a deliberate Sat untick: Sat off and on must not add a fencing tick.
- Clear all days, then add one, for a fencer with hidden ticks.
- Own days: switch to family days and back.
- Non-fencer with only hidden ticks becomes a fencer.
- A full `fencing_days` PATCH while ticks are hidden.
- Shorten the trip, then lengthen it.
- Finalize while a hidden-only change lands.
