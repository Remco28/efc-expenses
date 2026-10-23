Review of saving-design-v3.md against src/index.ts, public/app.js and migrations. Read-only: I read files in /home/frank/Dev/efc-expenses and changed, created and ran nothing there.

## Where the design gives a wrong result or loses work

1. **A waiting expense can land on the wrong family.** Family ids are plain numbers, and the families table has no AUTOINCREMENT, so when the newest family is deleted its id can be reused by the next family added (index.ts line 569 already notes ids are reused). The design's waiting expense names its payer and shares by that number, with no tag. If the treasurer removes a family on another phone and adds a new one, the waiting expense sends, the server accepts it, and the money goes to the new family. Section 4 does not cover this.

2. **Shares for a removed family are dropped silently.** The server skips split entries for families not on the trip (index.ts around line 208) instead of refusing. Section 4 says a changed membership should go to "Couldn't send", but nothing on the server checks membership, and that check depends on a snapshot taken when the expense was entered.

3. **Section 4 has no answer for the case it is most needed.** Section 1 says that if the entry-time check gets no answer, the expense is queued without it. Then there is no membership snapshot to compare against later. A custom-split expense entered offline, which is exactly what section 1 creates, has nothing to check. The design needs either a snapshot taken at entry with a send-time comparison that must succeed, or a rule that manual shares cannot be queued offline at all. The second is much simpler.

4. **"A fresh key per tap" brings back duplicates.** Today the app keeps the add key for 10 minutes, until the server answers (public/app.js lines 58-68 and 85). The design drops that. A request still running on the server after the phone gave up at 25 seconds can land after the reload check has said "not there". The parent's retry, with a new key, then adds the person or family a second time. The key should survive retries until the server actually answers.

5. **A late-landed expense shows as "Couldn't send" after finalize.** The server checks that the trip is open (index.ts around line 710) before it looks for an existing copy by key (around line 716). So if the first reply was lost but the expense did land before finalizing, the resend is refused as "finalized". The parent then sees "Tell the treasurer about Dinner" and re-enters it, which is a real double entry in the money. Section 2's rule (drop items already on the trip) runs only when a trip is opened, but sending for every trip starts at app open, before the parent opens that trip. The duplicate check needs to run before the open check, or the reconcile by key must happen before the send.

6. **Two sends at once can lose a correction.** The insert-conflict branch (index.ts around lines 735-737) returns "saved" for an existing key without comparing content or number. Two sends of the same item can overlap: the 30-second timer can fire while a hung 25-second send is still running, and two tabs share one storage. The later, corrected version can then be dropped while reported as saved. The design needs one sender at a time, across tabs too, and that branch needs the number comparison.

7. **The receipt-photo guarantee is false for the practice trip.** Section 5 says cleanup runs only on purge or reset, so it never removes a waiting expense's photo. But the practice-trip reset calls the orphan cleanup on that trip (index.ts line 267), which deletes any photo uploaded more than an hour earlier that no saved expense uses. A waiting expense's photo is exactly that. The send then refuses with "receipt upload expired". The stakes are small (practice trip only), but the claim is wrong as written.

8. **Removing a queued item that may already have landed.** An item in the "don't know" state can be removed. If its earlier request lands later, the expense appears on the trip and counts in the balances after the parent removed it. Removal should say the item may already be on the trip.

9. **Safari and the home-screen app.** The design says each has its own storage. A parent who enters an expense in one, and then looks in the other, sees nothing, may re-enter it, and the item is not sent until the first app is opened. This is not on the owner's "on purpose" list and the design does not address it. At minimum the trip screen should say that expenses entered in another browser may be waiting there.

10. **Items for a vanished trip.** A deleted trip returns 404 and the item goes to "Couldn't send". Deleted trips are not on the trip list, so the item is invisible until the trip is restored or purged after 30 days. The design should say where it shows.

## Smaller points
- Section 3 says the server applies a correction only when "nobody else has edited" the expense, but the current check is simply revision equals zero (index.ts around line 724). The server needs to store the revision produced by the parent's own last save, or it cannot tell its own correction from someone else's.
- An unknown route returns a JSON 404, which section 2 would classify as a refusal. After a deploy that changes routes, old phones' queued items would move to "Couldn't send" instead of waiting. A 404 for an unknown route should count as "don't know".
- Section 2's "the same version the phone has" has no meaning for an item whose reply was lost, because the phone never saw a version. Match by key.

## What holds up
- A key on every new expense, with a unique index (migrations 0009 and 0010), makes the common lost-reply retry safe.
- The refused-versus-don't-know split is sound. Handled errors come back as JSON with a status, 500s and timeouts correctly become "don't know", and 401 is distinct for logged out.
- Requiring the app's own JSON with an id before counting something as saved is needed. Today any 200 counts as saved (public/app.js, the api function), so a Wi-Fi sign-in page would clear a queued item.
- No money moves after finalize. The server refuses late writes to a closed trip, and the finalize fingerprint check stands.
- Waiting items stay out of the totals, and the name is taken from the entry.
- Number-based corrections are the right idea, and they fix the current refusal of a second correction.
- The server never rewrites a person or family on a resent key. That holds, given the fix in point 4.
- Refused items don't block the others, and sending one at a time per trip is sensible.

## More than this app needs
- The correction machinery (numbers, a stored counter, the "saved but changed" branch, the send lock) is most of the new code. If the owner accepts that an item with no reply is locked after its first attempt, and the parent checks the trip for it, the numbers and the correction branch go away. That is the owner's call, and the cost is that the parent may have to check.
- The membership snapshot and the manual-share check are large for a handful of parents. Refusing to queue manual shares offline closes the gap in point 3 with much less code.
