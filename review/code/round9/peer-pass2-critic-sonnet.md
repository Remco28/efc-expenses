It does not hold up. I read the code (public/app.js, src/index.ts, migrations 0009 to 0011) and ran nothing. I found one serious flaw, one hole in the "drop the key" rule, and a few smaller problems. All of it is by reading, not by running.

**1. A different add can overwrite the first one without anyone noticing (serious).**
- The key is stored per URL path (`addKeyFor(path)` in app.js), not per thing being added. For people the path is `/families/<id>/people`, so it is one key per family. For families it is one key per trip. For trips it is one key for the whole app.
- Take a parent who adds "Ava" and loses the reply. The key stays for 10 minutes. The reload fails too, or the parent gives up on it. A few minutes later they add their other child, "Ben", to the same family. The phone reuses the key, and the server sees the same key with different details. Ava is untouched, so the server updates her row in place to "Ben". The screen says "Ben added" and Ava is gone. Nothing warns the parent, because the "untouched" test only guards against other people's edits. The same phone adding a second thing looks exactly like an untouched first one.
- The same thing happens with a second family or trip added within 10 minutes of a lost reply.
- Coaches and families share the `/tournaments/N/families` path. Adding a coach after a lost family add overwrites the family's name and role. The UPDATE doesn't touch `kind` or `days`, so you get a family row with a role. That is a malformed record.
- The 10-minute window is the only thing limiting this. At a tournament with no signal, 10 minutes is easy to reach.

**2. "Dropped as soon as the server answers anything" is wrong in the cases that matter.**
- In `api()`, `forgetAddKey` runs right after `fetch` resolves, before the body is read. On a bad signal the usual failure is headers arriving and the body being cut off. `res.json()` then throws. The key is already gone, and the error is a raw parse or network message instead of the "may not have saved" one.
- In the person flow, `pendingAddKey` is then null, so the "was added after all" check never runs. The name goes back into the box, and the parent taps Add again, which creates a second person. That is the original bug.
- Any HTTP status counts as "answered". That includes 502/504/52x from Cloudflare's edge, where the worker may have run, and captive-portal pages. Only a JSON reply from the app itself proves the server dealt with it. Keep the key on 5xx and on non-JSON replies.
- A lost reply followed by a retry after more than 10 minutes gets a fresh key and makes a duplicate. That is quiet and not unlikely at a tournament.
- Keys live in sessionStorage. A reload keeps them. Reopening the home-screen app (there is a manifest) or a killed and restored tab does not. Expenses use localStorage and trip, family and person adds don't. The stated "reload" case works but "reopened the app" doesn't.

**3. Server race on person, family and trip adds.**
- Only expenses use `ON CONFLICT DO NOTHING`. The other three do a SELECT and then an INSERT. A retry that arrives while the original is still running, for example after the 25-second client abort, can hit the unique index and return a 500.
- A 500 counts as "answered", so the key is dropped even though the record exists. The parent then re-enters it and gets a duplicate.

**4. Expense side. It mostly works, with small gaps.**
- If a treasurer deletes a duplicate and the phone still has the pending copy, "no expense with that key" restores it and it can be re-saved. The expense comes back.
- There is a single pending slot. A second lost-reply expense overwrites the first, though the form restore usually makes the parent deal with the first one before that.
- A pending expense the parent meant to abandon keeps coming back. It is restored on every Add expense, and the only way to clear it is to save it.
- If the trip data on screen is stale, the "did save" check misses and the app says "may not have saved". That is safe, because the same key returns the existing expense, but the wording is wrong.
- When the retry's update fails because the trip has since been finalized, the message says "someone has changed this expense". That is misleading.
- Pending is only noticed when `e.status == null`. That is correct. It also fires when nothing was sent at all, which is fine.

**5. Is it too complicated?**
- Yes. The "update in place if untouched, and for a trip only if no family exists" logic is what causes problem 1. It also needs a `client_sig` column on three tables (migration 0011) and three copies of the compare-and-update.
- A simpler design: the same key always returns the existing record, with its stored name and a flag. The client then decides. If the typed name differs and it is plainly the same attempt, it makes a normal rename (PATCH, which already checks `uid`). Otherwise it says "Av is already added".
- Bind the key to the form attempt, not the path: drop it when the parent clears the box or starts a different add, or store the typed name with the key and only reuse it for a near-identical name.
- With that in place the sig column and the trip-has-no-families special case go away.

**6. Not covered, as you said.** Two parents on two phones adding the same family or the same dinner is probably the commonest duplicate at tournaments. It is out of scope here, but the fix doesn't address it.

**What still works.** Expense retry with identical content, expense restore from localStorage, and the "added after all" path when the reload succeeds all behave as described. Nothing existing breaks that I could find, beyond the partial-unique-index migrations, which look safe.

**If I could only fix three things:** scope the key to the attempt so it can't overwrite a different add; keep the key unless the app itself gave a JSON answer; and make the three adds conflict-safe like the expense add.
