Review of saving-design-v4.md against the current code (read-only; nothing in /home/frank/Dev/efc-expenses was changed or run). Code references are to /home/frank/Dev/efc-expenses/src/index.ts and /home/frank/Dev/efc-expenses/public/app.js.

WHERE THE DESIGN WOULD GIVE A WRONG RESULT OR LOSE WORK

1. The "saved" rule can't be met by most saves. Section 2 says a save counts as saved only when the reply is the app's JSON and carries an id, and applies that to every save: payments, finalize, edits, deletes. The code replies {ok: true} with no id for finalize, deletes, payment ticks and family/people edits (index.ts around lines 413, 422, 459, 467, 471, 487, 506, 517, 529, 612, 627, 697, 703, 756). Applied as written, a finalize or delete that worked would show "still not sure," and a parent would retry a finalize and get a misleading "finalized by someone else." The design needs to say "JSON with ok or id," or the server has to add ids.

2. Waiting automatic expenses are split against the roster at send time, not at entry. Automatic shares are not stored; an empty split means "everyone on automatic," worked out from the current families and days when the trip is read (index.ts around line 561 says a family that joins late shares existing costs). The roster check in saveExpense (app.js around 1143-1150) runs only when the form is saved online. A waiting item skips it. If another phone adds a family or changes days before the phone gets signal, the item lands with a different split from the one the parent saw, and nothing tells them. Either re-check the roster at send and hold the item if it changed, or state plainly that waiting items take the roster at send time.

3. The add keys don't behave as section 5 describes. In app.js (lines 57-69), the key is kept per URL path, not per name, and it expires after 10 minutes. Within 10 minutes, typing "Ben" after a failed "Ava" reuses Ava's key; the server then answers "already added" and Ben is silently not added. The design requires a key per name that lasts until a real answer, so the code has to change both things. Also, the keys live in sessionStorage, which dies with the tab. If a parent's Safari tab is killed or reloaded after a lost reply, retyping "Ava" makes a second Ava. "A slow first Ava can't become a second Ava" holds only while that tab lives. With duplicate detection excluded, the design should say so.

4. The key check doesn't run first today. The expense POST (index.ts around 713-716) calls openTournament before the key lookup, so a finalized trip returns "finalized" before "already added." The design's ordering is a required change, not current behaviour, and it must also come ahead of the deleted-trip 404.

5. The "no such page" exception can't be told apart by status. The fallthrough 404 (index.ts line 809) returns the same JSON shape and status as a real refusal such as "This trip doesn't exist or was deleted." The rule as written needs a marker or a text match. Otherwise a stale phone's item can go to "Couldn't send" when it should wait.

6. The existing pending slot isn't migrated. Section 1 replaces the "efc-pending-expense" slot (app.js around 1102-1111) with the list, but nothing reads the old slot after the update. A parent with an unconfirmed expense on the day of release can lose the held copy.

7. Two tabs of the same site can overwrite each other's queue. If the queue is one localStorage value rewritten whole, a read-then-write across two tabs can drop a newly queued item or bring back a removed one. Store one entry per item, or re-read before every write. Relatedly, a draft restored after a reload could enqueue a second item with the same key; the server dedups it, but the parent sees two rows.

8. Nothing ever stops the retries. "Anything else is don't know, try again" has no ceiling. A deterministic 500, or a 400 caused by a bug, keeps the item in Waiting forever, retried every 30 seconds, with "it may already be on the trip" shown each time. The item needs an attempt count or an age after which the screen says "still not sent."

9. Cost of the owner's no-finalize-reminder choice (not a finding against it). The treasurer's numbers exclude waiting items on phones that haven't come back, and the treasurer has no way to see them. The parent finds out only when they open the app. Worth stating in the design as a known cost.

10. Possibly more than the app needs. The 30-second timer on top of open and visible triggers is what gets items sent with the app left open in a pocket, so keep it. The separate "Couldn't send" list could be a reason shown on the same list. The "Rosa was added after all" branch is still needed because of the 25-second timeouts.

WHAT HOLDS UP

- Key-based dedupe for expenses is real. The insert uses ON CONFLICT DO NOTHING plus a key lookup, so a retry or a double send from two tabs is harmless, and the unique index is in migration 0009.
- A waiting expense can't slip in after finalize. The insert is conditional on the trip being open in the same statement (index.ts OPEN check), so late arrivals are refused cleanly and land in "Couldn't send."
- The family-reuse concern is handled. Automatic items store an empty split, so no reused family id is referenced in a split. The paid_by tag check is sound: a family that paid can't be deleted, and a practice-trip reset recreates families with new tags, so the check refuses stale items.
- A receipt that isn't on the server is refused rather than saved without its photo, and the photo is uploaded before save. The "uploading" guard stops a save while a photo is still going up.
- Logged-out detection is distinct from other failures, so the queue pauses instead of refusing items.
- The 25-second client abort plus the server's keys means a hung request is safe to retry.
- Saves that are not the app's JSON (captive portal pages) are treated as "don't know," which is correct.
- The out-of-scope list is honest about what it leaves out.

