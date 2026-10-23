I read the code only (/home/frank/Dev/efc-expenses: src/index.ts add handlers, public/app.js `api()`, `addKeyFor`, `saveExpense`, `settlePending`, migrations 0009-0011). Nothing was run or changed.

**The existing attempt, on its merits**

Expenses are mostly sound. The phone mints a `client_key` per form. The server finds an expense with that key and returns it if the content is the same, or applies a correction if nobody has edited it since (`rev = 0`). The `split` comparison also holds, because both sides are JSON strings. A lost-reply save is kept in localStorage (`efc-pending-expense`) and offered back when the parent reopens the form. The gap is the one you described. A parent who ignores that banner and types the expense again gets a new key, and nothing connects the two. That case is still open.

People and families are weaker. `api()` keeps one key per path in sessionStorage, and it expires after 10 minutes. It is cleared after any server answer. That causes three problems:
1. **A wrong rename (data loss).** Parent adds "Av", the reply is lost, and "Av" was in fact saved. The parent then types "Ben" and taps Add within 10 minutes. The phone sends the same key. The server finds "Av" by key, sees a different signature, sees the row is untouched, and renames it to "Ben". "Av" disappears and the toast says "Ben added". The server cannot tell a typo fix from a new person, so the phone has to.
2. **Duplicates after the 10-minute TTL.** A retry after 10 minutes gets a new key, so it adds a second row.
3. **Duplicates when the tab is closed.** sessionStorage is per tab. Expenses use localStorage, so people and families are the only ones that lose their key this way.

**Approach 1: reconcile with the list before reusing a key (for people and families)**

Keep the key, but store it in localStorage together with the unconfirmed name, and treat the list as the source of truth. When the parent taps Add after an unconfirmed attempt, the phone first re-reads the trip. If the earlier row is there (matched by key), the new entry is a correction to it: reuse the key, and say "Renamed Av to Ava" so the change is visible. If it is not there, mint a new key and add normally. The server's untouched-row rule stays as it is.
- Cost to parents: about one extra beat, and a short "Av may already be here, check the list" message. That message is a reconciliation step, so it is not an extra tap.
- Could go wrong: the re-read also fails on a bad signal. The phone must then refuse to guess and tell the parent to try again later. It should not fall back to adding a second row silently. Also, the key must expire when the list shows the row or after about 30 minutes, not after 10.

**Approach 2: a soft near-duplicate check on the server (the backstop, mainly for expenses)**

When an add arrives with a new key, look for a recent match in the same trip. For expenses, that means the same payer, amount and date, a similar description, and created in the last 30 minutes. For people, it means the same family and the same name after trimming, ignoring case, or one edit apart. If there is a match, do not save. Answer with "This looks like the one added 2 minutes ago. Use that, or add another?" The "add another" button retries with a flag that skips the check.
- Cost to parents: one tap in the rare lookalike case. It works on a bad signal because it only adds a prompt.
- Could go wrong: two genuine look-alikes. Two $12 water bottles bought on the same day for two kids will match. Twins or cousins with near names in one family will match. The check must only prompt, never block, and "add another" must always be there. Also, the name check should only match within one family, not across the trip, or parents who add similar names will be interrupted constantly.

**What I would do**

Expenses: keep the current key design and the localStorage pending record, and add Approach 2 for the from-scratch case. People and families: Approach 1 is the fix for the wrong rename and the TTL. Use Approach 2 only as a same-family prompt if the reconcile step turns out not to be enough.

I would check two things before building. First, confirm how often a lost reply is followed by a fresh entry in practice. Second, check whether the family-add path reuses a key after a successful add, which I did not verify.
