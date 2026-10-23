Review of saving-design-v4.md against src/index.ts and public/app.js (nothing in the project was changed or run).

Short verdict: the core holds up, but there are four real problems and a few smaller ones.

**Findings that matter, most serious first**

1. **"Already added" can quietly throw away a parent's correction (expenses).**
   - v4 removes today's correction code and says a resent key only ever answers "already added".
   - But the form for a hand-set-shares expense stays open after a failed save and keeps its key. The parent can fix the amount or a share and press Save again.
   - If the first attempt had actually landed, the server now answers "already added" and the app shows "Expense saved". The saved expense still has the old amount.
   - Today's code (src/index.ts around lines 716-728) handles exactly this case. The same hole exists for people, families and trips. Before dropping that code, the design needs one of these:
     - A new key whenever the content differs, or
     - The "already added" reply must carry what is stored, and the app must say "it was saved as X; open it to change it".
   - Either way the app must not report plain success when the saved content differs.

2. **The key is per screen, not per thing, and the design doesn't say how that changes.**
   - Today the add-key is stored per path, one slot for the whole "add person to family 5" route, with a 10-minute expiry (app.js lines 62-68).
   - v4 says "typing Ben makes a new key", but nothing in the design or code compares the content to the old attempt.
   - Under the new rule, if a lost "Ava" is followed by "Ben" on the same slot, the server answers "already added" and the parent believes Ben is on the trip. Ben is silently missing.
   - The expiry works against the design in the other direction. A retry after 10 minutes, or after the tab is closed (the keys live in sessionStorage), gets a new key. That makes a second Ava, which is the thing v4 says can't happen.
   - Pick one of these:
     - Bind the key to the typed content and keep it in localStorage with no short expiry, or
     - Admit the duplicate window.

3. **The waiting list is one localStorage entry, and two tabs can lose items.**
   - The design says two tabs sending the same item is harmless, which is true for the server.
   - It doesn't cover the list itself. If the list is one stored value that each tab reads, changes and writes back, a tab that saved a new waiting expense can be overwritten by another tab's stale copy. The expense is gone.
   - A Remove in one tab can also reappear from the other.
   - Safari plus the home-screen app already make two copies likely.
   - Cheap fix: one storage key per item, rather than a single shared list.

4. **A deleted trip makes a waiting item retry forever.**
   - The server returns a 404 in JSON for "this trip doesn't exist or was deleted" (line 78). It returns the same shape for "No such family" and a plain "Not found" for an unknown route.
   - v4 treats every 404 as "no such page, keep trying". A waiting item for a trip that was deleted (and could be restored later) would be retried every 30 seconds with no sign to the parent.
   - It would also never reach "Couldn't send".
   - The design needs a way to tell "route missing" (an old app version) from "trip gone". For example, give the route-miss reply a marker, or match on the specific error text.

**Smaller problems**

- **"A success reply carries an id" is wrong for most saves.**
  - Finalize, payments, edits, deletes and people edits all return `{ok:true}` with no id (lines 413-612, 697-778).
  - Applied literally, every one of them would be classed as "don't know".
  - The test should be "the app's own JSON", meaning a parsed body with `ok` or `id`. Today api() returns null for a non-JSON success, and that null is accepted as a success.
  - The captive-portal concern is real, but the fix is small. The word "id" is the mistake.

- **Automatic shares are worked out later than the parent saw them.**
  - Only per-family overrides are stored. The roster and days that decide the automatic shares are read when the totals are computed.
  - Today saveExpense reloads the trip and refuses to save if the roster changed since the form opened ("Check the shares, then save again", lines 1120-1128). A queued item skips that check by definition.
  - Someone adding a family, or changing a person's days, before the item lands changes who is charged.
  - This is smaller than it sounds, because saved expenses already shift when the roster changes. But the parent never gets to see the shares they are agreeing to. It's worth one honest line in "doesn't handle".

- **A brief finalize turns a waiting item into a permanent refusal.**
  - Finalize then reopen minutes later is plausible (the treasurer spots a mistake). Any item sent in that window is refused for good.
  - The parent must retype it.
  - You could treat the finalized-trip refusal as "wait and retry" for a while. It's a choice, but §4 doesn't acknowledge the cost.

- **Receipt photo.**
  - If the upload fails, the photo is dropped and the parent has to re-add it later.
  - Check that the photo is still on the phone's camera roll. If so, this is fine.

**What holds up**

- **Hand-set shares need a signal.** The reason is better than the design gives: the split is keyed by family number. Those numbers can be reused after a delete, so a hand-set split queued for later could charge the wrong family. Automatic splits carry no family numbers.
- **The payer tag (family `uid`) check** closes the one remaining money-to-wrong-family path, using an existing field. Keep it.
- **Checking the key before the finalized check** is correct. A lost reply plus a later finalize would otherwise show a good expense as refused.
- **Waiting items don't count in totals** and are visibly marked "may already be on the trip". That is honest.
- **Server-side idempotence** (unique index on `client_key`, insert that does nothing on conflict, per-trip lookup) is already there and sound for same-content retries.
- **The "doesn't handle" list** matches what the code does.
- **Remove-only, no editing** of waiting items is the right cut. It avoids a whole class of key-and-content conflicts.

**More than the app needs?**

- The queue itself is the owner's choice, so I left it alone.
- The "Couldn't send" bin with its "open to copy" action and the count on the trip list could be cut down. A refused item could just be a visible waiting row with the reason, with Remove as the only action. That would be one list, not two.
- Everything else in the design earns its place.
