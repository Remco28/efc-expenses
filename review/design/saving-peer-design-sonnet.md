DESIGN: "the thing has its own name from the moment you start typing"

I read the Round 8 to 9 sections of review/code/README.md and the pass-3 critic reports. I changed nothing and ran nothing. I did not read the current code beyond what those reports quote, so check the details against it.

THE IDEA IN ONE SENTENCE
Every expense, person, family, coach and trip gets its own permanent identity on the phone the moment the parent opens the "add" form. Saving is always "make sure the server's copy of THIS thing looks like THIS". That is safe to repeat any number of times, so the parent never has to answer "did it work?".

Why this is different from the earlier rounds. They used a retry key that belonged to a request, a screen or a 10-minute window, and then added rules to reconcile keys with typos, reloads and different adds. Here the key is the thing's identity, not a side-channel. A corrected retry is just another save of the same thing, so there is nothing to reconcile.

THE PIECES (only four)

1. A permanent id, made by the phone. It is a random unique id, created when the form opens and kept with the form's contents. The server stores it as a unique column on each table. It is looked up by itself, never "id and family". The existing numeric ids stay internal, so reused numbers stop mattering.

2. One "outbox" on the phone, the same for all five kinds. It is a list in local storage. Each entry holds: the id, the kind, the parent it belongs to (trip or family, with that parent's id), what the parent typed, and a state (draft, sending, not confirmed, confirmed, refused). Two rules:
   - The entry is written to storage BEFORE anything is sent. If the phone kills the app mid-send, the record is already there.
   - Editing a not-yet-confirmed entry edits that same entry. Fixing a typo, reloading and reopening the app all land on the same id.

3. One server rule: "save this thing under this id". The server looks the id up first, before any other check. That includes trip-open, validation and stale-family checks, which is what made earlier retries get refused after the first send had landed. Then:
   - Id not found: create it.
   - Id found, and the last person to touch it is the same phone (same author, nobody else has edited it): replace its contents with what was sent. This is how a corrected retry works. It is the only "untouched since" logic, and it is one comparison, not a signature scheme.
   - Id found, but someone else has edited it since: do not overwrite. Return the stored version and show a plain "this was changed by someone else, here is what's there now" screen. The phone does not decide "same or different". It just shows what the server has.
   - The trip is finalized or the family was removed, and the contents differ: refuse, with the stored version shown. If the contents are identical, answer "already saved" rather than an error.
   - The reply is always the full stored row.
   - Deletes are soft (a deleted flag, as trips already are) and use the same id. A delete that arrives before its create writes a deleted placeholder. A late-arriving first request therefore cannot bring a deleted or discarded thing back to life. This also covers people, families and trips, not only expenses.

4. One honest definition of "the server answered". A reply counts only if it is well-formed JSON from the app, in one of two shapes: success with the row, or a 4xx with a reason. Everything else is "unknown": a timeout, a stalled or cut-off body, an HTML error page, a hotel or venue Wi-Fi login page that returns 200, a 5xx, a 429. The timeout covers reading the whole body, not just the headers. Unknown never discards anything. It leaves the entry as "not confirmed". The critics showed that the earlier rounds got this wrong in each of these ways, and that it is where "Expense saved" got shown when nothing had saved.

HOW A SAVE FLOWS

Good signal. The parent taps Save. The entry is written to the outbox, sent, and the server replies with the row. The phone shows the server's stored row (for an expense: "Dinner, $42.10, paid by Pat, split 4 ways") and removes the entry from the outbox. The parent sees nothing extra.

Bad signal.
- The entry stays in the list, shown greyed as "not confirmed yet", and a small strip at the top of the trip says "1 item waiting to save".
- The app resends it by itself whenever it opens, comes back online, or the parent taps the strip.
- The parent never has to guess. Resending is always safe, because if the first send landed, the resend just refreshes the same row.
- If the parent fixes the typo first, the corrected version goes under the same id and replaces the first.
- When a reply finally arrives, the greyed entry becomes a normal one. A refusal (for example, the trip was finalized meanwhile) is shown plainly with what is stored, and the entry stays on the phone until the parent resolves it. It is never silently dropped.
- Reloading or closing and reopening changes nothing: the outbox is still there and still resends.
- "Re-enter it from scratch" mostly stops happening, because the greyed entry is visible in the list and in the trip screen. If they do it anyway, see "Similar things" below.

Order. Entries send one at a time, in the order made, per trip. A new family and the people under it, or a new trip and its first expense, queue behind each other because the phone already knows the ids it assigned. If the first is refused, the ones behind it wait with the reason shown. This avoids the "family add then coach add left a broken half-coach row" kind of hole.

Edits and deletes of existing things use the same machinery. They carry the revision the parent was looking at, are resent the same way, and conflict only when someone else really changed it. A resend of an edit that already landed is recognised as "stored content equals what I sent", not as someone else's change. That removes the wrong "someone changed this expense" message the critics found.

Discarding an unconfirmed entry sends a delete for that id. It does not just forget it, because the first send may have landed. The dialog says so: "If it was saved, it will be removed too."

SIMILAR THINGS (two parents, one bill)
- Never block and never ask before saving. Prompts about same-priced snacks get tapped through, and fuzzy name matching flags Ann/Anna and a father and son both named Michael.
- Instead, after both are saved, the trip list quietly marks expenses with the same trip, amount and date as "possibly the same as Pat's $45 dinner", with one tap to remove either one. It is only a badge. It is computed when the list is read, so it needs no memory and no timing window.
- No badge for people, families or trips. Those lists are short and a duplicate is obvious and one tap to remove. This is a deliberate gap.

WHAT IT COSTS PARENTS
- Usually nothing.
- On bad signal they see greyed "not confirmed" items and a waiting strip. This replaces the current uncertainty.
- Rarely, a conflict or refusal screen they have to read.
- Two parents on one phone share one outbox. The entry shows who made it, and the server's "same author" check makes the second parent's correction look like someone else's edit, which is safe.

WHAT IT DELIBERATELY DOES NOT HANDLE
- Clearing browser data, private browsing, or switching phones while something is unconfirmed. The outbox is gone and a re-entry creates a duplicate. The badge for expenses and the removable lists are the only cover. Say so in the notes.
- Receipt photos. They upload separately, an interrupted one may leave an orphan that expires, and the expense refers to the upload only after it succeeds.
- Genuine two-person simultaneous edits. These get the existing conflict screen.
- Working fully offline with a long backlog. This is "save later when signal comes back", not an offline-first app.
- A phone with no way to make random ids (old Safari). Use a small fallback generator.

WHAT I'D LEAVE OUT
- No time windows or expiry on keys (the 10-minute TTL is what let a later add steal an earlier add's key).
- No fuzzy or "near-duplicate" detection, and no "save anyway?" prompts.
- No "X was added after all" messages. The uniform greyed state replaces them.
- No separate code path per kind. One outbox, one server rule, one reply test.
- No content signatures or "untouched since" columns beyond "last writer".
- No background sync or service worker.
- No server-side "is this the same as that" comparison. The server returns the row and the screen shows it.

HOW THIS ANSWERS THE FAILURES
- Reply lost, retry: same id, the row is refreshed.
- Typo fixed before retrying: same id, the row is replaced.
- Reload or reopen: the outbox persists.
- Re-entered from scratch: the entry is visible beforehand, and expenses get a badge after.
- Correction lost: it can't be, because a retry carries the latest contents under the same id.
- A late first request after a delete: the placeholder blocks it.
- Reused numeric ids: lookups use the uuid.

MIGRATION NOTE
Add a unique id column and a deleted flag to the five tables, and keep the old client-key columns until the new code is live. Migrate first, confirm, then deploy. Test with replies deliberately dropped at each stage (before arriving, after saving but before replying, cut off mid-body, and a login page returning 200).
