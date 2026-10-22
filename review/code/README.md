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
