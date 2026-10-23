# Code review, 2026-10-22

Four outside reviewers read the repository, read-only, each with a different focus. Every finding was checked against the code before anything was fixed.

| Reviewer | Model | Focus | Findings |
|---|---|---|---|
| Codex | gpt-6.1-sol | server security and data integrity | 8 (codex.md) |
| Grok | grok-4.7 | money correctness | 4 (grok.md) |
| agy | gemini-3.8-flash-high | browser app | 11 (agy.md) |
| opencode | deepseek-v4.1-flash-free (stand-in: Muse Spark unavailable) | open bug hunt | stalled before its report; its working notes independently confirmed 6 findings and added 2 |

All confirmed findings were fixed in one commit, with a regression script run end to end (receipt-key injection, prototype names, share caps, a shared receipt, uploads without a size, late families, shortened trips, deleted trips, finalize, coach/staff flows). Unit tests went from 13 to 17.

Changed design as a result: a family not listed on an expense is now "automatic", the same as null, so adding a family never rewrites expenses (this removes a race Codex found).

## Round 2, 2026-10-22

Same four reviewers, run against the round-1 fixes. Reports are in round2/. Every finding was checked against the code before it was fixed, and overlapping findings were merged into about 20 issues.

| Reviewer | Findings |
|---|---|
| Codex | 4 (two cases where a receipt read or a day change reset a hand-set split, and a finalize race) |
| Grok | 9 |
| agy | 8 |
| opencode (deepseek-v4.1-flash-free) | 8, finished this time |

The main themes, and what changed:

- **Phones racing each other.** A day tap now sends one change ("Sun off") instead of the whole list, so two phones can't undo each other. Finalize is one atomic step guarded by a fingerprint of the expenses and attendance: if anything changed after the numbers were worked out, it is refused. No expense, person or day can be added to a final trip.
- **Practice trip.** Reset and the 30-day purge are now single atomic batches. Two resets at once leave one copy.
- **Input.** Dates must be real calendar dates, trips are capped at 60 days, a coach can't be the treasurer's family, and receipts over 2.5 MB aren't sent to the AI. Migration 0007 clamps any stored days to their trip's dates.
- **Forms.** An existing expense keeps its hand-set split, category and date when a receipt is read or the day changes. The page no longer wipes text you're typing when a save comes back.

Checks: 17 unit tests, a 30-step API script against a fresh local copy (including two finalizes at once and two resets at once), and a browser check of the family screen.

We stopped after this round. The remaining findings are matters of taste, not correctness.

## Round 3, 2026-10-22

Aimed at the round-2 changes, with a shared severity scale (HIGH: wrong money or lost data in realistic use, unnoticed; MEDIUM: rare timing or a visible, recoverable wrong number; LOW: abuse, edge input, annoyance). Reports are in round3/. Grok stalled with no output after 30 minutes and was stopped.

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | New person's Fencer tick lost when a save redraws the screen | agy HIGH, opencode MEDIUM | HIGH (slow venue wifi makes the window real) |
| 2 | Changing an existing expense's category didn't move its split method | agy HIGH | HIGH; our first fix reset hand-set splits, caught in testing and narrowed |
| 3 | Treasurer change racing finalize; treasurer not in the fingerprint | agy HIGH, Codex MEDIUM, opencode HIGH | MEDIUM (needs two people within a second) |
| 4 | Trip dates, family add/remove, trip delete not guarded at write time | Codex MEDIUM, opencode MEDIUM | MEDIUM |
| 5 | Family-day change rewrote a fencing tap made meanwhile | Codex MEDIUM | MEDIUM |
| 6 | Trip-date trim skipped people edited meanwhile | agy MEDIUM, Codex MEDIUM | MEDIUM |
| 7 | New person got the family's old days | Codex MEDIUM | MEDIUM |
| 8 | Removing a family rewrote a split edited meanwhile | Codex MEDIUM | MEDIUM |
| 9 | Payment ids reused after reopen; a stale screen could tick the wrong one | Codex MEDIUM | MEDIUM |
| 10 | Two date changes at once trimmed to different ranges | opencode MEDIUM | MEDIUM |
| 11 | "✓ Saved" after a failed save; a failed add lost the name | agy MEDIUM, opencode MEDIUM | LOW (an error toast already shows, and the screen reloads the truth) |
| 12 | Two practice resets could delete each other's receipt | Codex MEDIUM | LOW (practice trip only) |
| 13 | Stale load could paint an error or the old trip | agy MEDIUM, opencode LOW | LOW |
| 14 | Trips over 60 days couldn't be renamed | opencode LOW | LOW (none exist) |
| 15 | Migration 0007 changed attendance on finalized trips | Codex MEDIUM | No effect: the live database had no finalized trips. Not changed |
| – | Typing cleared the browser's "changed" flag, so edits were dropped | agy HIGH | Rejected: not reproduced in the browser |

All fixed except 15. The fix pattern for 4–10: the database reads current values in the same statement that writes (json_each/json_remove in SQL), and every money-changing write checks the trip is open in that statement.

Checks: 17 unit tests, the round 1–2 API scripts, a new 16-step round-3 script, and browser checks for 1 and 2 with saves slowed down.

Round 3 still found HIGH issues, so a round 4 follows.

## Round 4, 2026-10-23

Focuses rotated (Codex: money, agy: server, opencode: browser, Grok: round-3 diff), each with a 25-minute limit. Only Codex and opencode delivered: agy hit its time limit mid-turn and Grok compacted its context and never wrote a report. Reports are in round4/.

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | Unticking a family or hand-setting a count, then changing the category, silently reset the split | Codex HIGH, opencode MEDIUM | HIGH |
| 2 | Expense ids are reused after the newest is deleted; a stale editor could overwrite or delete the new expense | opencode HIGH | HIGH (reproduced: the next expense got the deleted id) |
| 3 | Family screen captured typed text and the Fencer box before its reload, then restored the older values | opencode MEDIUM | MEDIUM |
| 4 | An action finishing after you navigated away repainted the old trip | opencode MEDIUM | MEDIUM |
| 5 | Family search (over 8 families) didn't hide anything | opencode LOW | MEDIUM (a visible broken feature for a club our size) |
| 6 | A family or day change could keep days the trip no longer has, if the dates changed at the same moment | Codex MEDIUM | MEDIUM |
| 7 | Payment tick checked the payment's identity before writing, not in the write | Codex MEDIUM | LOW (a reopen, an edit and a finalize would all have to land within one request) |
| 8 | Family 1's save could redraw over family 12's screen | opencode LOW | LOW |
| 9 | A failed Add could put its name into another family's form | opencode LOW | LOW |

All fixed. Not fixed, LOW: families and people ids can be reused the same way as expenses, but only a family screen left open on a deleted family could hit it.

From the user's own testing, same release: the club logo was off-centre in its badge, new screens opened at the previous screen's scroll position, the treasurer banner crowded the Expenses list, and Add expense was at the bottom on a laptop.

Checks: 17 unit tests, every API script in briefs/ (round4.mjs is new) and browser checks for 1, 5 and the layout.

Round 4 found 2 HIGH issues, both in code older than round 3, so a round 5 follows.

## Round 5, 2026-10-23

Focuses rotated again; agy and Grok got narrow briefs after timing out in round 4, and both delivered. opencode ran out its 25 minutes without a report. Reports are in round5/.

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | After any split edit, a category change kept the old split method, and the "Usual for this category" tag still marked it (a round-4 regression) | Grok MEDIUM | HIGH (rounded up: the stale tag makes the wrong method look right) |
| 2 | A refresh that finished after a tab change painted the old tab, losing typed input (a round-4 regression) | Grok MEDIUM, Codex MEDIUM | MEDIUM |
| 3 | Removing a person while typing payment details moved focus away, so the shown edit was never saved | Codex MEDIUM | MEDIUM |
| 4 | Typing a field back to its old value during a reload was overwritten | Codex MEDIUM | LOW (the field visibly shows the other value) |
| 5 | Expense created_at checked before the write, not in it | Codex MEDIUM | LOW (a delete and a re-add would have to land inside one request) |

agy checked the money math (shares always add up, balances net to zero, the Settle, Treasurer and You views agree) and found nothing.

Fixes: a category change takes up its usual method unless a method was picked or counts were typed, keeps families left out, and always redraws the tag. refresh() skips if the hash or route changed at all. The family screen keeps focus in the field being typed in and saves restored edits in fields already left. The expense write checks created_at.

Checks: 17 unit tests, every API script in briefs/, and browser checks for 1 and 3 with saves slowed down.

Round 5 found 1 HIGH by our rating, so a round 6 follows, aimed at the round-5 changes.

## Round 6, 2026-10-23

Aimed at the round-5 changes, with narrow briefs for agy, Grok and opencode. All four delivered. Reports are in round6/.

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | The family screen re-saved restored text after every reload: a value the server trims (a trailing space from a phone keyboard) looped saves forever, and a stale value could overwrite another parent's newer edit (a round-5 regression) | Grok MEDIUM, Codex MEDIUM (and LOW for the trailing-space loop) | HIGH |
| 2 | Clearing a count to retype it, on a custom split or for a family not there that day, switched the family off mid-edit | agy MEDIUM | MEDIUM |
| 3 | An expense save finishing after you'd moved on cleared the new draft and navigated away | Codex MEDIUM | MEDIUM |
| 4 | An editor left open from before someone replaced the receipt pointed the expense back at the deleted file, and deleted the new one | opencode MEDIUM | MEDIUM |
| 5 | A refresh was discarded when the phone came back from another app (a round-5 regression) | Grok MEDIUM | LOW (the save stuck, and the comeback reload redraws it; only lost if that reload also fails) |
| 6 | A split key like "01" was stored but never read by the money math | opencode LOW | LOW |
| 7 | The expense created_at check is skipped when a request leaves it out | opencode LOW | LOW, not changed: pages loaded before round 4 must keep saving; the app always sends it |

agy also walked the expense editor through new, automatic, left-out, hand-set and receipt cases and found the saved split matches the screen in each.

Fixes: the family screen now restores only the field being typed in and an unsent new person's name, and never re-sends anything (simpler than rounds 3 to 5). A cleared count waits for the number. An expense save only clears the draft it saved. A changed receipt must exist in storage. refresh() compares the address only. Split keys must be plain numbers.

Checks: 17 unit tests, every API script in briefs/, and browser checks for 1, 2 and the earlier family-screen cases (Fencer tick, typed name, field in progress) with saves slowed down.

Round 6 found 1 HIGH, again in a fix from the round before. A round 7 follows, aimed at the round-6 changes.

## Round 7, 2026-10-23

Aimed at the round-6 changes, same briefs as round 6. All four delivered. Reports are in round7/.

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | Typing a new person's name during a save: the cursor moved to another person's name field, so the next letters renamed that person (a round-6 regression) | Grok MEDIUM | MEDIUM |
| 2 | Editing an expense while its save was still sending: the edit was thrown away when the save landed | Codex MEDIUM | MEDIUM |
| 3 | An older failed save re-enabled Save on the next expense's form, allowing a duplicate | Codex MEDIUM | MEDIUM |
| 4 | An older refresh could paint over a newer reload of the same trip | Grok MEDIUM | LOW (older figures until the next load; nothing saved is affected) |
| 5 | A failed Add put its name back over the next name being typed | Codex MEDIUM | LOW (the name is visible in the box before Add) |
| 6 | Two saves of one expense overlapping inside a single request could point it back at a deleted receipt | opencode MEDIUM | LOW |
| 7 | A new expense didn't check its receipt upload still existed | opencode LOW | LOW |

agy walked the expense editor through every case again and found nothing.

Fixes: the new-person box keeps the cursor during a redraw; the expense form is frozen (inert) while it saves, and only the draft that saved is touched afterwards; refresh() yields to a newer route load (the round-6 LOW about a failed comeback reload is accepted); a failed Add only refills an empty box; the expense write checks the receipt it read; a new expense checks its upload exists.

Checks: 17 unit tests, every API script in briefs/, and browser checks for 1 and 2 with saves slowed down.

**Round 7 found no HIGH, so the reviews stop here.** The round-7 fixes themselves have not been reviewed by an outside reviewer.

## Outside review, 2026-10-23 (generic brief)

After round 7, the user asked Codex, in its own session, for a plain code review: no briefs, no focus. It ran the server against an in-memory database built from every migration, controlled the timing of concurrent requests, and ran the PDF exporter on a generated receipt. All four findings came with a reproduction; one suspicion that didn't reproduce was left out. The report was removed once its findings were fixed.

| ID | Finding | Codex | Ours |
|---|---|---|---|
| EFC-01 | An expense editor left open saved over a newer correction (A sets $80, B's older editor saves $60 back). Not a race: just an editor left open | HIGH | HIGH. Rounds 4 to 7 checked which expense an editor had open, never which version |
| EFC-02 | Switching a person back to the family's days could take an outdated copy of them | MEDIUM | MEDIUM (needs tight timing) |
| EFC-03 | Reused family and person ids let an old screen change someone else, even on another trip (payment details included) | MEDIUM | MEDIUM. Round 4 rated this LOW; that was inconsistent with rating the same mechanism HIGH for expenses, and it missed that ids are shared across trips |
| EFC-04 | A PDF receipt with a blank page stopped the whole record from exporting | MEDIUM | MEDIUM. No round after 2 looked at the PDF code |

Fixes, with migration 0008: expenses carry a revision number that the editor sends back, and the write requires it unchanged (a stale editor is told to reopen, and keeps what it typed). Families and people carry a random tag (set by a trigger on insert); every change sends the tag the screen saw, added in one place, the browser's api() helper. A person switching back to the family's days requires the family's days unchanged. A PDF receipt skips blank pages and is test-embedded in a throwaway document first; if it still fails, the record downloads with a note in its place.

Pages loaded before this release get "this screen is out of date, reload" on their next change.

Checks: 17 unit tests; every API script in briefs/, now through stamp.mjs, which fills in tags and revisions the way the app does; revisions.mjs, new (the $80 correction stands against an older editor; a reused person id, reproduced, is refused); browser checks of the family screen, a stale expense editor and a PDF export; the blank-page receipt in pdf-lib directly.

What this review says about the rounds before it is in the review-loop skill's evidence file (agent-office, "Briefs drift toward the answer").

## Round 8, 2026-10-23: first run of the updated review-loop

**New baseline.** The method changed here (see the review-loop skill), so rounds 1 to 7 are not comparable with round 8 onward. Round 8 is round 1 of the new method.

The skill was updated after the outside review (short briefs, reviewers may run the code, a whole-code reviewer every round). This round followed it. Outside reviewers launched with approval prompts off were blocked by the harness's safety check, so the user chose Claude agents instead, as the loop was first designed: two whole-code reviewers (Sonnet 5.5, Haiku 5.5), a fix auditor on ddd5fc4 (Sonnet), a money specialist (Haiku), and a disposition auditor on our own past ratings (Sonnet). Each code reviewer had its own runnable copy at ddd5fc4, holding only the test access code. Briefs (about 270 words, no function names) and predictions were committed before the run (692465b, PREDICTIONS-R8.md). Reports are in round8/.

Cast note: the predictions were written for Codex, Grok, agy and opencode; the briefs did not change, the models did. Sonnet and Haiku share a lineage, so their agreement counts for less than agreement across vendors.

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | Changing trip dates silently drops attendance. A stale trip-details form puts the old dates back, removing ticks on the newer days; and shortening drops days for good (re-extending doesn't restore them) with only a hint, so every expense is re-priced | Sonnet whole-code MEDIUM (ran it), Haiku whole-code HIGH (ran it) | HIGH: two reviewers on two models, both ran it, and a mistaken date change re-prices everything without anyone noticing |
| 2 | Removing a family didn't bump expense revisions, so an old editor could hand the removed family's share to a new family that took its id | Fix auditor MEDIUM (ran), Haiku whole-code MEDIUM (ran), money LOW | MEDIUM (an old editor, a removal and an addition in sequence) |
| 3 | A save retried after its reply was lost: a new expense was added twice; an edit was refused as "someone changed this" | Haiku whole-code MEDIUM (ran), Sonnet whole-code LOW, fix auditor LOW to MEDIUM (ran) | MEDIUM (visible and recoverable; venue wifi makes it real) |
| 4 | A new-expense form didn't show a family added on another phone meanwhile, and the save charged them | Money MEDIUM (ran the math) | MEDIUM. Checked: only new expenses; an existing expense lists every family |
| 5 | Unticking and re-ticking Fencer replaced the picked fencing days with every day | Haiku whole-code MEDIUM (ran) | MEDIUM (visible on the family screen) |
| 6 | Reopening from a screen that hadn't seen new payment ticks cleared them without the warning | Sonnet whole-code LOW | MEDIUM (lost ticks, rare sequence; by the scale that is MEDIUM, not LOW) |
| 7 | "12,50" was read as $1,250 | Sonnet whole-code LOW | LOW (edge-case input; shares show before saving) |
| 8 | The draft PDF's expense table didn't add up when an expense had nobody sharing | Money LOW, Haiku whole-code LOW | LOW (drafts only) |

Fixed, with migration 0009: the trip form sends the dates it opened with, and the server refuses a change from older ones; shortening asks first, naming who loses days and saying it can't be undone; removing a family bumps the revision of each expense it was in; a new expense carries a key from the phone, so a retry finds it (unique index), and an edit sent twice is accepted if it's identical to what's stored; before saving, the form checks the trip's families and redraws if they changed; a family the expense doesn't list shows as automatic, matching the money math; unticking Fencer keeps the days (only fencers' days count or show); reopen names the number of ticks it saw; "12,50" is twelve fifty; the PDF table totals its own column.

Not fixed, for the human (judgement, not defects): adding a day to a family doesn't make its fencers fence it (money, LOW); Back discards a draft without asking and leaves an uploaded receipt behind (Haiku, LOW); a family added with no days gets the whole trip (Haiku, design). Left as known LOW: the tag is checked just before the write rather than in it (fix auditor); the PDF test-embed doubles the work on large receipts (fix auditor; unmeasured, which is the cost reader's job).

Checks: 17 unit tests; every API script in briefs/ (round8.mjs is new; stamp.mjs now also names the dates a trip form opened with and the ticks a reopen saw); browser checks of the shorten confirmation, a family joining during a new expense, "12,50", and reopen.

### The disposition audit, and our response

The auditor's main finding holds: **we rated findings LOW because they were "visible" or "recoverable", which our own scale defines as MEDIUM**, and the same mechanism was rated differently across rounds (a save landing over typed input: HIGH in round 3, MEDIUM every time after). We accept these re-ratings:

| Row | Was | Now |
|---|---|---|
| R3 #11, R3 #13, R5 #4, R6 #5, R7 #4, R7 #5, R7 #6 | LOW | MEDIUM |
| R7 #1 (letters typed into the wrong person's name), R7 #2 (an edit lost when a save lands) | MEDIUM | HIGH, consistent with R3 #1 |
| R3 #3 (treasurer change racing finalize) | MEDIUM | HIGH, as two of its three reviewers said |
| Round 4's note on family and person id reuse | LOW, unfixed | MEDIUM (fixed since, EFC-03) |

Consequence: rated consistently, **round 7 had two HIGH findings, and the reviews should not have stopped there.** The outside review that followed found a HIGH, which fits.

Not accepted as stated: the rejection of agy's round-3 claim (typing clears the browser's "changed" flag). It was tested, not reasoned: in a real browser, with the family save slowed to 2.5 seconds, text typed during the reload was saved on Done. The first attempt seemed to confirm it, until the cause turned out to be two saves slowed at once in our harness. The README should have said how it was tested; now it does.

### Predictions, against what happened

- Fix auditor: predicted the family-removal revision gap, the tag checked before the write, the PDF double work. **All three came back.** Missed: a retried save after a lost reply.
- HIGH 0 or 1, from a whole-code reviewer: **1, from both whole-code reviewers.** Predicted area (login, AI receipts, practice trip) **wrong**: it was trip dates.
- MEDIUM 3 to 6: **5.**
- "The money specialist finds nothing wrong in the math, only in what a screen shows": **half right.** The math held; finding 4 charged a family the screen didn't show.
- "The whole-code reviewers overlap on at most one finding": **right**, finding 1 (from two directions), and finding 3 partly.
- "The disposition auditor contests one or two ratings": **wrong, badly.** It contested fourteen, and showed the stopping decision rested on them.
- "Running the app means more findings with a reproduction": **right.** Most came with one; the money specialist didn't start the app.

**Believed, and wrong:** "Round 7 found no HIGH, so the reviews stop here." And from round 4: "Not fixed, LOW: families and people ids can be reused the same way as expenses, but only a family screen left open on a deleted family could hit it."

### Mistakes the next author will make

The human will recognise these:
1. Calling a finding LOW because "the user can see it." Visible and recoverable is MEDIUM.
2. Fixing the symptom a reviewer named rather than the mechanism under it: receipt checks in rounds 6 and 7 instead of expense revisions.
3. Ending the reviews on the strength of their own ratings, without running the disposition auditor first.
4. Briefs that get longer and name functions each round.

Round 8 found a HIGH, so a round 9 follows.

## Round 9, 2026-10-23 (round 2 of the new method)

Cast: two whole-code reviewers (Sonnet, Haiku), a fix auditor on 4719bbd (Sonnet), a specialist with the lens "a parent at a tournament, on a phone, with a bad signal" (Haiku), and a disposition auditor on round 8's triage (Sonnet). Same brief template; briefs and predictions committed before the run (39ed53d). Reports are in round9/. Harness note: one reviewer found its port taken by our own leftover test servers and its first call hit another copy; it noticed and re-ran on its own. Leftover servers are now stopped after each run.

**No reviewer rated anything HIGH.** Five readers, four of them running it, independently found the same regression in round 8's own fix (row 1).

| # | Finding | Reviewers (their rating) | Ours |
|---|---|---|---|
| 1 | A new expense saved, its reply lost, then corrected and saved again: the server answered "saved" and kept the old numbers (a round-8 regression; before, it made a visible duplicate) | All five (MEDIUM); fix auditor, both whole-code reviewers and bad-signal ran it | MEDIUM: a lost reply then a correction is a rare sequence, though the result is silent |
| 2 | Adding a person or family again after a lost reply made a duplicate (Ava twice: counted twice) | Bad-signal (MEDIUM, ran), Haiku whole-code (MEDIUM, ran) | MEDIUM |
| 3 | A save that never got a reply froze the form: no time limit, no "Saving…", and "No connection" when it may have saved | Bad-signal (MEDIUM) | MEDIUM |
| 4 | The expense draft lived only in memory: a phone browser reloading behind the camera lost it | Bad-signal (MEDIUM) | MEDIUM |
| 5 | The check before saving caught a family joining, but not people or days changed meanwhile | Haiku whole-code (MEDIUM), bad-signal (LOW) | MEDIUM: the same class as round 8 row 4 |
| 6 | Delete from the editor sent the trip's newest revision, not the editor's, after the round-8 family check redrew the form | Sonnet whole-code (LOW) | MEDIUM: an unseen correction deleted, rare sequence |
| 7 | Finalize locked in numbers the treasurer hadn't seen | Sonnet whole-code (LOW) | MEDIUM: visible afterwards, recoverable by reopening |
| 8 | Family and person tags were checked before the write, not in it | Disposition auditor (MEDIUM), fix auditor in round 8 (LOW) | MEDIUM: rare timing; round 8's LOW was the inconsistency the earlier audit named |
| 9 | Adding a day to a family didn't make its fencers fence it (the mirror of round 8 row 5) | Disposition auditor (MEDIUM), money in round 8 (LOW) | MEDIUM. Fixed by a rule: a fencer who fences every day they're there fences the added day; one with picked days keeps the pick |
| 10 | Amounts "12,5" and "1.250,00" misread | Fix auditor (LOW), Haiku whole-code (LOW, ran) | LOW: edge-case input for this club (the reason is the input, not that it's visible) |
| 11 | A retried delete answered 404 and left the editor open | Bad-signal (LOW, ran), Haiku whole-code (LOW) | LOW |
| 12 | The reopen warning didn't show how many ticks it would clear (round 8's README said it did) | Fix auditor (LOW) | LOW |
| 13 | Text in a family-screen field not yet left was lost when the phone switched apps | Bad-signal (LOW) | LOW |

Fixed, with migration 0010: a retried new expense with different content is applied if nobody has edited it since, refused otherwise; new people, families and trips carry a retry key (added in api(), keyed on the request's content, dropped after a reply); requests give up after 25 s (90 s for uploads), the Save button shows "Saving…", and a lost reply on a change says it may have saved; the expense draft is kept in the tab's session storage and restored with "Picked up where you left off"; the pre-save check compares families, people, days and fencing days; delete uses the editor's revision and treats a 404 retry as done; finalize names the latest change its screen saw; tags are checked inside every family and person write; the fencer rule above; the amount parser reads decimal commas; the reopen warning counts; leaving for another app saves the field being typed in.

Measured, not guessed (round 8 deferred it to a cost reader): the PDF test-embed adds about 1 ms on a 470 KB, 10-page receipt on a laptop (x1.08). LOW stands.

Still for the human: a family added with no days starts on the whole trip (round 8, design); and whether "stop when no HIGH" should rest on the author's own ratings (the disposition auditor's question, a change to the skill).

Checks: 17 unit tests; every API script in briefs/ (round9.mjs is new; stamp.mjs also names the latest change a finalize saw); browser checks of the kept draft across a reload, "Saving…", adding a person, delete, finalize, and the reopen count.

### The disposition audit of round 8, and our response

Accepted:
- Row 1 overstated the evidence. Only the Haiku reviewer reproduced attendance being dropped; the Sonnet reviewer reproduced the dates reverting and reasoned the rest. The HIGH rests on one reproduction plus a reasoned second, not two.
- Rows 7 and C kept the "visible" reasoning the previous audit rejected. Row 7's LOW now rests on edge-case input; C was MEDIUM and is fixed (row 9 above).
- "Known LOW" for the tag check was the same before-the-write pattern rated inconsistently; fixed (row 8).
- Deferring the PDF cost to a reader that didn't run was convenient; measured above.
- Round 8's ratings weren't audited before deciding round 9 was needed. This round's audit is the fix, and round 9's ratings get the same before any decision to stop.

Answered: R6 #7 (created_at optional) is superseded, since every expense change now requires the revision it opened. R3 #15 (migration 0007 on finalized trips) was a one-time migration when no finalized trips existed; a future migration that changes attendance should skip or reopen finalized trips, and that note is here for whoever writes one.

### Predictions, against what happened

- **The bad-signal specialist finds the frozen form: right** (row 3).
- **HIGH 0: right**, by every reader's rating.
- **The fix auditor's suspicion was in the wrong place.** I suspected the identical-edit rule; the regression was in the new-expense retry, which I'd predicted as "landed".
- "Unticking Fencer missed in one place": **wrong**; the fix auditor found every reader of fencing days consistent.
- MEDIUM 2 to 5: **wrong, 9.** The lens produced a cluster around lost replies, which I didn't foresee.
- Whole-code reviewers overlap on at most one: **wrong.** They overlapped on two (rows 1 and 2), and five readers overlapped on row 1.
- Disposition auditor contests 2 to 4 ratings: **about right**, four points, plus one regression it found itself (row 1).

**Believed, and wrong:** "A new expense carries a key from the phone, so a retry finds it" (round 8's fix description). It found it, and then threw away what the retry said.

### Mistakes the next author will make

1. A fix that makes a retry "safe" by ignoring what the retry says. A retry is the same request only if its content is the same.
2. Writing in the record that a fix does more than it does (the reopen count, row 12).
3. Leaving test servers running between rounds, so a reviewer's first test hits the wrong copy.

### The disposition audit of round 9, and our response

The audit's main point holds: **we moved the LOW/MEDIUM line but kept MEDIUM as the ceiling.** Rated against the scale's words and our own earlier precedents, round 9 was not clean. Re-rated:

| Row | Was | Now | Why |
|---|---|---|---|
| 1 (retried new expense drops the correction) | MEDIUM | HIGH | "Expense saved" while discarding the change is the scale's HIGH; the same class as R7 #2 and R3 #1. "Rare sequence" was asserted, not shown, on an app whose stated use is bad signal |
| 7 (finalize locks numbers the treasurer hadn't seen) | MEDIUM | HIGH | The same class as R3 #3, already accepted as HIGH |
| 13 (typing lost when the phone switches apps) | LOW | MEDIUM | The same mechanism as row 4 |

Both HIGH rows were already fixed in this round. Added, having been left out of the table: **a lost reply, then the parent re-enters the expense from scratch, stores it twice** (bad-signal, MEDIUM), and **the add-key fix in row 2 still duplicated when the name was corrected or the page reloaded** (disposition auditor, MEDIUM). Both are fixed below. Accepted too: the headline "no reviewer rated anything HIGH" treated the readers' ratings as the verdict, which is the habit the audits keep naming; and the stop rule resting on our own ratings is a problem with the rule, recorded here as one, and taken to the human.

**So round 9 had two HIGH findings, and a round 10 follows.**

### First trial: peer agents before fixing

The two new duplicate problems were the first to go through a step we're trialling with the human (temporary office memory 104): before any code, the author writes the problem plainly and a plan; two peers (Sonnet, Haiku) try to break the plan, and two others (Sonnet, Haiku), who never see it, propose their own fixes. Nobody writes code. The author decides and records where they went against the peers. Their answers are in round9/peer-*.md.

**The author's plan:** catch near-duplicates on the server (same payer, amount and date; same name in the family or on the trip, in the last few minutes) and ask "this looks like one added N minutes ago, save anyway?"

**What came back:** all four, independently, said the cause was the retry key belonging to the exact request instead of to the act of adding, and proposed the same fix: one key per add, kept through a reload, with a corrected retry fixing the first entry in place. Both critics showed the author's plan failed its own example: "Av" and "Ava" aren't the same name, so it would never fire, and fuzzy matching flags Ann and Anna, or a dad and son both called Michael. Its time window would have been shortest exactly when a parent had been offline longest, and it would have prompted on every pair of same-price snacks until parents tapped through without reading. They credited it with one case nothing else covers: two parents entering the same bill from two phones.

**Decision:** the peers' fix, not the author's plan.
- Adding a person, family or trip uses one key per add, kept for the tab for 10 minutes and dropped once the server answers. A corrected retry fixes the first entry, but only while nobody has touched it since (migration 0011 records how each looked when added), and, for a trip, only before any family is on it. Otherwise the parent is told to look at the list.
- After a lost reply on adding a person, the reloaded screen is checked: "Rosa was added after all", with the name not offered again.
- A new expense sent without a reply is remembered on the phone (local storage). On the trip screen, or on opening Add expense, the app says "Your last expense (Dinner, $45.00) did save", or puts it back in the form with the same key ("may not have saved: check it and save"), which can't add it twice.
- **Went against the peers on:** nothing they agreed on. The Sonnet critic's narrower backstop (save, then flag "possible duplicate of Pat's $45, remove this one?") was not built. It's the only cover for two parents entering the same bill from two phones, so it's left for the human to weigh.

Checks: every API script (round9b.mjs is new: a trip, family and person typo each fixed in place; a retry after someone else's edit refused) and browser checks with replies deliberately lost: "Rosa was added after all" with one Rosa; "Your last expense (Dinner, $45.00) did save" with one Dinner; a save that never reached the server came back in the form and saved once.

Deploy note: migration 0011 failed silently on the first try, and the code was deployed in the same command anyway, so for about a minute the live code expected columns that didn't exist. The activity log shows nobody used the site in that window. The deploy order is now an office convention: migrate, confirm nothing is pending, then deploy.

**Believed, and wrong:** "No reviewer rated anything HIGH" as a finding about the round, rather than about the reviewers' calibration. And the plan for the duplicates, quoted above.
