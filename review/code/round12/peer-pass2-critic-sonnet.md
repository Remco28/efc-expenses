Review of plan-v2 against the code. Read-only. I read src/index.ts (treasurer route, expense PATCH/DELETE), and public/app.js (volunteerSheet, saveExpense, renderEditor, draft storage, waiting queue). I did not examine pdf.js closely; the wording items are only commented on in general.

## Item 1: treasurer saves match the trip state

Would it fix it? Yes. It fixes the real bug I can see today. A "notes only" form opened on a final trip, then sent after a reopen, falls into the open-trip path. There `tname` is empty, so the server removes the treasurer and wipes the notes. The reverse race also exists today: a full form sent to a final trip silently writes only the notes. The plan closes both.

**It breaks something that works: the "Step down as treasurer" button.**
- That button sends `{treasurer_name: ""}`.
- It has the key, but the value is empty. The rule "a request without `treasurer_name` is notes-only" must test whether the key is present, not whether the value is truthy.
- A test of the value would refuse step-down on every open trip, or treat it as notes-only. Say "key present" in the plan.
- Step-down on a trip finalized a moment ago must also come back as "finalized", not as "out of date". The plan only says that for the open-trip save.

**Gaps and loose ends**
- **Old cached pages.** A cached old page that sends the full form to a final trip is now refused, which is fine. The reverse needs no change.
- **Status check in the write.** The `status = 'final'` guard in the UPDATE is a real improvement. The final branch today has no status or deleted check at all. Also check `deleted_at IS NULL` there, as the open branch does.
- **"Notes only written while a treasurer is set."** This is nearly redundant. Finalize requires a treasurer and reopen keeps it. The only way to get a final trip with no treasurer is odd state. It is harmless but could be dropped. Keep it only if it costs one `AND treasurer_name IS NOT NULL`.
- **Reload after refusal.** In `volunteerSheet`, `act()` rethrows on error, so `refresh("treasurer")` is skipped. After "Reload." the user is left on the stale tab, still showing the old form's trip state. Refresh the trip on this refusal automatically. That is cheap and is what makes the message actionable.

**More than needed: "a full-form request without `treasurer_family_id` keeps the family".**
- The current page always sends that field, as a select with "" for "Not on this trip".
- No live client omits it. Only a hypothetical older page would.
- Keeping the family also needs a second UPDATE shape (the column left out of the SET) and a new meaning for absent versus "". The family uid check (`tname && uid mismatch`) is also tangled up with it.
- It adds code paths for a case I can't find. I'd drop it, or confirm that older pages really exist. Cached pages on a phone are the only possibility, and they send the field.

## Item 2: an expense edit refused because the expense changed

Would it fix it? Yes. Today the 409 on a revision mismatch tells the user to "go back and open it again", which throws away the draft.

**Error codes are not clean enough.**
- The same 409 family covers several causes. These are the revision mismatch at line 767, the receipt replaced at 773, and the catch-all at 788 ("expense or the trip just changed").
- The catch-all fires when the revision moved between the read and the write, when the trip closed, and when the created_at changed.
- The plan only names the first case and the deleted cases.
- The write-time race (revision moved after the check) is the most likely one in practice. It needs `expense_changed`, but only when the trip is still open and the id/created_at still match. Otherwise the client reloads on a closed trip.
- The "receipt replaced" refusal at 773 should probably also be `expense_changed`. The rebuild would then pick up the other person's receipt, since its key is now current.
- Delete uses the same revision check, so delete refusals need the same codes.

**Misleading wording on the user's own lost-reply save.**
- The server message says a stale revision may be "an earlier save of yours that went through".
- The `same` check handles an exact resend. A resend with a further edit fails the check.
- The rebuild will then say "Someone changed X". The other "someone" is the parent's own earlier save.
- The "you both changed the amount; yours is shown" message will also fire on their own earlier edit.
- It's harmless for data, but the wording will confuse. Use a neutral "This expense was changed since you opened it" when you can't tell who. Or compare against what the parent last sent.

**Merge rules that will bite.**
- **Basis, category and split are one unit.** The plan lists "kind", "who took part and head counts" and others as independent fields. They aren't. `split` means different things under different bases. Opening a draft with an unknown basis already wipes the split (renderEditor, around line 958). Picking a category also sets a default basis.
- If the other person changed the basis and the parent changed the split, applying the parent's split under the new basis is wrong. If the parent changed the category and the other changed the basis, the result is unclear.
- Treat category + basis + split as one group: if the parent changed any of them and the other person changed any of them, keep the parent's group whole or ask. Don't mix.
- The comparison against `base` must also be a deep compare on `split`, and `amount` is stored as a string in the draft versus integer cents in the expense.
- **Families that vanished.** The rebuilt draft must go through the existing family-tag check in renderEditor (lines 935-950), so a payer or tick for a removed family is dropped with that toast. The plan's "rebuild the form from the current expense" bypasses this unless it reuses that code path. Mention it.
- **Receipt.** If the parent removed the receipt and the other person replaced it, the plan picks the parent's. That is fine, but the receipt the other person uploaded then becomes an orphan. Does the server clean that up? Likely, since PATCH calls dropReceipt on the old key. The parent's newly uploaded temporary key must still exist (line 773 checks it).

**Kept-draft storage is a single slot.**
- `DRAFT = "efc-draft"` holds one draft, matched by trip and id, not by created_at.
- "Updated straight away" is fine. But "when reopened and its revision is behind" must also compare created_at, because ids are reused after the newest expense is deleted.
- A kept draft from before `base` existed falls back to the current version, which discards the parent's changes. That is stated, and acceptable.

**Over-engineering to watch.** Naming what the other person changed in plain words, per field, is the bulk of the new code and is not needed to make the draft survive. The safe core is: reload, rebuild from current, re-apply the parent's changed fields, and a generic message. The per-field phrasing and "you both changed" wording could be one generic sentence.

## Item 3: a refused save the parent has left

Would it fix it? For new expenses, yes. `holdExpense` and the "Couldn't send ... Open it to fix" path already exist. Reusing `refused` is a small change.

**Gaps**
- **Single-slot draft for the edit case.** After leaving, `S.draft` is null or another form. Writing the refused edit into `efc-draft` would overwrite a newer draft the parent has since started. Decide what wins. Say that explicitly. The simplest rule is to not clobber, and show only the message.
- **The pre-check can also fail.** The `GET /tournaments/:id` fresh check, before the PATCH, can fail with a non-unsure error (for example, trip deleted). Then `thaw(); toast(e.message)` runs and the save is lost for a form already left. Item 3 only says "the server refuses it". It should say the same applies to this earlier step.
- **A refused body may be unfixable.** A waiting entry for a trip that is now final or deleted will always be refused. This is how it already behaves, so the rule is consistent. But after "Open it to fix" opens the form on a final trip, `renderEditor` redirects to the list (line ~925). Check that "Remove" is reachable from the waiting card in that case; line 1515 suggests it is.
- **Back on a half-typed new expense.** Leaving item "Not changed" alone is right and consistent: a Save press followed by Back is intent, a Back alone is cancel.

## Wording and records
- PDF items and the family-removal confirmation are low risk and independent of the rest. Check that the "rounds to 0 cents" row still shows in the per-expense table, not only the family summary.
- The confirmation text is accurate: removal drops the family from expense splits and revisions bump.

## What holds up
- Deciding by request content, plus checking status inside the UPDATE, is the right fix for both races. It avoids a read-then-write gap.
- A single refusal message and code per cause, and reload-then-merge for expenses, is the right shape.
- Reusing the waiting queue for item 3 is the smallest correct change for new expenses.
- Leaving Back as cancel is consistent with the rest.

## Summary of what I'd change in the plan
1. Item 1: test key presence, so step-down keeps working; add "finalized" wording to step-down; auto-refresh after refusal; drop or justify the missing-family-id rule; add `deleted_at` to the final UPDATE.
2. Item 2: give the write-time race and the receipt-replaced refusal the `expense_changed` code (only when trip still open and ids match); group category/basis/split; reuse the family-tag check; compare created_at in kept drafts; use neutral wording when the change may be the parent's own earlier save.
3. Item 3: cover the pre-check failure; define what happens to the single draft slot for a refused edit.
