# Round 12 plan v2 (after four peers and the disposition audit; Frank agreed to each choice)

## 1. Treasurer saves only work on the trip state their form was drawn for
- The full form (opened on an open trip) sends the treasurer's name, family and notes. The payment-details form (opened on a final trip) sends notes only.
- **The server decides by what the request contains, and refuses a mismatch**: a request without `treasurer_name` (notes only) on an open trip, or a request with `treasurer_name` on a final trip, is refused with "This trip changed since you opened this. Reload." This also stops the reverse race (a treasurer change silently ignored because the trip was finalized just before Save).
- The status the server acts on is checked in the write itself (`status = 'open'` / `status = 'final'` in the UPDATE), so a reopen or finalize landing between the read and the write is refused, not mis-applied.
- On a final trip, notes are only written while a treasurer is set (in the UPDATE).
- A full-form request without `treasurer_family_id` (an old page) keeps the family as it is rather than clearing it; "Not on this trip" stays an explicit empty value.
- The open-trip treasurer save on a trip finalized a moment ago says "finalized", not "out of date" (round 12 row 5).
- The log line names what happened ("updated the treasurer's payment notes" for notes).

## 2. An edit refused because the expense changed keeps the parent's own changes
- The server gives the refusal a code: `expense_changed` for a revision mismatch, `expense_deleted` for a deleted expense (the 404, and the reused-id "deleted on another phone" 409).
- The form remembers the expense as it was when opened (`base`: every saved field).
- On `expense_changed` (and only if still on that form): reload the trip; find the expense by id **and** creation time. If it's gone: "This expense was deleted on another phone", drop the draft, back to the list. Otherwise rebuild the form from the current expense, then re-apply only the fields the parent changed from `base` (amount, description, vendor, date, kind, payer, who took part and head counts, receipt). Everything else, including a receipt the other person replaced, comes from the current version. The form now carries the current revision, and `base` becomes the current version.
- The message names what the other person changed, in plain words, and what was kept: "Someone changed the date and the amount while you were editing. Your description is kept. Check it and save." When the parent and the other person changed the same field, the parent's value is kept and the message says "you both changed the amount; yours is shown".
- The kept draft (session storage) is updated straight away, so a reload doesn't bring the old revision back. When a kept edit draft is reopened and its revision is behind the expense's, the same rebuild runs.
- Delete from the editor after such a refusal uses the refreshed revision; a stale delete gets the same message and reload.
- A draft kept before this change (no `base`) falls back to the current version, with "This expense changed while you were away. Check it and make your change again."

## 3. A save the parent walked away from, then refused, isn't lost
- If the form was left during a save and the server refuses it (any app refusal, not "no answer"), the expense goes to "Waiting to send" as "Couldn't send", with the reason and "Open it to fix", like a refused waiting expense. An edit that can't be kept that way (it names an existing expense) keeps its draft instead, and the message says so.

## Not changed
- Back on a half-typed new expense discards it (Frank: Back is how the form is cancelled).

## Wording and records (round 12 LOWs and the audit)
- The PDF: a share that rounds to 0 cents is still listed; the totals line explains an expense nobody is splitting; the fencer mark's note says "ticked as Fencer".
- The family-removal confirmation says the family comes off every expense it was ticked on.
- The comment about late families says shares follow the fencers live.
