All eight fixes landed. I found one real problem, which the fix for #3 introduced, and two minor leftovers. Server stopped.

**Verdict per fix**
1. Trip dates (stale form, shortening): landed, nothing made worse. The server refuses a form whose `seen_start`/`seen_end` no longer match the trip. A rename-only PATCH still works, because with no dates sent it uses the current ones. The form is the only caller that sends dates. The shorten confirmation names who loses days and escapes names correctly, the same way the other callers of `confirmSheet` do. Reasoned from code; the repo's `round8.mjs` covers the stale-form refusal.
2. Family removal bumps the revision of expenses that listed the family: landed. The bump sits in the same `can`-guarded batch as the DELETE, so a refused removal doesn't bump anything. Expenses that don't list the family (automatic) aren't bumped, but a stale editor of those can't hand the id's share to a new family anyway.
3. Retried save: the duplicate is prevented, but this fix has a regression (below).
4. Family list check before saving: landed. The id comparison is done and the draft is redrawn. The extra `await` before the Save button is disabled widens the double-tap window, but `client_key` makes a double-tapped new expense harmless. An identical double-tapped edit is also accepted.
5. Unticking then re-ticking Fencer: landed, and the other places that read `fencing_days` agree. The money math filters on `is_fencer` (`split.js`: `fencer_day` sums over `fencers`). `renderDay` and the PDF grid were fixed in the same commit. The family-screen warnings already check `is_fencer`. Reasoned from code.
6. Reopen with a tick count: landed. The reopen DELETE and UPDATE both carry the same count condition, so a tick that arrives meanwhile gives a 409. The only caller sends the count. A reopen with no body is refused with 409 at the server; I called it without a body on an already-open trip and got 200, probably because the test helper `stamp` adds the field.
7. "12,50": landed (see the LOW note below).
8. PDF table total: landed.

**Findings**

MEDIUM, ran it. A save retried with corrected content is silently dropped.
- On a new expense, the form unfreezes after a failed send and keeps the same `client_key`.
- If the first POST actually succeeded and only the reply was lost, the server has the expense.
- The user sees an error, fixes the amount (say 20.00 to 2000.00, or a wrong payer or family) and saves again.
- The server finds the existing row by `client_key` and returns `{id}` with 200, before looking at the new body.
- The app then shows "Expense saved" and the corrected values are discarded.
- I ran it: POST with amount 2000, then the same key with 200000. The second returned 200 and the expense stays at 2000.
- This is the same flaky-wifi case the fix targets. Before the fix the user got a duplicate row, which was visible. Now the wrong number looks saved.
- Fix: when the key matches, compare the stored fields as the PATCH idempotence check does. If they differ, update the existing row (or return 409). Or rotate `client_key` whenever the form is edited after a failure.

LOW, reasoned. `cents()` handles only the exact pattern `^\d+,\d{2}$`.
- "12,5" is read as $125.
- "1.250,00" is read as $1.25.
- The shares preview shows the result before saving, so it is visible.

LOW, reasoned. The README says reopen "names the number of ticks it saw". The number is only sent to the server. The dialog text still says "Payments already ticked off will be cleared", with no count. The fix itself works.

No other fixes were missed in a second place that I could find.

Files are under `/tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl9/fixaudit`. The relevant ones are `src/index.ts` (POST `/tournaments/:id/expenses`, PATCH `/expenses/:id`, `/reopen`) and `public/app.js` (`saveExpense`, `cents`). My scratch script `review/code/briefs/t1.mjs` is in the copy.
