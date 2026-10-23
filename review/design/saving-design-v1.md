# Saving on a bad connection: combined design, v1

Combined from the author's draft and two blind peer designs (Sonnet, Haiku), which arrived independently at the same core. Sources are beside this file.

## The idea
Every record (expense, person, family, coach, trip) gets a permanent name made by the phone when the parent starts it. Saving always means "put this record, as it should now be, based on the version I was looking at". Putting the same thing twice is harmless, so the phone never has to know whether the first try worked: it just tries again.

## The pieces
1. **Permanent names, made by the phone.** A random id per record, created when the form opens and never reused. The server looks records up by it. The old numeric ids stay internal, so their reuse stops mattering.
2. **One outbox on the phone.** Every save (a new record, an edit, a delete) is written to the phone's storage before it's sent, with the record's id, the version it was based on, and its full contents. It stays until the app gets a real answer. Changing something still waiting changes that same entry (a fixed typo replaces the waiting version). It survives reloads and closing the app. Waiting items show greyed out ("1 item waiting to save") and are resent on their own when the app opens or the signal returns, one at a time, in the order they were made, per trip.
3. **One server rule: put this record.** The server looks the id up first, before anything else, then:
   - not there: create it;
   - there, and the version it was based on is still current, or the last change came from this same phone from the same starting point (its own unconfirmed save, now corrected): replace it;
   - identical to what's stored: do nothing, say "saved";
   - otherwise (someone else changed it since): don't overwrite; return what's stored and show both.
   The reply is always the stored record and whether it matches what was sent. Each phone has a random token so the server can tell "this phone's own earlier save" from "someone else's".
4. **Deletes leave a marker.** Deleting marks the record deleted (it isn't erased), so a late or repeated save for it is refused with "this was deleted", never brought back.
5. **The trip's terms have one version.** The dates, the families, who's there which days and fencing, and whether it's final. A save that depends on them (an expense, finalize) carries the terms version it was looking at; if the terms moved, the server says so and the phone shows what changed before saving again. This replaces the separate checks added in rounds 8 and 9.
6. **One honest test of "the server answered".** Only the app's own reply counts, either the stored record or a named refusal (someone else changed it, it was deleted, the trip's terms changed). Anything else (no reply, a reply cut off or stalled halfway, an error page from the network, a wifi login page, the server's own crash message, "too many requests") means "don't know yet": the outbox keeps it and tries again.
7. **Possible duplicates get a badge, never a question.** In the expense list, expenses on the same trip with the same amount and date are marked "possibly the same as Pat's $45 dinner", with one tap to remove either. Computed when the list is shown, so it needs no memory or timing.

## What parents see
On a good signal, nothing new. On a bad one, greyed "waiting to save" items that send themselves later. Occasionally a screen showing both versions when someone else changed the same thing, or what changed in the trip's terms.

## What it doesn't handle, on purpose
Losing the phone's storage (clearing site data, private browsing, a new phone) while something is still waiting: a re-entry makes a duplicate, which the badge flags for expenses. Background sending while the app is closed. Merging two people's edits to the same thing (both are shown). Full offline use of a trip. Receipt photos upload separately; an interrupted one may leave an orphan, which is cleaned up.

## Open for Frank
- Show both versions on a conflict, rather than merging. (Recommended.)
- Badges after saving, rather than a "same as...?" question before. (Recommended; Haiku proposed asking.)
- Show waiting items honestly, rather than hiding them. (Recommended.)
- Keep deleted markers forever. (Recommended; it's a few rows.)
