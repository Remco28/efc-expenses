Verdict: the shape is right (phone-made keys, a server that only ever returns the existing row, and a persisted "unsure" record). But it doesn't hold up as written. I read src/index.ts, public/app.js and migrations 0009-0011; nothing was run or changed. Below, most important first.

**A. Things that will go wrong**

1. **A corrected retry of an expense is silently saved wrong.** Today the server applies a corrected retry (rev = 0, no one else touched it). The plan removes that, and item 3 only describes the message for people. For an expense, the parent fixes $24.10 to $42.10 after a lost reply and taps Save. The server returns the old row unchanged. The existing flow (`saveExpense`, then `act(..., "Expense saved")`, then navigate away) shows a green "Expense saved" and the wrong amount is in the books.
   - Item 5's "your last expense did save" only checks that the key exists, not what it holds.
   - Item 3 must apply to expenses, and it must not be a disappearing toast. Open the stored expense and show what differs (typed amount vs stored amount).
   - Do the comparison on the server and return `matches: true/false`. The server already normalizes input in `expenseInput` and `EXPENSE_FIELDS`. A comparison done on the phone, against the raw form (split key order, trimmed text, cents), will produce false "differs" and false "same".

2. **The server must look up the key before every other check.** Today `openTournament` runs first for expenses. For people, the `b.uid !== fam.uid` check runs before the key lookup. For expenses, `expenseInput` validation also runs before the lookup.
   - If the first save landed and the trip is then finalized, or a family is removed so the split no longer validates, the retry gets a refusal. The phone treats a refusal as a real answer and forgets the key. The row exists, the parent believes it failed, and re-enters it, which is the original duplicate.
   - Item 1 should say that a known key returns the stored row before trip-open, stale-uid and validation checks.

3. **"No reply" detection is wrong in three ways today, and the plan names only some of them.**
   - `api()` forgets the add key as soon as any response arrives (`if (adds) forgetAddKey(path)`), before it checks the status. That includes a 401 and a hosting 502 page.
   - The "no real answer" test for expenses is `e.status == null`. A hosting 502/504 HTML page does have a status, so it counts as a refusal and the pending record is dropped. A cut-off JSON body is the opposite case: it lands in the `status == null` bucket only by accident.
   - A captive-portal or venue Wi-Fi login page returns 200 with HTML. `api` returns `null` as if it succeeded. For an expense, `dropPending` runs, "Expense saved" is shown, and nothing was saved. This is the worst direction to be wrong in.
   - "A reply from the app itself" needs a positive test. Count only JSON with an expected shape (for example `{id}` on success and `{error}` with a 4xx on refusal) as an answer.
   - Treat every 5xx and 429 as unknown even when the body is JSON. The Worker's catch-all returns JSON 500 "Something went wrong on the server", which may come after a write succeeded. Treat 2xx without the expected `id` as unknown too.

4. **A reply that stalls halfway hangs the button forever today.** `clearTimeout` runs in the `finally` right after headers arrive, then `await res.json()` has no timeout. A body that stalls blocks forever. `famQueue` chains behind it, so every later family save waits too. For an expense, `app.inert = true` never lifts. The timer has to cover the body read, or "the Add button never stays locked" is untrue.

5. **Write the unsure record before sending, not after failure.** `keepPending` runs in the catch handler. If iOS suspends or kills the app mid-request (screen lock, switching to the camera), no catch runs. The server may have saved it, and the phone has no record at all. The same goes for "what was typed": the person box is cleared at send time (`newname.value = ""`).
   - Item 2 reads as write-first. Item 5 reads as write-after-failure. Say write-first explicitly, for adds and for expenses.

6. **A persistent slot with no expiry captures the next, different add.**
   - Rosa is unsure, the app is closed, and the next day the parent adds Mia to the same family. Mia goes out under Rosa's key. If Rosa had landed, the server returns Rosa, the phone says "Rosa was added after all", and Mia is not added. Item 3 can't tell this from a typo fix.
   - Fix: before any new add in a slot, reconcile first. Reload, check whether the key is present, report it and forget it. Do this on opening the screen, not only straight after the failed send (the plan's item 4 covers only the same session, and only for people).
   - Family, coach and trip adds have no reload-detect at all in the plan. Today's 10-minute TTL existed to limit this. Dropping it entirely is a deliberate cost. A long cap (a day or two) plus reconcile-on-open is safer than never.

7. **A slot whose id gets reused can pick up the wrong pending add.** SQLite here has no AUTOINCREMENT, and the code comments already say ids get reused. A pending expense is keyed by trip id, and a person add by family id (the path). A purged trip or a deleted family can hand its id to a new one, which then inherits the old record.
   - The server's uid check on person adds protects the family case, but only after a refusal.
   - Store the trip or family uid with the slot, and discard the slot on mismatch.
   - The family/coach/trip slots must also carry their parent (trip id), or a key made for trip A can be sent to trip B.

8. **The unique indexes are global, but the lookups are scoped.** The indexes are on `client_key` alone, but the lookups use `client_key AND family_id` (and the same for `tournament_id`).
   - A key that arrives under a different parent skips the lookup, hits the unique index and returns a 500. That breaks "can't crash".
   - Look up by key alone, then decide what to do if the parent differs.
   - Only the expense insert has `ON CONFLICT DO NOTHING` plus the re-select. People, families and trips need the same. Their `INSERT ... SELECT ... WHERE open` returns no row for both "trip closed" and "key conflict", so the re-select is also how you tell which one happened.

9. **"Server remembers the key as deleted" needs a new table, and it only protects expenses.** Delete is a hard `DELETE`, so the key is lost with the row. You need a tombstone table, written in the same batch as the delete, scoped to the trip, and pruned on trip purge.
   - Other paths remove expenses without a tombstone: the sandbox reset, and cascade on purge. A late retry after a sandbox reset recreates the expense.
   - Deleted people, families and soft-deleted trips will be re-added by a late retry. A soft-deleted trip (restorable for 30 days) would come back as an "already added" id that then 404s.
   - Accepting that is defensible, because only expenses carry money directly. Write it down as a decision. Also make a late-arriving first request (delayed in the network, landing after a second attempt and a delete) part of the thinking. The tombstone is what covers that for expenses.

10. **Discard can hide a saved expense.** If a pending expense actually saved, Discard drops the key and leaves the row in the books. The parent believes it was thrown away, and everyone is charged for it. Discard should reconcile first, or say "if it saved, it's still in the list." I'd go with reconcile first.

**B. What breaks that works today**
- The silent correction of typo'd retries goes away for all four add types (item 1 above is the expense version). For people, families and trips it becomes "added after all, fix it yourself". For a trip with wrong dates that is a real regression.
- Your old-client concern is small. There is no service worker, so clients update on reload. A phone with an old tab open will still show "added" for a corrected retry that the new server returned unchanged. That's a short window.
- The pending expense record is not keyed by user. Two parents sharing one phone could see each other's pending expense. Also, `crypto.randomUUID` is missing on older Safari (before about 15.4) and would throw on the first add. Both are minor.

**C. Missed or invisible to a parent**
- Receipt uploads are not keyed. A lost reply leaves orphaned objects. Harmless, since the upload expires, but "every add carries a key" isn't literally true.
- Edits and deletes are not covered. A retried corrected edit gets "someone changed this expense", which is wrong when the parent is the only person who touched it (item 6 in your plan, accepted).
- The reload that checks for the key can only say "not there" if the reload happened after the send. A stale trip list is safe, because resending the same key can't duplicate. But the stale list must not be allowed to produce a "didn't save" message.

**D. More complicated than it needs to be**
- Items 1/3 and item 4 are two ways of answering the same question, "did my key land?" Resending the same key already answers it. Reload-detect only matters so the typed name can be dropped without a tap, and it isn't needed for the safe path.
- Draft in sessionStorage, pending expense in localStorage, add keys in a third place: one shared "outbox" record `{kind, scope+uid, key, typed, sentAt}` would serve the four adds and the expense. Only the form and Discard UI differ.
- Dropping `client_sig` and the "untouched since" UPDATE logic on the server is a real simplification. It removes racy code. Keep that.
- The tombstone is the one genuinely new server piece, and it's justified for expenses.

**E. What I'd change in the plan**
1. Key lookup first on the server, with `ON CONFLICT` handling and the response flagged `matches` or not (computed server-side).
2. A positive test for "a reply from the app": expected JSON, not 5xx/429, not a 2xx lacking `id`. Cover the body read with the timeout.
3. Write the record before sending, with the typed content and the parent uid.
4. Reconcile on open before any new add in that slot, and before Discard.
5. Use the mismatch treatment for expenses too, as a visible screen rather than a toast.

The plan holds up on its core idea. It does not hold up on items 1 to 5 in section A.

Files read: /home/frank/Dev/efc-expenses/src/index.ts, /home/frank/Dev/efc-expenses/public/app.js, and migrations 0009-0011 (plus 0001, 0004 and 0008) in /home/frank/Dev/efc-expenses/migrations/.
