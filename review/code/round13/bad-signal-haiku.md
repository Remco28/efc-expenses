Review of /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl13/field at f290c1c, from a parent on a phone with bad signal. I read the code (src/index.ts, public/app.js, public/split.js, saving-design-v4.md) and did not run it: I did not start the server or a browser, so every finding below is reasoned from the code. No HIGH found. Nothing was changed and no server was started.

MEDIUM 1: A tap or typed value that fails with no signal stays on screen as if saved.
- Where: public/app.js, famSave() (family screen: fencing-day taps, Fencer checkbox, person name, family name, pay notes) and fencingSave() (Fencing days screen).
- Steps: 1) Parent taps "Mon" for a fencer with no signal. 2) flipBtn() turns it on in the DOM and queues PATCH /api/people/:id. 3) fetch rejects; api() throws unsure, act() toasts "...may or may not have saved. Check before trying again.", and famFailed is set. 4) The queue's final step calls loadTrip(), which is a GET, so it also fails. That throws into the catch, which only clears the "Saving..." text. 5) No re-render happens, so the day stays visibly ticked, no "Saved" appears, and nothing retries. The toast fades after about 3 seconds. 6) Server state never got the tick. The shares are then computed without it, and the parent only sees the difference on a later reload.
- Same mechanism for a typed pay-notes or name field: onchange sends once, the send fails, and the typed text stays with no marker. Leaving the screen discards it silently after the toast is gone.
- Severity: MEDIUM. It is wrong but visible at the moment, and recoverable by retapping or reloading. Reasoned from code.

MEDIUM 2: An edit that was left during its save and then refused loses the parent's changes. The design says it keeps the draft; the code does not.
- Where: public/app.js, saveExpense() calls refusedAfterLeaving(), which only keeps new expenses (`if (!d.id && keepWaiting(...))`). Otherwise it toasts "Your change to X couldn't be saved: <reason>". Also show() calls leaveDraft() for any trip screen, which runs dropDraft() and clears the sessionStorage copy.
- Steps: 1) Parent edits an expense and taps Save. The form goes inert. 2) Parent uses the browser or edge-swipe Back during the save (the in-app Back link is inert, but the browser's back is not). show() runs leaveDraft(), so the sessionStorage draft is removed. 3) Meanwhile another phone changed that expense, so the server returns expense_changed. 4) The toast says the change couldn't be saved. The typed amount, description and split are gone with nothing to reopen.
- Design doc section 4 (saving-design-v4.md, and plan v2 section 3 in review/code/round12/) says an edit that can't be kept "keeps its draft instead, and the message says so". The code does neither.
- Severity: MEDIUM. It needs a rare sequence (another phone editing the same expense plus leaving mid-save). The toast is visible, but it does not say the draft is gone.
- Same gap when the edit was unsure (no signal) and the parent left: the toast says "may or may not have saved", and the typed text is gone.

MEDIUM 3 (designed, but the parent's recovery is outside the app): A new expense waiting on the phone that arrives after finalizing is refused and sits in "Couldn't send". Recovery is only possible by reopening the trip, and the app gives the parent no way to ask for that.
- Steps: 1) Parent adds dinner with no signal; it goes to "Waiting to send". 2) The treasurer finalizes. 3) On the next sync, POST /expenses returns 409 "This tournament is finalized", and the item is marked refused. 4) The toast shows only if the app is open at that moment. The trip home card says "N expenses on this phone, not sent yet" even for refused items. 5) "Open it to fix" re-enters the same form and gets the same refusal. The treasurer never sees the expense.
- This is section 4 of saving-design-v4.md. It is not in the "What it doesn't handle" list, so I am flagging it. Severity: MEDIUM (wrong but visible to the parent, and nothing on the treasurer side shows it).

LOW
- Home card lumps refused items into "not sent yet" (public/app.js renderHome).
- Receipt objects uploaded for a save that never completes are never removed for live trips. dropOrphanReceipts only runs on purge or practice reset. Storage leak only, not money.
- Typed text is lost when add-family, new-trip, add-staff or the edit sheets fail with no signal. The sheet closes on submit before the request, so design section 5's "what they typed stays on screen" does not hold. Known as round 3 LOW #11 and not fixed.
- A hung request holds the queue: show() awaits famQueue before a trip screen loads, and each queued save can wait up to 25 s. Tapping "Done" with a hung queue can look frozen for minutes.
- Deleting an expense (and replacing or removing its receipt) deletes the R2 photo immediately, with no undo, after a confirm.

Checked and found sound (from the code)
- Money math (split.js): shares sum exactly to the total via largest remainders; balances skip expenses with no sharers; treasurer plan nets to zero.
- Finalize: the fingerprint covers amounts, payers, bases, dates, splits, fencer days, families, treasurer; the write is conditional on the status and fingerprint in one batch; activity-ID check.
- Server idempotency for new expenses, families and people by client_key; the "same edit resent" rule for expense PATCH and DELETE (rev-1 plus equal fields); the 404-after-delete treated as done.
- Phone-side waiting queue: keys are stable across retries; unsure holds, refused parks as "Couldn't send"; the key is cleared only once the server has answered; settleWaiting drops items that landed.
- Expense save: the fresh pre-check, the whoIs comparison of shares, and held-if-left are as designed.

Not run: no browser, no server, no curl. Repo copy left untouched.
