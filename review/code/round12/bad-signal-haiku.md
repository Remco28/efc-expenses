Review of the copy at /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl12/field (commit 64a1243), through the lens of a parent on a phone with bad signal. I did not start the app or run any scripts. Everything below is reasoned from the code (public/app.js, src/index.ts, migrations, review/design/saving-design-v4.md). Treat it as a code read, not a run.

Verdict: I found no HIGH or MEDIUM problem that causes a wrong result or lost work without notice in the offline and retry paths. Findings:

Checked and holding up:
1. Lost reply on a new expense. The POST is held as a waiting item with the same key, and the key is never regenerated for that item. A resend hits the server's "made" check, which runs before the finalize/open check, so it returns already: true. The client then drops the item. A second copy cannot be inserted: the client_key column has a unique partial index (migration 0009), and the insert uses ON CONFLICT DO NOTHING plus a re-read.
2. A send that returns an unsure answer (timeout, wifi sign-in page, 5xx, 429, route unknown) stays in the queue and is retried every 30 seconds. It is only marked refused on a definite app-JSON 4xx. Refused items are kept, shown on the trip screen as "Couldn't send", and are only removed by the parent. They are never dropped silently.
3. settleWaiting() drops a waiting item only when an expense on the same trip has the exact same client_key. It is scoped by trip id, so a stale S.trip cannot drop a real unsaved item for another trip.
4. The rewait path (refused item reopened as a new draft with a new key) drops the old refused item only after the new one is safely held or saved. Nothing is lost if the new save fails.
5. A 401 during the fresh-trip read or the POST goes to renderLogin(), which clears app.inert. The form therefore cannot stay frozen on the login screen, and the draft stays in sessionStorage.
6. Automatic splits (fencing days, equal per fencer) are computed on the server at send time, the same as on an online save. The form shows no per-family preview, so a held automatic expense cannot show the parent one set of shares and book another. This matches the design (automatic shares are live).
7. Hand-set (took_part) splits are checked at send time by familiesStill(), which compares each family's tag. A family removed or replaced meanwhile is refused, not charged. The payer's tag is checked the same way.
8. Two tabs sending the same waiting item: the second gets already: true and nothing is duplicated. The in-memory `sending` flag stops overlapping sends within one tab.

Residual items (LOW, and already accepted in the design, so not bugs):
- A refused item reaches only the parent who entered it. The treasurer never sees it, and it is lost if that phone's storage is cleared. §4 and "what it doesn't handle" describe this.
- A waiting expense whose receipt upload was cleared (practice-trip reset, or the upload expired) is refused with a visible message. Not silent.
- A waiting item whose earlier send actually landed, then was deleted on another phone, is re-added when resent. This is the documented resend-brings-it-back case.

Not checked (I did not reach these in the time available): the edit path under bad signal (PATCH with rev, the editor draft after an unsure PATCH), receipt garbage collection timing against long waits, and the family/people add paths. I did not run the app to confirm any of the reasoning above.
