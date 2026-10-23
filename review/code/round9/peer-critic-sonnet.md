Verdict: the plan is not fine as written. It misses the typo case it was written for. It adds a prompt to legitimate entries. A smaller change fixes most of both problems. I read `src/index.ts`, `public/app.js` and the migrations. I ran nothing and changed nothing.

**What already exists**
- Expenses: the form makes a `client_key` when it opens (`app.js:861`), and the draft, key included, is kept in `sessionStorage` (`app.js:1081`).
- Expenses, server side: a retry with the same key and the same content returns the existing row. A retry with the same key and corrected content updates that row (`index.ts:683-697`). So "fix a typo and retry" is already solved for expenses, as long as it is the same form with the same key.
- People, families and trips: the key is not tied to the form. `api()` builds it from `path + JSON.stringify(body)` and holds it in an in-memory Map (`app.js:73-76`). That causes both of your scenario-2 failures:
  - Changing "Av" to "Ava" changes the body, so it gets a new key.
  - Ticking or unticking Fencer between tries also changes the body, so it gets a new key.
  - A reload empties the Map, so it gets a new key.
- The add-person field is cleared on submit and restored only on a failed save (`app.js:805-812`). A lost reply therefore goes through that restore path, and the parent edits and re-submits. That is where the typo scenario comes from.

**The plan misses the typo**
- "Av" and "Ava" are not the same name, so a same-name match never fires.
- To catch it you would need fuzzy matching (prefix or edit distance). That brings false positives: Ann/Anna, Jon/Jonas, Lee/Leen.
- Expense near-retries are also missed whenever the parent changes the amount, the date or the payer. The receipt reader can also change the amount, because the second entry may be scanned again. A null date matches every other undated expense.
- The window is "last few minutes". The case you describe is a tournament with no signal, where a parent can be offline for 20 minutes or more. The window is shortest exactly where the problem happens, and widening it adds false positives.

**What it would break or add friction to**
- Legitimate same-amount expenses are common. Examples are two $12.50 snack runs, three rooms at the same rate, $20 tips, $50 gas fill-ups, and a treasurer typing in a stack of receipts after the trip. Each one gets a "save anyway?" prompt.
- After a few of those, people tap through without reading. The protection then fails when it is needed.
- The same-name rules also fire on real cases:
  - Two families with a common surname, such as Kim, Lee or Nguyen, added in a row while building a roster.
  - Two people in one family with the same first name. The field is "first name" only, so a parent and child can both be "Michael".
  - Staff are rows in `families` with `kind = 'staff'`. A coach "Lee" would collide with a "Lee" family unless the match also checks `kind`.
- Every caller of the add endpoints needs a new response path:
  - `api()` treats any ok response as success. If the "looks like a duplicate" answer is a 200, `addFamily` will use an undefined `r.id` and navigate to `/f/undefined`. It should be a distinct status, and each caller needs a confirm step.
  - An old open tab talking to the new server would just show an error toast with no "save anyway" button. Reloading fixes it.
- Retries get more fragile. A legitimate duplicate now needs two successful round trips on a bad signal, and the confirmed send can itself lose its reply. That is safe only if the confirmed send keeps the same key, so the key must not include the `confirmed` flag.
- If the near-match is a separate SELECT before the insert, two simultaneous adds can both pass it. The existing code puts its conditions inside `INSERT … SELECT … WHERE` for this reason. Put the near-match inside that WHERE if you keep the plan. This is low priority.
- The near-match check must run after the client_key lookup, or an exact retry of a save that did land will be told "added 1 minute ago by you".
- Trips use the same add mechanism (`POST /tournaments`) and are not in the plan, so a typo'd trip name will duplicate in the same way.

**What the plan does get right**
- It is the only approach that works when the phone has lost all memory. That covers a reload followed by retyping, a different device, and two parents each adding the same hotel bill from their own phones. Any simpler fix based on a stored key cannot catch those.
- The stakes are low in both directions. A duplicate is visible and deletable until finalize, and reopen exists. A false prompt costs a tap every time.

**Simpler version**
1. Tie the key to the form, not to the content, for people, families and trips.
   - Make the key when the add field or sheet opens. Keep it until a save succeeds.
   - Persist `{key, typed text, fencer tick}` in `sessionStorage`, the way expense drafts already are, so a reload restores them.
   - On the server, when a row already has the same key but different content, update it (rename it, change the fencer flag) instead of adding. Expenses already do this, and the same pattern would fit people, families and trips.
   - This fixes "Av"→"Ava", the fencer tick and the reload with zero prompts.
2. For expenses, handle the abandoned form.
   - When a save fails ambiguously, remember `{key, summary}` in local storage. On the next trip load, look for that `client_key` in the expense list. `loadTrip` already returns it, because it uses `SELECT *`.
   - Or simply re-send the same key. That is safe either way.
   - Show "Your $45 Dinner did save" or "didn't confirm, retry?" so the parent does not re-enter from scratch. Re-entering from scratch is your scenario 1.
3. Keep a server-side net only for what the key cannot cover (another device, or a retype after the stored key is gone), and make it narrower.
   - Expenses only, matching on payer, amount, date, `basis` and `split`.
   - A non-blocking presentation: save it, then show "Possible duplicate of Pat's $45 from 2 minutes ago [Remove this one]". That avoids a second round trip on bad signal and a stuck form.
   - If you do block, make the safe choice the default ("It's the same, don't add") and "Different, add it" the secondary choice.
   - Skip people and families. A duplicate there is cheap to remove and the false positives are common.

**To decide**
- Whether the server-side net is worth building at all once the key fix is in. It mainly covers two parents entering the same bill.
- Whether to block the save or warn after it.
