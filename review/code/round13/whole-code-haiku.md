Review of whole-haiku at f290c1c (round 12 fixes included). Verdict: no HIGH findings. One MEDIUM and two LOW, below. Everything else I checked came out right.

## Findings

**1. MEDIUM: an edit refused after the parent has left the form is lost, with only a 3.2-second toast.** Reasoned from the code; the refusal itself was run.
- Parent A opens expense E (rev 0) and taps Save. The save is slow on venue wifi.
- A swipes back (the phone's back gesture, which works while the form is frozen) while "Saving…" is showing. `show()` unfreezes the app and `leaveDraft()` clears the sessionStorage draft.
- Meanwhile parent B edits E, so E is now rev 1.
- A's PATCH gets 409 `expense_changed`. I ran this against the local server: a stale-rev edit returns exactly that.
- In `saveExpense` the catch sees `S.draft !== d` and the error is not unsure, so it calls `refusedAfterLeaving`. For an edit that only toasts "Your change to X couldn't be saved: This expense was changed since you opened it." The change is gone. Nothing is kept and nothing reopens the form.
- The round-12 README says "a save walked away from and refused isn't lost". The code only keeps new expenses (`!d.id` branch). Edits are not kept.
- Fix options: keep the refused edit as a draft on E and rebase it onto the newest version when the parent next opens E (`mergeOnto` already does the merge), or add an edit entry to "Waiting to send" with the reason.

**2. LOW: the editor's Day picker says "Whole trip" for an expense dated outside the trip.** Reasoned from the code.
- After a trip is shortened, an expense keeps its old date (the confirm dialog warns about this).
- `renderEditor` builds the `#day` select only from trip days, so no option is selected and the browser shows the first option, "Whole trip".
- `d.date` is unchanged unless the parent touches the select, so saving keeps the old date while the form says "Whole trip".
- The fix is to add an option for the existing date, or show it as "outside the trip".

**3. LOW: a refresh after a queued expense sends wipes typed text on the Families tab.** Reasoned from the code.
- `sendWaiting()` calls `refresh()` whenever a queued item sends, and `refresh()` re-renders the whole current tab.
- If the parent is typing in the trip-details form or the family search box at that moment, the typed text is replaced by the server values.
- It needs a queued item plus the 30-second timer landing during typing. Rare, and short fields.

## Checked and fine

- Shares: I ran a meal with families A:2, B:1 on $10.00 (667/333) and a coach hotel of $120 split by fencing days 2:1 (8000/4000). Balances netted to zero and the single treasurer payment was correct.
- Stale-rev edit: refused with `expense_changed`, and the other phone's edit was kept.
- Family id reuse: I deleted family 5 (the newest id) and added a new family, which got id 5. The meal's split lost key 5 via `json_remove`. A save that carries the old family's tag for id 5 is refused with `family_changed`. A family that paid for an expense cannot be deleted (409).
- Finalize with stale numbers (seen_activity 0) is refused. Finalize with the current numbers writes payments.
- Offline queue: waiting items carry the family tags and the `client_key`. A resend after a lost reply comes back `already`, so no double add was found.
- PDF: summary and statements are built from the same `balances`/`shares` functions as the screens.

## Known and accepted (not reported as findings)

- A waiting expense that arrives after finalize is refused and shows as "Couldn't send" only on the payer's phone (saving design v4).
- Shortening then lengthening a trip does not bring fencing days back (warned in the confirm dialog).

## Method and state

- I ran a local API scenario (`scratchpad/rl13/probe/flow.mjs` and `reuse.mjs`, outside the copy) and read `src/index.ts`, `public/app.js`, `public/split.js`, `public/pdf.js` and the migrations. The UI-only findings (1 to 3) are from code reading, not a browser run.
- The dev server is stopped. Port 8882 is free, and no wrangler process or listener remains.
