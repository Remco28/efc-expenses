DESIGN: "Every write names its record by an ID the phone makes, says what it was based on, and is kept on the phone until the server's reply is understood."

I read only: review/code/README.md (Rounds 8 and 9), the pass-3 critic reports in review/code/round9/, and the migration files 0001, 0006 and 0009 to 0011. I did not read src/index.ts or public/app.js myself, so the code details below come from the critics' line references. Nothing was run or changed.

**The core idea.** Stop treating a save as "add a new thing, and remember a key so a retry doesn't duplicate it". Treat it as "put this record, with this ID, based on this version". Creating and correcting become the same operation. A retry of an unconfirmed create is just the same put again. The server answers every put with the stored record. The phone never decides success from its own memory of what it sent.

**The pieces.**

1. **Phone-made IDs for every record.** Trips, families, people, coaches, expenses and deletions all get a random ID on the phone when the parent starts the form. An ID is never reused, so the SQLite id-reuse bugs (round 9 critic items 7 and 8) cannot happen. The integer row ids stay internal.

2. **One outbox on the phone.** Each save is written to local storage before it is sent: ID, the version it was based on, the full content, and a status. Pending saves keep the same ID until the server answers. Editing a pending save overwrites that one entry, so there is never more than one entry per record. This replaces the per-kind slots, the 10-minute expiry, the sessionStorage draft and the separate pending-expense record. Local storage is the right place, because sessionStorage dies with the tab.

3. **Versions and a last-writer mark on each record.** Each record has a version, plus the device that made its last write and the version that write was based on. One rule covers every kind of retry:
   - A write is accepted if its base version is still current.
   - It is also accepted if the same device made the last write, from the same base. This is the case where a lost reply is followed by a typo fix. The phone takes back its own unconfirmed write.
   - Otherwise it is a conflict. The server returns the current copy, and the phone shows both versions and asks which to keep.
   - Sending content identical to what is stored is a no-op that returns the stored record.
   This replaces client_sig, the "untouched since" heuristics and the per-path keys.

4. **Trip terms have their own version.** Dates, families, days, fencing days and status are the "terms" of a trip. Any expense save or finalize carries the terms version the phone was looking at. If the terms moved, the server refuses, and the phone shows what changed and asks the parent to save again. This one mechanism covers the stale-form cases in rounds 8 and 9 (dates, families, days, finalize). Ordinary text edits to a person or an expense do not carry the terms version, so an unrelated add by another parent does not knock out every queued save.

5. **Deletes are writes too.** A delete is a put with a deleted marker and a version. It leaves a tombstone, so it also works when it arrives before the create it is deleting. A late create for a deleted ID is refused with "deleted", not re-added. A purged trip keeps one tombstone for its own ID, and every child write under a dead trip is refused. That is one row per trip, not a tombstone table for every kind.

6. **Advisory near-duplicate check, never a block.** When a new record is entered, the phone compares it against the trip's list plus its own outbox (same payee or description, similar amount or date). If something matches, it asks "same as Dinner $45, pending on your phone?". "Same" discards the new one locally if it was never sent, or sends a delete for it if it was. Two parents entering the same bill from two phones get two records, and both show a "possible duplicate" flag until someone removes one.

7. **Answers the phone trusts.** A reply counts as an answer only if it is the app's own JSON envelope (a stored record, or a named refusal such as conflict, deleted or terms-changed). Anything else is "not known yet": a 5xx, a 429, a gateway page, a captive-portal page, a cut-off body, or a timeout that covers the body read. Unknown keeps the outbox entry and resends later with the same ID and base.

**A save on a good signal.** The parent taps Save. The entry goes into the outbox as "sending". The put goes out. The reply is the stored record plus a "same as sent" flag. The phone removes the outbox entry and shows the stored record, not the typed one. If "same" is false, the screen says what differs, and it stays on screen until the parent looks at it. Nothing is a toast.

**A save on a bad signal.** The same steps, except the reply never arrives or is not an answer. After about 20 seconds the screen says "Not confirmed yet. Kept on your phone; will send again." The parent can leave the screen. The outbox resends the same ID and base the next time the app is open (on iPhone home-screen web apps, nothing runs in the background, so assume that). Then:
- Stored equals sent: "Saved", entry removed.
- Same device, same base: accepted, which covers the typo-after-lost-reply case.
- Someone else changed it: a conflict card with both versions. This is visible and is never silent.
- Deleted: "This was deleted on ... and won't come back". The entry is removed, and re-adding means a new record.
- Terms changed: the new terms are shown and the parent confirms before resending.
- Re-entering from scratch: a new ID, so it cannot collide with the lost one. The near-duplicate check catches it, because pending entries count.
- Reload, app killed, phone switched: the outbox is on disk, so the next open resends. No special reload-detect logic is needed, because "resend" already answers "did it land?".

**What it costs the parents.**
- Unconfirmed items sit in a visible "Not confirmed yet" list until the app is open with a signal. Some people will see this as clutter. It is the honest state.
- Clearing site data or switching to a new phone loses unsent items. Say so in the app's help text.
- Some corrections take one extra tap: a conflict card when someone else changed the same thing, or "save again" after the terms changed.
- Entering something similar to an existing item prompts once.
- A parent can take back their own unconfirmed write, but not a write from a second phone of the same parent. That is a different device, so it is a conflict.

**What it deliberately doesn't handle.**
- Merging two people's simultaneous edits to the same field. It refuses and shows both. No automatic merge.
- Background sync or push while the app is closed.
- Accounts or logins. "Who" stays a typed name plus a random per-browser device token.
- Making two parents' identical entries into one. Duplicates are flagged and removed by hand.
- Full offline editing of a trip. Only queued writes are offline. The trip is read from the last seen copy.
- Receipt photos get their own ID and are attached by reference. Orphaned uploads are cleaned up on a schedule, and a receipt that does not exist is refused cleanly.
- Old open tabs. The envelope is new, so an old client that gets a reply it does not recognise keeps its entry, and a reload fixes it.

**What I would leave out to keep it simple.** Per-kind keys and slots, the 10-minute expiry, sessionStorage, client_sig, the reconcile-on-open scans per kind, the server-side "matches" comparison done per path (replace it with the stored record and one "same" flag), and the separate pending-expense store. Keep one outbox, one put rule, one terms version, and one tombstone per trip.

**Honest costs of the change.** The migration is moderate: add a phone ID to each record, add version, last-writer and last-base columns, and drop the client_key and client_sig columns. Existing rows get generated IDs. The README says the app has no real use until early November, so this is the cheapest time to make the change. The first test to write is the one the reviewers keep asking for: commit a write, drop the reply, resend. Then cover concurrent same-ID, delete-then-late-create, purge-then-retry, and a conflict from a second device.

**Decisions for Frank to confirm.** (a) Refuse and show both, rather than merge, when two people edit the same field. (b) Keep tombstones forever, one per purged trip. (c) Advisory duplicate prompts, not blocking. (d) Honest "Not confirmed yet" state rather than hiding unsent items. Each has a recommended default; none is settled.
