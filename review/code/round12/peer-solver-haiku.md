I read problems.md, then the relevant parts of src/index.ts and public/app.js. I changed and ran nothing. The only other access was a find listing the rules folder.

## Problem 1: notes-only treasurer save on a reopened trip wipes the treasurer

**Cause.** On a final trip the sheet sends only `treasurer_notes`, with no `treasurer_name` key. The server's PUT /tournaments/:id/treasurer handler checks the trip status it read a moment earlier. Once the trip is open, the handler takes the open branch, where `str()` turns the missing name into "". An empty name means "remove the treasurer", so name, family and notes are all cleared, and the client shows "Saved". The Step-down button sends `treasurer_name: ""` on purpose, so the server cannot tell "removed" from "never sent" by value alone.

**Simplest right fix (server only, about 3 lines).** In the open branch, if the request has no `treasurer_name` key at all, refuse with the existing "screen is out of date, reload" error (the `stale()` helper). Keep Step-down as it is, since it sends an explicit empty name. Also make the notes-only write on the final branch conditional in SQL (`AND status = 'final'`), so a reopen that lands between the read and the write cannot be overwritten silently. The families PATCH handler already uses this idea: it checks `!= null` before touching a field.

**Cost.** Very small. No client change and no migration.

**What it might break.** Nothing in app.js relies on a PUT with no name clearing the treasurer. A stale client that sends notes-only to a reopened trip now gets a visible refusal, which is the intended result.

**Elsewhere.** The same trap exists wherever `str(b.x)` is written without a presence check. The people and trip PATCH handlers already fall back to the old value via COALESCE, so they are fine. The treasurer PUT is the one I found that treats a missing field as a blank value to write.

## Problem 2: a stale expense edit is refused forever

**Cause.** The editor holds the `rev` it opened with. The PATCH handler refuses any save whose `rev` differs from the row's. On that 409, saveExpense only shows a toast. It never refreshes the draft, so every Save sends the same old rev. The draft is also kept in sessionStorage with that old rev, so a reload brings back the same stale form. The `family_changed` case is different: it reloads the trip and redraws the same draft, and that is the pattern to copy.

**Options.**
- (a) On the rev 409, reload the trip and set the draft's `rev` and `created_at` to the current row. Keep A's typed fields and show "B changed this expense, check it and save again". Client-only, about 10 lines. The risk is that A's Save silently overwrites B's change in fields A did not look at.
- (b) Same reload, but rebase field by field. Compare each field against the copy the form opened with. Fields A did not change take B's current value. Fields A did change stay as A typed them. Then tell A which fields moved. Still client-only, about 25 to 30 lines. It needs care with the split and tags, and one edge case: if A sets a field back to its original value, it counts as untouched. I would take (b).
- Not recommended: a server-side field merge. It is bigger than the problem needs and changes the refusal the server is designed to make.

Whichever you pick, update the kept draft too (keepDraft writes on each input, so updating the in-memory draft is enough). Otherwise reopening still shows the old rev. I did not fully trace what Back does to the draft, so check that path before you call it fixed.

**Elsewhere.** Yes, the same stale-version pattern shows up in several places:
- Delete expense: it sends the rev from the trip or draft. On 409 it only toasts, so it repeats until the trip is reloaded.
- Finalize: it sends `seen_activity` and `seen_fingerprint` from the trip screen. On 409, `act()` only toasts, and the retry uses the same stale values.
- Treasurer sheet family tag: the sheet is built from the stale trip, and `stale()` loops the same way.
- Trip dates (`seen_start` and `seen_end`): I did not trace the client handling.
- Families screen: it is fine. `famSave` reloads the trip after every save, including failures, so it self-heals. That is the model to copy.

The cheapest general fix is to reload the trip on any "out of date" 409 before showing the message. That covers all the cases above in one place. Its cost is an extra fetch on each conflict, and in the expense editor the draft has to survive the reload, which (a) and (b) already handle.

Which do you want for Problem 2: (a), (b), or the general reload-on-conflict? I would fix Problem 1 on the server as described either way.
