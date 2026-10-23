Review of saving-design-v3: where it breaks, what it leaves out, and what holds up

I read the design and the code it changes (src/index.ts, public/app.js, public/split.js). I changed and ran nothing. The direction is sound, and most of the design fits how the server already works. I found two ways a parent can lose work, two places where the design leaves a gap, and some minor items.

**Where it can lose a parent's work or give a wrong result**

1. **A later edit can be wiped by the earlier copy finishing.**
   - The design blocks editing only while an item is "Sending". But the sender can start on the old version while the parent has the edit form open. The parent then saves, and the item goes back in the queue as version 2. When version 1's reply arrives, the app removes the item as sent.
   - If it removes the item by key, version 2 is gone and the correction is lost silently. This can happen in a single tab. It happens more easily with two tabs on Android Chrome, where localStorage is shared and the "Sending" lock is not.
   - The fix is to say that "sent" removes an item only when its version number matches the one that was sent. If it doesn't match, the item stays queued.

2. **A wifi sign-in page can still pass as "saved" for money actions.**
   - The design's rule is "must be the app's own JSON with the expense's id" for expense saves. Today `api()` returns null on any 2xx page that isn't JSON, and the caller then shows "Saved".
   - The design says this "changes for every save", but it doesn't say whether that covers payments, finalizing, deletes and other edits. A captive portal at a venue could therefore show a treasurer "Finalized" or a parent "Payment recorded" that never reached the server.
   - The rule should apply to every write: a successful reply that isn't the app's JSON counts as "don't know".
   - The same applies to the reload in section 7. A reload that returns a portal page or fails must not be read as "not there, didn't save". It should say "still don't know".

3. **The "who's on the trip changed" check (section 4) has no clear place to run.**
   - Today the check runs on the phone: it fetches the fresh trip and compares it to the trip loaded when the form opened. Section 1 now skips that fetch when there is no signal. Items also send for trips that aren't on screen, where the phone has no family list loaded.
   - The item has to carry a snapshot of who was on the trip when the parent made it. Something then has to compare that snapshot at send time.
   - The cheapest route is to send the snapshot with the POST and let the server compare it against the database. That needs no extra trip fetch, and it works for any trip.
   - The design should also say what "set by hand" means. In `unitsFor`, custom-basis expenses treat any unlisted family as 0 shares. Other bases treat unlisted families as automatic. A custom-basis item needs the check, and so does any item with at least one non-null entry in its split.

4. **The sender needs the right name and role.**
   - The name header is built in `api()` from `S.name` plus the staff role, which it looks up in the trip currently loaded (`S.trip`). A queued item for another trip would get the wrong name or lose the "(Coach)" suffix.
   - Store the finished name string with the item at entry time. "Whoever entered it" is the right idea, but the stored value must be the full header.

**Gaps and less serious problems**

- **The server rule for corrections (section 3) isn't fully pinned down.**
  - The check today is `rev = 0`. With numbered corrections the numbers can jump (the parent edits twice, and only version 3 is ever sent). So "rev equals the number" won't work.
  - The server has to track "nothing but this phone's own writes since the last one". That means storing the rev that the phone's last write produced, or a flag set by any other edit.
  - Stating that rule is enough.
  - It also needs a decision for old rows with no number, and for what an online edit does to the number.
- **The wording is wrong for lost-reply items.**
  - "On this phone only, not on the trip yet" is false for an item that landed and whose reply was lost. A parent who reads it may remove and re-enter the expense, which makes a duplicate. That is outside what the owner chose, but the design creates the confusion.
  - "May already be on the trip" would be more accurate until the next successful send settles it.
- **Add person/family/trip is slightly worse than today on one point.**
  - Today a lost reply keeps the same key, so the retry is safe. Under the design, a fresh key per tap plus a reload means a slow first request can land after the reload says "not there". The parent then taps Add again with a new key and creates a duplicate person.
  - The server cannot catch it, and the owner has declined duplicate detection for expenses.
  - The rename flaw the design wants to fix comes from reusing a key with different content, not from reusing it for the same content. A narrower fix would keep the same key for a retry of identical content, have the server compare the content, and use a fresh key when the content differs.
  - The design's choice is acceptable. It just trades one rare problem for another, and the design doesn't say so.
- **"Saved, but changed since"** removes the item from the queue. The parent's correction exists only in the message text, so they have nothing to re-apply. Consider keeping the correction's details in the toast, or in a short-lived "Couldn't send" entry.
- **Orphaned photos.** Removing a waiting item leaves its uploaded photo in storage until the trip is purged. That is fine, but it is a cost the design should name.
- **Typing "sent" toasts** from two tabs will show twice. This is cosmetic.

**More than this app needs**

- **Numbered corrections (section 3), plus editing waiting items, plus the "Sending" lock and the "Saved but changed" outcome, are the heaviest parts.** They cover a narrow case: a parent edits a waiting item twice, and an earlier version had already landed with a lost reply. Today's `rev = 0` rule already handles one correction, and a late stale copy is simply refused with a harmless 409.
- A cheaper version is "waiting items can only be removed, not edited". It deletes section 3 entirely: the server column, the lock, the version compare and one outcome. Its drawback is that a parent who removes an item that actually landed, and re-enters it, creates a duplicate. That is a call for the owner. I would keep editing if this scenario matters, but I would implement the rule as a simple "touched by anyone else" flag rather than counters.
- **The 30-second retry timer, the app-open and came-back-on-screen triggers, and the phone's "online" event all do the same job.** The timer alone covers the case. Keeping the open and focus triggers is reasonable. The online event is unreliable on iPhones and probably adds little.

**What holds up**

- **The existing `client_key` dedupe.** The server already handles a repeated key on expenses: same content returns the same id, and an insert race falls back to a select. That is solid for queued resends.
- **Waiting items stay out of the totals.** Section 1 keeps them out of everyone's balances, so a queued expense can't skew a settlement.
- **The outcome sorting is sound.** Refused versus don't-know versus logged-out fits the server's behaviour. The server has no 429. A 4xx with the app's JSON error is the right dividing line for "Couldn't send".
- **Dropping an item as sent when the trip already shows it at the same version** is a sensible guard. `client_key` is already visible in trip data.
- **Receipts.** Not keeping a photo that failed to upload is the right call. The purge-only cleanup means a waiting expense's photo is never removed under it.
- **Auto shares.** Automatic shares being computed at read time means a late-joining family or a later day tick is counted the same way as for existing expenses. This matches `split.js`. Limiting the block to hand-set shares is correct.
- **Section 7.** Not letting the server change a person, family or trip because a key was resent does close the Ava/Ben rename flaw. The fresh-key-per-tap rule is internally consistent. The one cost is the slow-first-request duplicate noted above.

**Files read**
- /home/frank/Dev/efc-expenses/review/design/saving-design-v3.md
- /home/frank/Dev/efc-expenses/src/index.ts
- /home/frank/Dev/efc-expenses/public/app.js
- /home/frank/Dev/efc-expenses/public/split.js
