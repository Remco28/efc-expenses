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
