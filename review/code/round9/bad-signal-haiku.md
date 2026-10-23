Review of the EFC Trip Expenses copy at commit 4719bbd (scratchpad/rl9/field), from a parent on a phone with bad signal. I ran the app locally and drove the API with scripts in scratchpad/rl9/tests (lost.mjs, person.mjs, treasurer.mjs). The server is stopped. Nothing outside the copy was touched.

No HIGH findings. Most write paths are safe on retry: expense PATCH (rev plus a same-edit check), expense POST (client_key), day and fencing taps (one change per tap), payments, finalize, reopen. The problems are about lost replies and what the app tells the user.

MEDIUM 1: Expense saved after a lost reply, then edited and saved again, silently keeps the old values. Ran it.
- Phone sends POST /tournaments/1/expenses with client_key K and amount 4000. The server commits. The reply is lost, so fetch throws and the app says "No connection. Check your signal".
- The form stays open and unfrozen. The parent corrects the amount to 65.00 and taps Save. The same client_key K is sent.
- Server: `made` matches the old row and returns 200 {id:1} without updating. Stored amount is still 4000 (confirmed by the script).
- Client: act() shows "Expense saved" and navigates to the trip. The list shows $40, not $65, and nothing says the edit was dropped.
- Contrast: the PATCH path is safe here. Its retry check returns 409 and the parent is told to reopen.
- Fix idea: on a `made` hit, compare the fields and return 409 when they differ, or have the client keep one key per attempt and send the edit as a PATCH.

MEDIUM 2: A lost reply on a new expense looks like a failure, so the parent re-enters it and it is counted twice. Reasoned from code.
- The POST committed but the reply was lost. The app says "No connection. Check your signal and try again."
- If the parent leaves the form and adds it again, that is a new draft with a new client_key (app.js ~845), so the server stores a second expense. The split and the balances then double-count it. Visible in the list, but easy to miss.
- Fix idea: make the message say the save may have gone through and point to the list, and check for a matching recent expense before saving again.

MEDIUM 3: Retried adds create duplicates. Ran it for person and family.
- POST /families/:id/people with identical bodies twice gives 201 and 201. The family then lists "Anna" twice, and Per-person shares count her twice. Verified.
- POST /tournaments/:id/families with the same name twice gives two families (ids 2 and 3). Verified. A duplicate family doubles its share of per-family costs.
- Trip create (POST /tournaments) has no dedupe either. Reasoned.
- Client: on a lost reply, the add-person handler refreshes the list (which already shows Anna) and refills the name box, which invites a second tap. Family add and trip create close their sheet on failure, so the parent retypes the name and can create a duplicate.
- Fix idea: a client_key or a uniqueness check on these creates, as with expenses.

MEDIUM 4: An expense save on a dead signal has no timeout and no progress message. Reasoned from code.
- api() calls fetch with no timeout or AbortController. While an expense save is in flight, the Save button is disabled and the whole #app is inert. The button text does not change. Nothing says "Saving".
- On a weak signal the request can hang for a long time. The parent sees a frozen form with no message. If they close or reload the page, they cannot tell whether the expense was saved, and the unsaved draft is gone.
- The same holds for the receipt upload and read (d.uploading stays true until read-receipt returns), which blocks saving.
- Fix idea: a timeout (about 20 s) with a message, a "Saving…" label, and a check of the list when it fails.

MEDIUM 5: The expense draft lives only in memory. Reasoned from code, not run.
- S.draft is set only in JS. There is no sessionStorage or localStorage copy of the form. If the phone's browser reloads the page while the parent is in the camera (common on Android when memory is short), the typed amount, split edits and receipt link are lost. The form comes back empty. The parent can see this, so it is not silent, but the work is lost.
- Fix idea: save the draft to sessionStorage on input and restore it on render, with the client_key kept with it.

LOW 6: Expense delete retried after a lost reply. Ran it. The second DELETE returns 404 "No such expense". The editor stays open with a toast and no navigation. The parent has to go back to see it is gone. No wrong result.

LOW 7: Split edited between preview and save. Reasoned.
- saveExpense re-fetches the trip and compares only the family ids (ids(fresh) !== ids(S.trip)). A person added or removed, or a day changed, on another phone between opening the form and saving is not caught. Automatic splits are computed at read time, so the saved expense charges the new head count, which is not what the parent saw in the preview.
- This is inconsistent with the family check's own comment. It needs two phones at once, so LOW.

LOW 8: Pay-notes and name fields save only on change (blur). Reasoned. If the page is discarded while one of those fields is still focused and unblurred (some mobile browsers do not fire change when the app is backgrounded), the typed text is lost without notice. Narrow, so LOW. A pagehide flush would fix it.

Considered and not findings:
- Automatic shares (by design, per README) change for past expenses when someone edits a family's people or days, until finalize. The activity log records it. Worth a sentence to the treasurer, not a bug.
- Removing the treasurer's family: I checked it. treasurer_family_id is ON DELETE SET NULL, so the new family does not inherit the treasurer's role. Money stays consistent.
- Family and expense ids being reused: the revision and uid checks hold. Not a new issue.
- Finalize fingerprint and balances: shares always sum to the amount, balances net to zero, and finalize refuses expenses with nobody included. No problem found.

Files: /tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl9/field/public/app.js (saveExpense ~L1071, api() ~L57, famSave ~L719, addPerson ~L786, saveExpense draft ~L840); /tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl9/field/src/index.ts (POST expenses ~L654, PATCH expenses ~L677, POST people ~L590, POST families ~L508). Repro scripts: /tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl9/tests/lost.mjs, person.mjs, treasurer.mjs.
