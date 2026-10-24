**Problem 1: notes-only save wipes the treasurer**

Cause: in `src/index.ts`, the PUT `/tournaments/:id/treasurer` handler uses the trip's status to decide what the request means. The helper `str()` turns a missing `treasurer_name` into "". On an open trip, "" means "remove the treasurer" (the `tname` branch). So a notes-only request that lands after a reopen clears the name, the family and the notes. The client sends `treasurer_name: ""` explicitly for "Step down", so a missing name and an empty name can be told apart.

Simplest right fix (server only): decide by what the request contains, not by status.
- If the body has no `treasurer_name` field at all, treat it as a notes-only update. Update only `treasurer_notes`, and guard the write with "a treasurer is still set" (`treasurer_name IS NOT NULL`). If no row changes, return the existing `stale()` refusal.
- Only run the full open-trip logic, including removal, when `treasurer_name` is actually present in the body.
- The final-trip branch becomes the same notes-only path, so I'd merge the two.
- Notes-only works the same on an open or a final trip, so the race goes away in both directions. A full save arriving after finalizing is already refused by the `status = 'open'` check.

Cost: a few lines in one handler. No client change and no migration.

What it might break: an old cached page that sends a full form always includes the name, so it behaves as before. Step-down still sends `""` and still removes. One edge case: a notes-only save that arrives after someone else removed the treasurer now gets "out of date, reload". That is correct, and better than writing notes onto a trip with no treasurer.

Same problem elsewhere: not that I found.
- The family and person PATCH handlers read fields the same way, but they check `uid` and handle each field separately. I didn't confirm they never clear a field when it's missing.
- The trip PATCH (`/tournaments/:id`, around line 416) is worth a quick check that a missing field isn't read as "".
- The general rule to hold to: a missing field must never mean "clear it".

**Problem 2: refused edit leaves the form permanently stale**

Cause: the form carries the `rev` it opened with. After a 409 for a changed expense, nothing refreshes the form. The client only has recovery code for `family_changed`, which reloads the trip and redraws. The "expense changed" 409 has no code, so it just shows a toast. The unsent edit is also saved in the browser tab's session storage (the `efc-draft` key), and `renderEditor` restores it unchecked. That is why a reload brings the same stale form back, and why Back loses the typing.

Fix, modelled on the existing `family_changed` handling:
1. Give the server's rev-mismatch 409 its own code (say `expense_changed`). Do the same for the "receipt was replaced" 409, which has the same trap.
2. In `saveExpense`'s catch, for that code, reload the trip and redraw the form, as the `family_changed` branch does. Redrawing is what refreshes the `rev` the next Save sends.
3. Do not just copy the new `rev` onto the form. The PATCH sends every field, so Save would silently overwrite B's change with A's old values for fields A never touched. That is a lost-update bug dressed up as a fix.

For what to put in the redrawn form, there are two options:
- **Simplest and safe:** rebuild the form from the current expense and tell A: "Changed by <name> while you were editing. Here's the current version. Make your change again." A's typing is lost, but nothing is overwritten by accident.
- **Kinder, a bit more code:** store a copy of the fields as the form opened (`d.base`). On a refusal, keep the fields A actually changed (those that differ from `base`). Take everything else from the fresh expense, set the new `rev`, and tell A to check and save again. Drafts kept in session storage before this change have no `base`, so they fall back to the simple option.

I'd ship the simple one unless losing the typed text is a real complaint. The text is usually a description or an amount, so re-typing is cheap.

Also make `renderEditor` check a kept edit-draft: if `draft.id` is set and `draft.rev` or `created_at` differs from the expense now in the trip, treat it as stale in the same way. This fixes the reload case, and a draft left open a day. If the expense was deleted, it already redirects to the list. In that case drop the draft too, so it isn't offered again.

Cost: one error code on the server, one branch in the client, and a small stale check in `renderEditor`. No migration.

What it might break:
- Redrawing while A is typing can move focus. The branch only runs after the Save press, while the form is frozen, so this is minor. Remember to unfreeze (`thaw`) first, as the existing branch does.
- A's lost-reply case still works. The server's "same edit sent again" check returns OK before the 409, so it never reaches this branch.
- With the merge option, a change by A and B to the same field resolves in A's favour. That is arguably right, since A saw the warning.

Same problem elsewhere:
- Expense delete uses the same rev check, but it has no form, and its message already says "open it again". It is fine.
- The create path has no rev. A refused create (`family_changed`) already redraws, so it is covered.
- Family and person edits use `uid` and save one field at a time (`famSave`), so they have no long-lived form to go stale.
- The trip-edit form (`tripedit`) sends `seen_start` and `seen_end`. If it is refused as stale, it relies on the generic "Reload" toast. It re-renders from the trip on refresh and holds no session-stored draft, so it is less trapped, but it deserves a look.
- The treasurer sheet is rebuilt from the current trip each time it opens, so it has no stale state to keep.

Files read (inside rl12/rules): `public/app.js` and `src/index.ts`.
