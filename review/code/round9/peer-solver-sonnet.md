I read the code (/home/frank/Dev/efc-expenses: src/index.ts, public/app.js, migrations 0009 and 0010) but ran nothing and changed nothing. The cause is the same in both cases: the phone makes a key for each add, and that key doesn't survive the situations you describe.

## Why it happens now

- **Expenses.** The key (`client_key`) is made when the form opens and is kept with the draft. Tapping Save again on the same form is safe. If the parent starts a new form from scratch, they get a new key, so the server sees a new expense.
- **People and families.** The key is made in `api()` from the path plus the exact request body, and held only in an in-memory map. Changing "Av" to "Ava" changes the body, so it gets a new key. A page reload empties the map, so it gets a new key too.

## Approach A: keep the key tied to the intent, not the exact content (my recommendation for people and families)

When someone starts "add a person to family X", make one key and store it in `sessionStorage`. Delete it when the add is confirmed or the sheet is deliberately cancelled. Don't include the typed name in the key. That fixes the typo-fix and reload cases.

If the same key arrives with different content, the server already treats that as "your first save landed, here is your correction" for expenses. It updates the row, but only if nobody has touched it since (`rev = 0`). People and families don't do that today: they return the old id and silently drop the correction. They should get the same update-if-untouched treatment, so the corrected "Ava" replaces "Av" instead of being lost.

- **Cost to parents:** nothing. They tap Add, and sometimes the app quietly makes it right. It works on a bad signal.
- **What could go wrong:**
  - A key that never gets cleared. A parent adds Ava, the reply is lost, and they give up. Later they open the same sheet and add a genuinely different person, and it merges into Ava. To limit this, clear the key when the sheet is dismissed after a clean success. Also give the key a short life, maybe 10 minutes.
  - Two parents sharing a phone share a `sessionStorage` key. This is unlikely and low harm.
  - "Update if untouched" can refuse if someone else edited the row in between. The parent then needs a clear message telling them to look at the list.

## Approach B: catch near-duplicates on the server and ask (my recommendation for the from-scratch expense case)

A new key can't be recognised, so you have to judge by content. When an add arrives with a new key, check for a recent look-alike in the same trip:

- **Expense:** same payer, same amount, and a similar description or date, created in the last half hour or so.
- **Person or family:** same family, and a name that is the same after trimming, ignoring case, or one edit apart. "Av" and "Ava" would be caught.

If there's a match, don't save. Answer "This looks like the same as one added a minute ago. Add anyway / It's the same, use that one." The parent taps one button, and "add anyway" retries with a flag that skips the check.

- **Cost to parents:** one extra tap, but only in the rare lookalike case. This is the only approach that covers the parent who re-enters an expense from nothing.
- **What could go wrong:**
  - False positives matter here, because parents genuinely do add similar things. Two parents may each buy a $24.50 team dinner, or each add a "Sam" in different families, which a same-family check allows. So:
    - Keep the window short.
    - Require the amount to match exactly.
    - Require a similar description as well.
    - Never block. The warning is always bypassable.
  - The prompt is itself a request that can be lost. "Add anyway" must be safe to retry, so it should carry the key the original attempt used.
  - "Created by" is only a typed name, so you can't reliably say "same person". Don't lean on it.
  - It is more server code and more rules to tune than approach A.

## What I'd do

Do both, but unequally. Approach A is cheap and invisible. It fixes case 2 and the reload case completely, and it makes expense retries survive a reload. Approach B is worth building for expenses, where the cost of a double count is highest and re-entry from scratch is the failure that A can't touch. For people and families, A alone is probably enough.

One more cheap thing: the current error says "may or may not have saved. Check before trying again." After a lost reply, the app could refetch the trip and show the parent whether their expense is now in the list. That tells them directly whether it saved, and it lowers the chance they re-enter it at all.

Per your standing preference to confirm key decisions, I'd like you to confirm two things before I build anything:
- whether the near-duplicate prompt for expenses is wanted
- the lookalike window (my guess is 30 minutes)
