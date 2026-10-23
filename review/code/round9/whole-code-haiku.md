Review of EFC Trip Expenses at 4719bbd (my copy: /tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl9/whole-haiku). I read src/index.ts, public/app.js, public/split.js, public/pdf.js and migrations 0001-0009. npm test: 17/17 pass. I ran the local server on 8842, then stopped it (port now free; I did not touch the other wrangler processes on 8819/8820, which belong to someone else).

No HIGH findings. The money math (split, balances, treasurer plan, finalize fingerprint, reopen, payment ticks) and the optimistic-concurrency guards (expense rev, family/person uid tags, trip-date checks, day trims in SQL) hold up when I read them against the parent scenarios. The three MEDIUM findings below are the ones that matter.

1. MEDIUM (rare sequence, silent). A new expense's retry is accepted without comparing content, so a correction is dropped and the app says "Expense saved".
- Steps: Save an expense. The reply is lost, so the toast is "No connection" and the form stays open with the same client_key. The parent corrects the amount and taps Save again. The server finds the row by client_key (routes POST /tournaments/:id/expenses, the `made` branch) and returns 200 with the old id. The app toasts "Expense saved" and leaves the form. The list shows the old amount.
- Ran it: POST with key K and amount 5000, then POST with the same K and amount 9000. Result: 201 {id:1}, then 200 {id:1}. Stored amount stays 5000.
- Fix: on a key hit, compare the content as the PATCH "same" path does, or rotate client_key when the draft changes.

2. MEDIUM (visible and recoverable, but a wrong split until noticed). Adding a person or a family is not retry-safe.
- Person: POST /families/:id/people has no key. Steps: the add lands but the reply is lost. The app redraws (the person is listed) and puts the name back in the box. Tapping Add again creates a duplicate fencer, which doubles that fencer in the coach airfare and fencing-day shares.
- Ran it: the same person POSTed twice returned 201 and 201, giving two "Ava" rows with fencer status.
- Family: POST /tournaments/:id/families has no key, and addFamily() has no name-restore, so re-adding after a lost reply creates a second family of the same name. Reasoned from code, not run.
- Fix: add a client_key to person and family creates, or check for an identical name just created.

3. MEDIUM (rare timing; visible afterwards). The stale-form guard in saveExpense() compares only the family id list (`ids(fresh) !== ids(S.trip)`). It does not compare days, people, or fencer flags. Steps: parent B opens Add expense (per-person lunch, Saturday). Parent A removes Saturday from a family or adds a person to it. B saves without a warning. The preview B saw is stale, and the stored split uses the current counts, so the saved split differs from what B checked. Automatic splits following attendance is by design, but the guard should cover the counts it claims to cover, or re-show the shares when they change. Reasoned from code.

LOW: amount parsing in app.js cents() mis-reads some typed amounts. Ran it on the client function: "12,5" gives $125.00 (10x), "1,5" gives $15.00, "1.250,00" gives $1.25 (1000x too small). The savebar shows the parsed amount before saving, so it is visible, but a careful check is needed.

LOW: a lost reply on DELETE expense makes the retry return 404 "No such expense", and the form stays on screen with the dead expense. Harmless to data. Reasoned from code.

Not findings: the late-family default of whole-trip days (already listed as a design item in round 8), and the PDF and receipt paths, which I read and found no wrong-number or lost-work issues in.
