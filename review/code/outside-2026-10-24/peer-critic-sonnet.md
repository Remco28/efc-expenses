Review of the six-fix plan, checked against the pre-fix copy only (nothing changed or run).

Verdict: all six fixes are the right shape and none breaks existing behaviour. Four need one extra detail (1, 2, 3 and 6, plus a small note on 5). Nothing is over-built.

HOLDS UP
- Server fixes 4, 5 and 6 are small and in the pattern the code already uses. The finalize and expense writes already put their guards inside the write itself.
- Fix 3 reuses the server's existing tag refusal (split_uids), so the server needs no change.
- Fix 2 reuses the existing "frozen while it sends" mechanism (the inert flag on the app, the disabled button) and just starts it earlier.
- The "who's on the trip changed" check already compares tags for ticked families, so a kept form's remembered tags fit with it.

1. LATE REFRESH
- It fixes the reported case, but "only if the screen is still that trip's screen" is too weak if it means only the trip id.
  - The same trip can be reloaded by the route (coming back to the app, or opening another screen of the same trip) while the older fetch is in flight.
  - An older answer would then overwrite a newer one.
  - refresh() already guards against this with the route counter plus the hash. Use that same test in loadTrip, not just the trip id.
- The same problem remains in the helpers' own bookkeeping, which the plan doesn't mention.
  - famSave and fencingSave read the trip id from S.trip lazily, after the queue waits. By then S.trip may already be trip B.
  - Their "am I still here" test then compares against B too, so the old trip's save can pass the check on B's screen.
  - The pending counters (fencePending, famPending) are also shared across trips.
  - Fix: capture the trip id at the moment of the tap and use that captured id in both the fetch and the check.
- The tap handlers on the trip, treasurer and settle screens use S.trip.tournament.id and similar, so they are exactly what goes wrong when S.trip is wrongly A. Fixing the overwrite covers them; no separate change is needed.

2. CORRECTION LOST DURING SAVE'S FIRST CHECK
- Freezing at tap fixes it, provided the body is built after the freeze (it already is, since validation reads the form at the top). The plan's list of ways out is nearly complete, with two gaps.
  - The "who's on the trip changed" path calls renderEditor directly. The inert flag lives on the app container, not on the form, so it stays on unless the path clears it explicitly. The plan lists this path; just make sure it really does.
  - A login-required answer (AuthError) calls renderLogin. Inert would still be on, so the code box can't be typed in. The existing second phase already has this latent bug, and the plan makes the first phase share it. Unfreeze before renderLogin in both phases.
- The early validation refusals (amount, payer, nobody ticked) come before the freeze, so they need no unfreezing. Freeze only after they pass.
- The "no signal and it can wait" path leaves the form, so it needs no unfreeze, as the plan says.
- One thing to confirm when building: all form fields must write into the draft on input, not only on blur. Tapping Save blurs the field first, so a last keystroke should be safe either way, but check it.

3. REUSED FAMILY NUMBER IN A KEPT FORM
- The idea is sound, but "remember the tag when a family is picked" misses most of the cases.
  - An edit of an existing expense starts with its payer and ticks already in place, with no pick. Capture the tags when the form is created, from the trip as it was loaded, as well as on each pick.
  - If the tags are only captured on pick, the reopen step would clear every pre-existing tick of an edit form with no remembered tag, and the user would see the warning on a form they had barely touched.
- The payer is the weaker spot.
  - The server only checks the payer's tag when creating (paid_by_uid is sent only when the expense is new, at app.js:1228-ish).
  - An edit does not send the payer's tag at all, and the server's edit route has no payer check.
  - So the payer half of "remember and send tags" would do nothing for edits unless the edit also sends paid_by_uid and the server's edit path checks it. Say whether edits are in scope. If so, that is a small server addition the plan doesn't list.
- The reopen comparison is correct only because the route has just loaded a fresh trip before renderEditor runs. Do it against that fresh trip, not against anything older.
- The cleared pick leaves the form with a payer that is empty or ticks that vanished; the existing validation already handles both ("Pick the family that paid", "Tick who took part"). Good.
- A form kept before the change has no tags, so everything gets cleared once. That is the plan's accepted cost and is reasonable.

4. NAME VS FENCER
- It fixes the problem. The client sends name-only and fencer-only bodies already (app.js:837 and 839), so writing only what was sent works for both.
- Do it in the database statement itself (keep the column when the value sent is null), not as a new read. The current code reads first, which is the bug.
- The same read-then-write habit is not left elsewhere in a harmful way. The family update writes name, pay_notes and role as separate guarded statements, each only if sent.
- A name sent empty falls back to the old name today. Keep that: an empty name is ignored.
- The fencing-day tick is already done as a single in-place statement, which is the good pattern.

5. TREASURER VS FINGERPRINT
- It fixes the problem, and finalize benefits too: it takes the treasurer from the loaded trip, and the fingerprint includes the treasurer.
- Details to get right.
  - If the trip row is deleted between the pre-check and the batch, the batch returns an empty result. Handle that with the same "doesn't exist or was deleted" answer, rather than crashing on an empty row.
  - Keep the trip row in the same shape as before (SELECT *), including the deleted-at test, since the client may read other columns.
- The kept pre-check costs one extra read. It is harmless, but one could drop it and answer 404 from the batch result alone. This is a style choice, not a need.
- loadTrip is only used by the trip GET and by finalize. Nothing else has this pair-mismatch.

6. PERSON INTO A REPLACED FAMILY
- Putting the tag test inside the insert's condition closes the gap, and "out of date, reload" is the right answer.
- A related crash sits next to it: the code reads the family's tag first and uses it directly. If the family is deleted before that read, it reads nothing and the code fails with an error instead of the friendly answer. The same pattern is in the family update (the family row read, then its tag used). A null check or the same in-statement test turns these into the proper "out of date" answer. This is optional but cheap.
- The retry check (same client key and family) comes before the tag check, which is fine: a retry that landed is answered as before.

OVER-SCOPE
- Nothing is more than needed. The only extras suggested above are small and belong to the fixes themselves: capture the id at tap (1), unfreeze before login (2), capture tags when the form opens (3) and the empty-row handling (5).

QUESTIONS FOR THE COLLEAGUE
- Is the payer's tag on edits in scope for problem 3? If yes, the server needs one small addition.
- Should loadTrip use the route counter (as refresh does) rather than only the trip id? Recommended yes.
