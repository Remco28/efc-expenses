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

### Peer passes 2 and 3, and an open design question

Following the loop (improve the plan, then hand it to a fresh group), the fix as built went to a fresh group, and the improved plan after that to another.

- **Pass 2** (two critics, two blind solvers; round9/peer-pass2-*.md) broke the author's own added details. The retry key belonged to the screen, not the attempt, and the server "corrected" entries itself, so a lost "Ava" followed by adding "Ben" would silently rename Ava to Ben, and a family add followed by a coach add would leave a broken half-coach row. Keys were also dropped on half-received replies and gateway error pages.
- **Pass 3** (two critics; round9/peer-pass3-*.md) agreed on the direction (keys made by the phone; a server that only returns what a key already made; a phone that remembers an unsure add until a real answer), but the fix had grown across the server, the phone's storage and every kind of add: a positive test for a real answer, remembering before sending, checking an older unsure add before a new one, a server-computed "same or not", a deleted-key registry, and conflict-safe inserts everywhere.

**Stopped as structural, by the loop's stop rule:** after three fresh passes the fix still wouldn't settle small, so it is not a fix. **Open design question for the human: how should the app save reliably on a bad connection?** The pass-3 reports are the starting material. Until it's decided, the live code has the round-9 follow-up as built, with pass 2's known flaw (a lost add followed by a different add of the same kind within 10 minutes can overwrite the first). There is no real use of the app until roughly early November 2026.

### Saving on a bad connection: designed with Frank, then built

The open question above went through a design loop: Frank chose the small direction (hold new expenses on the phone until there's a signal; everything else needs a signal; no duplicate detection), and each version went to a fresh pair of critics (Sonnet, Haiku), three passes in all (review/design/saving-design-v2 to v4, with each pair's reports). Unlike the duplicate fix, it got smaller each pass: in pass 2 both critics independently proposed cutting edits to waiting expenses and holding only automatic shares, and Frank agreed. Pass 3 found only build details. Frank also cut a reminder on the finalize screen as a burden on users for a case that needs nobody, the uploader included, to notice.

**Built (design v4):**
- A resent key only ever answers "already added" (with, for an expense, whether this copy matches); nothing is corrected through a key. This removes the client_sig corrections and the per-path add key, and so last night's flaw (a lost "Ava" followed by "Ben" renaming Ava).
- Add keys belong to what was typed (path and content) and are kept on the phone (localStorage) until the app really answers.
- Only the app's own JSON counts as an answer, for every request: a wifi sign-in page, a 5xx, a 429 or an unknown route (now marked `route: "unknown"`) means "don't know".
- A new expense with automatic shares saved without an answer waits on the phone ("Waiting to send", one storage entry each), is sent by itself (on opening, on coming back to the screen, every 30 seconds) under the name it was entered with, and can be removed, not edited. A refusal shows on the item with its reason. Hand-set shares need a signal. The expense's key is checked before the trip is checked as open, and the payer's family tag is checked against reused ids. The old single pending slot is folded in.
- With no signal, a trip's main screen shows the trip as last loaded instead of an error, so waiting items can be seen.

Checks: every API script (round10.mjs is new; round9b.mjs, which tested the removed corrections, is gone; round9.mjs now expects "already added") and browser checks with the signal cut: held then sent on reopening (once, under the right name); reply lost with the signal staying cut, waiting card shown, sent once when it came back; a wifi sign-in page not taken as saved; Remove; hand-set shares refused offline and, after a lost reply, a corrected resave told the first version stands (one expense); a waiting expense refused after finalizing shows "Couldn't send" and the trip list count; Ava's lost add then Ben: Ava, Ben, one each, and a retried Cara made once.

**Believed, and wrong:** "Holding the expense is the whole fix" — after holding, the app went to the trip screen, which couldn't load without a signal, so the waiting expense couldn't be seen. Found in the browser check, not by any critic. Also found there: Remove redrew by reloading (which needs a signal), and an older bug, the Add person button stayed disabled after a lost reply whose reload also failed.

## Round 10 (round 3 of the new method)

Reviewed 6cc7e4d: the round-9 follow-up and the new saving on a bad connection. Cast as round 9: two whole-code reviewers (Sonnet, Haiku), a fix auditor on 4719bbd..6cc7e4d (Sonnet), a bad-signal reviewer (Haiku). Reports in round10/. No reader rated anything HIGH.

| # | Finding | Found by (their rating) | Ours | Done |
|---|---|---|---|---|
| 1 | A family day taken off and put back loses a fencer's picked fencing ticks for that day; per-fencer-day costs shift silently | whole-code Sonnet (MEDIUM, ran it) | **HIGH**: a realistic tap (a mistake, then undone), a wrong share, nobody told | Fixed: rest days (below), after two peer passes |
| 2 | Round 9's "every-day fencer fences an added day" was applied to family days only, not to a person's own days or a switch back to the family's | fix auditor (MEDIUM, ran it) | MEDIUM: same mechanism as 1, on a path few people use (own days) | Fixed by the same change |
| 3 | A family added without its days set counts for every day, including days before it arrived | whole-code Haiku (MEDIUM, ran it) | MEDIUM | Not fixed: "every day" is the default on purpose, the next screen is the day picker, and "from today" would be wrong for the treasurer entering families afterwards. For Frank to weigh |
| 4 | A hand-set expense that got no answer is lost if the parent leaves the form | bad-signal (MEDIUM) | MEDIUM | Fixed: kept, and shown under "Waiting to send" as "Not saved: it needs a signal. Tap to finish it" |
| 5 | A refused waiting expense can't be opened to copy, though design v4 says it can | bad-signal (MEDIUM) | MEDIUM | Fixed: "Open it to fix" puts it in the form as a new expense; saving it clears the refused one |
| 6 | Retrying an edit after a lost reply blames "someone" else | bad-signal (LOW, ran it) | LOW | Reworded: "on another phone or by an earlier save of yours" |
| 7 | Deleting with an expired login shows an empty message instead of the login screen | fix auditor (LOW) | LOW | Fixed |
| 8 | A receipt the AI can't read now says "the connection dropped" | fix auditor (LOW) | LOW | Fixed: "Couldn't read the receipt just now. Fill in the form by hand." |
| 9 | After an unsure add that did land, adding another identical "Alex" in the same family is answered "already added" | fix auditor (LOW) | LOW | Not fixed: that is the duplicate guard working; two identical names in one family, right after an unsure add, is rarer than the duplicate it prevents |
| 10 | A draft stays kept after leaving the form for a family or day screen | fix auditor (LOW) | LOW | Fixed: every way out of the form drops it, except an unsent hand-set expense (row 4) |
| 11 | Finalize reads "what this screen saw" after the confirm sheet, so a waiting expense sent meanwhile on the same phone isn't caught | fix auditor (LOW) | LOW | Fixed: read before the sheet opens |
| 12 | Finalize's activity check can miss a change in the milliseconds between its write and its log line | whole-code Sonnet (LOW, reasoned) | LOW | Not fixed: a window of milliseconds; the fingerprint still covers money changed before the batch; reopenable |

### Peers before fixing row 1

The fix changes what is stored, so it went through the trial step (round10/fencing-problem.md, peer-*.md). Pass 1: two critics on the author's plan (stop trimming fencing days; show only the overlap; keep the every-day rule everywhere), two blind solvers. All four agreed on the core; both blind solvers proposed it independently. All four found the weak spot: the every-day rule guesses intent from the lists, so a deliberate rest day, after its day goes off and on, looks like "fences every day" and gets ticked. Plan v2 removed the guess: **a person stores the days they rest, not the days they fence**; fencing days are their days less their rest days, worked out in one place (loadTrip, which finalize uses too). Pass 2 (two fresh critics): holds, with details: the person update's guard must check rest days (it does), a full fencing list replaces rest days only within their days, the fingerprint counts only rest days within their days, lists stored sorted.

Built: migration 0012 (rest_days, filled from today's lists; checked on old-style rows: a picked-days fencer, a non-fencer, a fencer with no days, a non-fencer with remembered picks). Family-day, own-day and trip-date changes no longer touch fencing at all; the every-day rule is gone. Behaviour change, stated: a fencer who rests some days, given a day they were never there for, fences it (as a new fencer does). A fencer with no fencing days at all is the extreme of that: a day added is fenced. Rest days outside the trip are kept, so a day rested before a shorten comes back rested if the trip is lengthened again.

Checks: every API script (round10.mjs gained the fencing cases; round9.mjs's picked-days expectation updated to the stated change; round3's "a parent fences no days" caught non-fencers showing fencing days during the build, fixed), and browser checks for rows 4 and 5.

### Predictions, against what happened

- **HIGH 1: right in number, wrong in place.** I expected it in the new waiting list; it was in fencing days, code from round 9.
- **MEDIUM 3 to 6: right** (4: rows 2 to 5), and mostly in the new code, as predicted (rows 4, 5).
- **The fix auditor finds one thing the saving change broke: right**, of the kind guessed ("an error message changed meaning"): row 8, and row 7.
- **Whole-code overlap at most one: right**, none.
- **A reader re-reports something chosen on purpose: wrong.** None did. Naming the design's limits in the brief may have helped.
- The disposition auditor: below.

**Believed, and wrong:** that the build matched design v4. I dropped "open a refused item to copy it" during the build (a pass-3 critic suggested it) without changing the design, and a reviewer held the code to the design. And round 9's "a fencer who fences every day gets an added day": true for one path out of three.

### Mistakes the next author will make

1. A rule applied on the path where the bug was found, and not on the other paths that change the same data (row 2; also round 9's row 9).
2. Cutting something from a design while building, without changing the design.
3. Storing a list trimmed to another list, so an undo can't get back what the trim threw away (row 1).

### The disposition audit of round 10, and our response

Report: round10/disposition-auditor-sonnet.md. Its main point holds: **the "finalize locks numbers the treasurer hadn't seen" class was rated LOW twice (rows 11, 12), one round after we rated the same class HIGH (round 9 row 7)**, and row 12's reason was false. Finalize's fingerprint was compared with itself on the server, never with what the screen showed, so a change committed but not yet logged was locked unseen.

| Row | Was | Now | Why |
|---|---|---|---|
| 2 (own-day fencing) | MEDIUM | HIGH | The same silent wrong share as row 1; "a path few people use" was asserted, not shown |
| 9 (identical add answered "already") | LOW | MEDIUM | The screen said "Alex added" over an add that was discarded, the class of round 9 row 1; visible in the list, so not HIGH |
| 11 (finalize reads the screen after the sheet) | LOW | MEDIUM | The class of round 9 row 7, on a realistic trigger (the treasurer's own waiting expense); already fixed |
| 12 (finalize misses an unlogged change) | LOW | MEDIUM | "Wrong only in a rare timing" is the scale's MEDIUM, and the reason given was false |

Fixed after the audit: the trip screen now carries the fingerprint of the numbers it shows, and finalize refuses unless the trip's numbers still match it (round10.mjs: an expense added after the screen loaded is refused even with the newest activity), which closes rows 11 and 12 by the numbers themselves rather than by the activity log; adding a person whose earlier try went through now says "was already added (an earlier try went through)".

Row 3 stays open for Frank, now with the option the audit named: when a family is added to a trip that already has expenses, ask for its days before it counts.

Also accepted: most rows copied the reviewer's rating; and the table doesn't say how each finding was checked before fixing. Rows 1 and 2 were reproduced by their readers and by round10.mjs; rows 4, 5 by the browser checks (after the fix); rows 7, 8, 10, 11 were read in the code and not reproduced before fixing.

**So round 10 had two HIGH findings (rows 1, 2), and a round 11 follows.**

## The split rebuilt on the club's real rules (before round 11)

Ten rounds reviewed code built on a wrong assumption: that families on a trip eat together, so a meal is split among everyone there that day, and so every family needs "days at the trip". Frank, asked in plain words how the club actually pays: team dinners are occasional, often several separate groups, and opt-in; attendance days aren't needed; fencing days are essential. No review round could have found this: every reader checked the code against our idea of the app, not the club's. It took a few minutes of plain questions to the person who knows.

The rules (review/design/billing-model.md) went through two critic pairs (on the rules, then on the build plan) before building. Built: three splits (who took part, with a head count per ticked family; equal per fencer; by fencing days), each kind of expense fixing its split (only Other chooses); no attendance days; a trip-wide Fencing days screen; every new expense, ticked meals included, can wait on the phone (ticked families named by their tags); old test scripts updated through the test helper (stamp.mjs translates old-shape expenses), checks of retired rules (family days, own days, rest days) removed, and checks of the new rules added (round10.mjs). The live trips were test data and are cleared (scripts/clear-trips.sql). Migrations 0012's rest_days and the old days columns are no longer read.

## Round 11 (round 4 of the new method): the rebuilt split

Reviewed 60fcc7d (the rebuild, plus Frank's Volunteer fix found while testing: the next-step button linked to the tab already open, so it did nothing). Cast: two whole-code reviewers (Sonnet, Haiku), a fix auditor on 6cc7e4d..60fcc7d (Sonnet), a bad-signal reviewer (Haiku), and new this round a rules reviewer (Sonnet) holding the app to billing-model.md. Reports in round11/. No reader rated anything HIGH; two ran 20,000 random trips through the money math with no failures.

| # | Finding | Found by (their rating) | Ours | Done |
|---|---|---|---|---|
| 1 | A new fencer starts with every day ticked, so a kid who fenced one day is charged the coach's hotel and meals for all of them unless someone fixes it, and the "no fencing days" warning never fires | rules (MEDIUM, ran it); whole-code Sonnet noted it as deliberate | **HIGH**: realistic (parents forget), a wrong share, nobody told. My own default, chosen without asking | Asked Frank: a new fencer starts with no days ticked, and the warning catches a forgotten one. Ticking Fencer again no longer fills every day either |
| 2 | This phone's "your family" is kept by number only; after a family is deleted and a new one takes its number, the phone shows the new family as yours (and as payer, treasurer) | whole-code Haiku (MEDIUM, ran the reuse) | MEDIUM | Fixed: kept with the family's tag; a different family on the same number makes the phone ask again (browser check) |
| 3 | A refused expense from before the rebuild, or a draft kept across it, breaks the form when opened | fix auditor (MEDIUM) | MEDIUM | Fixed: old kinds open as Other, old splits as who took part (browser check) |
| 4 | "Open it to fix" can tick a family that took a removed family's number | fix auditor (LOW) | LOW | Fixed: only families whose tag still matches stay ticked, and the payer likewise |
| 5 | Toggling Fencer off and on gives a no-days fencer every day | fix auditor, whole-code Sonnet (LOW, ran it) | LOW | Gone with row 1 |
| 6 | The hint under the expense list still lists transport and supplies; no icon for the coach's own meals | rules, fix auditor (LOW) | LOW | Fixed |
| 7 | A retried finalize that went through says "finalized" as an error and leaves the Finalize button showing | bad-signal (LOW, ran it) | LOW | Fixed: the screen catches up after a refused finalize |
| 8 | A retried trip-details save that went through says another phone changed it | bad-signal (LOW, ran it) | LOW | Not fixed: visible, a reload shows the saved dates; the stale-screen guard can't tell its own earlier save from another phone's without more state |
| 9 | A family removed in the milliseconds while a meal ticking it is saved leaves a dead id in the split | whole-code Sonnet (LOW, reasoned) | LOW | Not fixed: needs two phones within ms on a family that never paid; if it was the only family ticked, finalize blocks it visibly |
| 10 | Dead code (the unsent-draft row), stale comments (0012, the family POST, README) | fix auditor, whole-code Haiku, rules (LOW) | LOW | Removed and corrected. Removing the dead row left one stray reference that broke the trip page; caught by the browser check before release |
| 11 | Hand-set shares are held offline, against saving-design v4 | bad-signal (LOW) | not a finding | Superseded by Frank's billing decision (every new expense can wait); the design note stands as history |

### Predictions, against what happened

- **HIGH 1 or 2: right in number (1, by our rating; readers 0), wrong in place.** I guessed a screen left on attendance days or a server/screen mismatch; it was a default I picked myself.
- **MEDIUM 4 to 8: wrong**, 2 (rows 2, 3).
- **The rules reviewer finds a disagreement in wording, not money: half right.** It found both: wording (row 6) and money (row 1).
- **The fix auditor finds something the test-helper translation hid: wrong.** It noted the helper means old scripts only check translated expenses, but found nothing hidden.
- **Whole-code overlap at most one: right**, one (row 5).

**Believed, and wrong:** that the new-fencer default was a build detail. Two build-plan critics flagged it as a decision; I chose "every day" and wrote it in a comment instead of asking. Frank chose the other way in one line.

### Mistakes the next author will make

1. Deciding a default that moves money without asking the owner, because it looks like a detail.
2. Removing dead code by hand and leaving one reference behind; only a run of the page finds it.

### The disposition audit of round 11, and our response

Report: round11/disposition-auditor-sonnet.md. Accepted: the round-10 rulings were applied to the new finding (row 1) and not to the old classes when they came back.

| Row | Was | Now | Why |
|---|---|---|---|
| 5 (Fencer off and on gives a no-days fencer every day) | LOW | HIGH | The same rule as row 1 on its second path, a silent wrong share; "gone with row 1" said why it was fixed, not how much it mattered. Round 10's mistake 1 again |
| 4 ("Open it to fix" ticks a family on a reused number) | LOW | MEDIUM | Same cause as row 2, and it can charge a family that didn't go; it was fixed by comparing the tags the waiting expense was saved with, not the trip's current ones |
| 9 (a family removed while a meal ticking it is saved) | LOW | MEDIUM | "Wrong only in a rare timing" is the scale's MEDIUM (our own round-10 ruling); the share is absorbed silently unless it was the only family ticked |
| 8 (a retried trip-details save blames another phone) | LOW, not fixed | LOW, fixed | The reason given was false: the server can see the dates are already the trip's. Same class as round 10 row 6 |
| new: the trip screen read its numbers and their fingerprint in two separate reads | (not rated by two readers) | MEDIUM | "Finalize locks numbers the treasurer hadn't seen", the class rated HIGH in round 9; round 10's fix was not complete |
| 11 (waiting expenses show only description and amount) | not a finding | LOW, fixed | Head counts are hand-set; the card now shows who's ticked ("Adams 2, Baker 1") |
| 1 | HIGH | HIGH | Kept, but on the scale's terms (realistic, a wrong share, nobody told), not "my own default" |

Fixed after the audit: the fingerprint is read in the same database batch as the numbers it describes; an expense write refuses, in the same statement, a split naming a family no longer on the trip; a trip-details save whose dates are already the trip's is accepted; the waiting card shows a meal's head counts (round10.mjs and a browser check).

Not given rows, and why: "1.250" read as $1.25 (US parents write 1,250; LOW, left); a waiting expense refused after finalize shows only on its payer's phone (accepted in saving design v4 and by Frank); five scripts crashed in the fix auditor's copy because its fresh database had no practice trip (the scripts expect trip 50 to be the practice trip, as in our test database; noted in briefs/README.md).

**So round 11 had two HIGH findings (rows 1 and 5), and a round 12 follows.**

## Outside review, 2026-10-24 (Codex, fresh, after the rebuild)

Frank brought in an outside reviewer (Codex) with a short brief, on d4b7f66. Report: outside-2026-10-24/codex-report.md. Six findings, every one reproduced (three in a browser, three by pausing the server between its read and its write). Its ratings agree with ours on all six.

| # | Finding | Their rating | Ours | How checked | Done |
|---|---|---|---|---|---|
| R2-01 | A fencing-day refresh that finishes after you've moved to another trip replaces the trip the new screen acts on: volunteering as treasurer on trip B saved it on trip A | HIGH | HIGH | Reproduced in Chromium (theirs); after the fix, the same steps put the treasurer on B (ours) | A reload only replaces the loaded trip if the screen is still that trip's |
| R2-02 | A change typed while Save does its first check (reloading the trip) is dropped: the earlier amount is saved and "Expense saved" shown | HIGH | HIGH | Reproduced (theirs); after the fix the form is frozen during the check and typing doesn't reach it (ours) | The form freezes from the start of the save, and unfreezes on every way out |
| R2-03 | An unfinished meal kept across a reload names families by number; a family deleted and replaced on that number is charged | MEDIUM | MEDIUM | Reproduced (theirs and ours) | Each family picked keeps its tag with the draft; on reopening, picks whose family changed are cleared, with a message; tags sent are the ones from when picked |
| R2-04 | A name-only change rewrote Fencer from the value read earlier, undoing another phone's change | MEDIUM | MEDIUM | Reproduced by pausing the handler (theirs); round10.mjs (ours, sequential) | Only fields sent are written |
| R2-05 | The trip row (with the treasurer) was read before the batch the fingerprint is in, so a response could pair one treasurer with another's fingerprint | MEDIUM | MEDIUM | Reproduced by pausing the handler (theirs) | The trip row is read in the same batch |
| R2-06 | Adding a person checked the family's tag, then inserted by number: a family replaced in between got the person | MEDIUM | MEDIUM | Reproduced by pausing the handler (theirs); round10.mjs (ours, sequential) | The insert itself requires the family's tag |

**Believed, and wrong:** that round 11's audit closed the snapshot class ("the fingerprint is read in the same batch as the numbers"). The trip row itself was still read outside it (R2-05). And the save-time freeze (round 9) was believed to protect the whole save; it started after the first check.

All API scripts pass (round10.mjs 36 checks) and the three browser findings were re-run against the fix.

### The peer step, run after the fact (Frank: "we're making the same mistake of immediately fixing")

The six fixes above went straight to code, though the skill says a fix to what is stored or computed goes to peers first. Frank caught it; the code-review profile now says every HIGH or MEDIUM fix goes through the peer step, however small it looks. The six were then put through it as if unbuilt (problems.md, plan.md; peers read the code from before the fixes):

- **Pass 1** (two critics, two blind solvers; peer-*.md): the blind solvers proposed the same six fixes, so the shape held. The critics and solvers together found eight gaps the build had: an expired login during a save left the login screen frozen; the family-tag checks on expenses were a read before the write, not in it (the same gap as R2-06); edits never checked the payer's tag; after a family-changed refusal the form kept its stale picks and was refused again on every save; the treasurer's family had the same reused-number gap; a person added to a family deleted that moment gave a server error; the "you" label checked the family by number only; leaving during the save dropped it silently. Frank agreed to all, and that a save they left should still go.
- **Pass 2** (two fresh critics on plan-v2.md; peer-pass2-*.md): details only, so the plan had settled: unfreeze in the login screen itself rather than at each exit; an error code (`family_changed`) so the phone can tell that refusal from others; compare against the trip the save started on, so leaving doesn't paint one trip's form over another's screen; tags recorded when an edit form opens, so the reopen check works for edits; and one new related gap: removing the treasurer's family changed the money with no warning.

**Built (plan v3):** the login and name screens always unfreeze; a save carries on if the form is left, and says which trip it saved to; expense insert and update require, in the same statement, that every family in the split and the payer still carry the tags the form sent (refused with `family_changed`); edits send and are checked for the payer's tag; a family-changed refusal reloads (only if still on that form) and redraws, clearing picks whose family changed; forms record their families' tags when they open; the treasurer's family is named by the tag the sheet showed and checked in the write; the treasurer's family can't be removed; family and person routes answer "out of date" for a family removed a moment ago; the "you" label checks the tag; finalize compares the fingerprint read with its numbers; family and fencing saves check against the trip they started on.

Checks: every API script (round10.mjs, 43 checks, gained the tag, payer, treasurer and removed-family cases; the test helper now sends the treasurer's family tag as the app does) and browser checks: an expired login during a save shows a usable login screen; a save left mid-check still lands, saying which trip; a family replaced on its number while the form is open is cleared from the form, not charged; volunteering as treasurer with a family still works.

**Believed, and wrong:** that the six were small enough to skip the step. The peers found eight gaps in fixes I had tested and re-run against the reviewer's own steps; testing what I built couldn't find what I hadn't thought to build.

## Round 12, 2026-10-24 (round 5 of the new method)

Reviewed 64a1243 (the outside review's fixes and plan v3). Cast as round 11: whole-code (Sonnet, Haiku), fix auditor on d4b7f66..64a1243 (Sonnet), bad-signal (Haiku), rules (Sonnet). Reports in round12/. No reader rated anything HIGH. The rules reader found the app agreeing with billing-model.md everywhere; the fix auditor ran the new tag, treasurer and person checks against its copy and found each doing what it says.

| # | Finding | Found by (their rating) | Ours | How checked | Done |
|---|---|---|---|---|---|
| 1 | A treasurer fixing their payment details on a final trip, if someone reopens the trip before they tap Save, removes the treasurer and blanks the details ("Saved" shown) | whole-code Sonnet (MEDIUM, ran it) | MEDIUM: rare timing, visible afterwards | Reproduced by the reader against the API | Plan and peers first (below) |
| 2 | An edit refused because someone else changed the expense keeps the old revision, so every Save fails again; going Back throws away what was typed | whole-code Haiku (MEDIUM, ran the refusal) | MEDIUM: the same mechanism as round 10 row 4 (typed work lost after a save that couldn't land) | The refusal reproduced by the reader; the rest read in the code | Plan and peers first (below) |
| 3 | Leaving a half-typed new expense (Back) discards it without asking | whole-code Sonnet (LOW) | LOW: the parent chose to leave, and Back is how the form is cancelled today | Read in the code | Not fixed; question for Frank (below) |
| 4 | The PDF: a family's share of a one- or two-cent expense that rounds to 0 is left off its statement; "Total shared costs" leaves out an expense nobody is splitting (draft only, finalize refuses it); the fencer asterisk note says "fenced" where it means "ticked as Fencer" | rules (LOW) | LOW | Read in the code | To fix with the round's fixes (wording and display only) |
| 5 | The treasurer sheet on a trip whose treasurer family was removed under the old code answers "out of date" until another family is picked; a treasurer save on a trip finalized a moment ago says "out of date" rather than "finalized" | fix auditor (LOW) | LOW: the live data was cleared, so the first can't occur; the second is visible and a reload fixes it | Read in the code | Not fixed |
| 6 | Removing a family doesn't say it comes off every expense it was ticked on; a comment says late families share "from now on" where shares are live | whole-code Haiku (LOW) | LOW | Read in the code | To fix (wording, comment) |
| 7 | Shortening and lengthening a trip doesn't bring fencing days back; a waiting expense refused after finalize is seen only on its payer's phone | rules, whole-code Sonnet, bad-signal (LOW) | not findings | — | Chosen on purpose (warned; saving design v4) |

### The disposition audit of round 12, and our response

Report: round12/disposition-auditor-sonnet.md. Accepted:

| Row | Was | Now | Why |
|---|---|---|---|
| 5b (a treasurer save on a trip finalized a moment ago says "out of date", not "finalized") | LOW, not fixed, "visible, a reload fixes it" | LOW, fixed | A wording regression from the outside-review fixes; "visible" was the banned reason. Fixed with the treasurer change (plan v2, item 1) |
| 5a (the treasurer sheet on a trip whose treasurer family was removed under the old code) | LOW, "can't occur" | LOW, checked | The live database was queried (2026-10-24): one trip has a treasurer family, and it exists. It can't occur now |
| new: a save walked away from, then refused, loses the typed expense to a brief message | not rated | MEDIUM | The same mechanism as round 10 row 4 and round 12 row 2 (typed work lost after a save that couldn't land); raised in the fix auditor's report and dropped from the table |
| new: a treasurer change on a trip finalized just before Save is silently ignored ("Saved") | not rated | MEDIUM | The mirror of row 1 (the server guessing intent from a stale status read), found by the auditor in the code |
| 7 (shortening and lengthening doesn't bring fencing days back; a waiting expense refused after finalize is seen only on its payer's phone) | "not findings" | LOW, not fixed | Rated, not removed: the first is warned at the shortening (from the rules reader and Haiku whole-code, not as credited); the second is saving design v4's accepted limit (Sonnet whole-code, bad-signal) |

Also accepted: the bad-signal reader only read code and didn't cover edits, family adds or receipt cleanup, so "no HIGH" is thinner than the table made it look; reader observations dropped without a row (a family removal bumps an open editor's revision, the part of row 2's mechanism now handled by plan v2) should have been listed.

Not given rows, and why: a refused waiting item is lost if the phone's storage is cleared, and a deleted-then-resent item comes back (both accepted limits of saving design v4).

**So round 12 had no HIGH, four MEDIUM (rows 1, 2 and the two above), and its MEDIUM fixes mean a round 13 follows.**

### Round 12's fixes: two peer passes, then built

The plan (round12/plan.md) went to two critics and two blind solvers before any code (peer-*.md). They broke its edit fix: keeping the parent's whole version on top of the newer one would have silently undone the other person's changes in fields the parent never touched, the same lost update in a new place. They also found the deleted cases arrive differently than assumed, a replaced receipt would trap the form again, and the treasurer fix opened its own holes (notes written over a new treasurer's, the reverse race). Frank chose: each treasurer form only works on the trip state it was drawn for; a refused edit keeps only the parent's own changes; a save walked away from and refused isn't lost; Back still cancels a new expense. Plan v2 went to a fresh pair (peer-pass2-*.md): details only (Step down must keep working, neutral wording since the change may be the parent's own earlier save, kind/split/head counts as one unit, fewer moving parts), so it was built.

Built: the server tells the two treasurer forms apart by what they send and refuses each on the other kind of trip, rechecking the status in the write (`trip_changed`); Step down still works and clears the family; expense refusals carry `expense_changed` or `expense_deleted`; a refused edit (or a kept edit draft that's behind) is rebuilt on the newest version keeping only the groups of fields the parent changed, found by number and creation time; the editor's Delete gets the same; a save walked away from and refused goes to "Couldn't send" (a new expense) or names what didn't save (an edit); the PDF lists a share that rounds to $0.00, says when the total leaves out an expense nobody is splitting, and says the asterisk means "ticked as Fencer"; removing a family says it comes off every expense it was ticked on.

Checks: every API script (round10.mjs, 51 checks, gained the treasurer forms and the expense codes; round3's treasurer check updated to the new rule) and browser checks: an edit made while another phone changed the amount is rebuilt with the parent's description and the other's amount, and saves with both; a new expense whose save was walked away from and then refused (the trip was finalized meanwhile) is kept under "Waiting to send" as "Couldn't send".

Not in this round (LOW): typed text in the trip-details or treasurer sheet is lost when it's refused as out of date (short fields; the screen now reloads by itself).

**Believed, and wrong:** the edit plan, "keep the parent's values, carry the new revision", as a fix for lost work. It would have caused the lost update it was meant to prevent.

### Mistakes the next author will make

1. A "keep my version" fix for a conflict that silently discards the other person's version of the fields you didn't touch.
2. Letting a server guess what a request meant from a status read a moment ago, instead of from what the request says.

## Round 13, 2026-10-24 (round 6 of the new method)

Reviewed f290c1c (round 12's fixes). Cast as round 12. Reports in round13/. No reader rated anything HIGH; the rules reader again found the app agreeing with billing-model.md, and the fix auditor found round 12's changes doing what they say. Four of the five only read the code this round (Haiku whole-code ran the money and refusal paths against its copy), so "no HIGH" rests mostly on reading.

| # | Finding | Found by (their rating) | Ours | How checked | Done |
|---|---|---|---|---|---|
| 1 | An edit walked away from mid-save, then refused, is lost: the code only keeps new expenses, though round 12's plan said an edit keeps its draft | bad-signal (MEDIUM), whole-code Haiku (MEDIUM, ran the refusal) | MEDIUM: the same mechanism as round 10 row 4 and round 12 row 2; and a fix built differently from its plan (round 10's mistake 2) | Two readers, independent; the refusal reproduced | Plan and peers first |
| 2 | A tap on the family or fencing-days screen that fails with no signal stays showing as saved (the redraw needs a signal too); a typed name or pay note likewise | bad-signal (MEDIUM, reasoned) | MEDIUM: visibly wrong once the toast fades, recoverable | Read in the code | Plan and peers first |
| 3 | The coach hotel or own meals can't be saved until some fencer has a fencing day ticked (the form blocks; the server and the rules don't) | rules (LOW), whole-code Sonnet (LOW) | LOW, but a choice for Frank | Two readers | Asked Frank |
| 4 | The settle tab's advice for an expense nobody is splitting says to tick who's sharing, which fits only who-took-part | rules (LOW) | LOW | Read | To fix |
| 5 | The in-app family statement still leaves out a $0.00 share (round 12 fixed only the PDF); the PDF's "leaves out N expenses" note is cut off by the box width; the PDF family table says "N going" | fix auditor, rules (LOW) | LOW: a fix applied in one place and missed in another | Read | To fix |
| 6 | A legacy expense's form takes `base` from the raw row, so its kind/split group always looks changed; a receipt key missing from storage loops with "changed since you opened it" | fix auditor (LOW) | LOW | Read | To fix the first; the second predates this and is rare |
| 7 | The Day picker shows "Whole trip" for an expense dated outside the trip; a queued expense sending refreshes the Families tab under someone typing; the trip list lumps refused items into "not sent yet" | whole-code Haiku, bad-signal (LOW) | LOW | Read | To fix the first and third |
| 8 | The PDF prints characters outside Latin-1 as "?"; "12.345" rounds silently; a hung request holds the family screen's queue up to 25 s; receipts of saves that never complete stay in storage; sheets that fail with no signal lose what was typed (round 3) | whole-code Sonnet, bad-signal (LOW) | LOW | Read | Not fixed: rare or cosmetic |
| 9 | A waiting expense refused after finalize is seen only on its payer's phone | bad-signal (MEDIUM) | LOW, accepted | — | Frank's choice in saving design v4 (no reminder at finalize); "Open it to fix" can't help until the trip is reopened |
