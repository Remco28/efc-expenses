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
