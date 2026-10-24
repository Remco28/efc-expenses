Review of the plan for the six problems. I read only the copy under scratchpad/prefix (public/app.js, src/index.ts, codex-report.md) and changed nothing. Line numbers are approximate.

Short version: the plan is sound for all six, and its fixes are close to minimal. Three things it gets wrong or misses: (a) problem 3 rests on a claim that the server already refuses mismatched tags, which is only partly true; (b) problem 2's "unfreeze on every exit" list misses cases, and the freeze is an element flag that survives redraws; (c) the same check-then-write gap exists in expense saves and the treasurer save, which the plan does not cover.

1. Late refresh (loadTrip, app.js ~287; famSave ~797; fencingSave ~901)
- Fixes it. The guard has to run before S.trip is assigned, and the plan says so. refresh() already does this correctly, so the pattern is consistent.
- Watch what the guard compares. famSave's check reads S.trip.tournament.id at check time, which is whatever show() last loaded, not the trip the save started on. Capture the trip id and route when the save starts.
- Breaks nothing I can see. Nothing else needs changing: the write handlers use the trip id captured when their sheet opened (volunteerSheet does), so they are not exposed.

2. Save's first check (saveExpense ~1212-1274)
- Fixes the lost correction. Freezing before the first await is the simplest correct fix.
- The plan's exit list is incomplete, and the freeze is the #app element's inert flag, which survives innerHTML redraws. Every exit must clear it: a 401 on the first check (renderLogin would otherwise show a frozen login form); holdExpense returning false (the form stays frozen with only a toast); the "who's on the trip changed" redraw; a plain error toast. The existing code already has the 401 case wrong during the POST (it returns to renderLogin without unfreezing), so the plan would extend that bug to the check.
- Leaving during the check is a gap the plan does not address. show() clears inert on any route change, so a browser back during the check is possible. saveExpense then hits "if (S.draft !== d) return" before the POST and drops the expense silently. That is pre-existing, but the plan's wider window makes it more reachable. The plan should say whether the save continues anyway (the parent did press Save) or the parent is told it did not save.
- Not more than needed.

3. Reused family numbers in a kept form (saveExpense, drawSplit, renderEditor, keptDraft)
- The plan's central claim is wrong: "the server already refuses a tag that doesn't match" holds only partly. For a split, the server reads family tags with a SELECT, and then the INSERT or UPDATE checks only that the numbers exist, so a replacement between the two is still charged. This is the same check-then-write gap as problem 6.
- The payer tag is checked only on a new expense (POST, ~703). Edits (PATCH) never send paid_by_uid and the server never checks it. An edit whose payer pick sits on a reused number charges the replacement. The plan has to add paid_by_uid to edit bodies and check it on PATCH too.
- After a server 409 ("a family ticked on this was removed"), the draft keeps the stale remembered tag. Every Save resends it and gets 409 again until the parent unticks and reticks the family. The plan clears picks only on reopen. Clearing must also happen on that 409 and on the whoIs-changed redraw.
- Legacy drafts with no remembered tags get cleared with "Some families on this expense changed", though nothing may have changed. Safe, but the message is misleading for those; say so or word it differently.
- The refused-expense path ("Open it to fix", rewait ~1446) already drops replaced families silently using same(). The plan's message should be used there too for consistency. same() also passes bodies with no split_uids unchecked, which is the same legacy hole.

4. Name vs Fencer (src/index.ts, person PATCH ~668-673)
- Fixes it, and it is minimal. Watch the existing fallbacks: str(undefined) gives an empty string, and "|| p.name" then writes the stale name. Unsent fields must be passed as null and kept with COALESCE or CASE in the SQL.
- Two concurrent name edits still go last-writer-wins. That is ordinary and acceptable; the plan does not claim otherwise.
- The activity-log text uses the stale name; cosmetic.

5. Treasurer vs fingerprint (loadTrip, src/index.ts ~167-181)
- Fixes it. The fingerprint already covers the treasurer, so reading the row inside the batch is right, and finalize (which calls loadTrip) benefits too.
- The response must return the batch's tournament row, not the first-check row. "Keep a first check" could be read as keeping the old read as the one returned.
- If the trip is deleted between the two reads, the batch row carries deleted_at. It needs the same 404 the helper gives, or a deleted trip comes back as normal. The first check is then redundant but harmless.

6. Person into a replaced family (POST /families/:id/people, ~626-637)
- Fixes it, and matches the uid-in-WHERE pattern already used on person PATCH/DELETE and family DELETE.
- The insert returns nothing when the family check fails, and the code then throws closed(), which says the trip was finalized, deleted or re-dated. The plan's "screen is out of date, reload" needs a separate check that picks the message.

Same problem, not covered by the plan:
- Expense saves. Payer and split tags are checked by SELECT before the write, and the INSERT or UPDATE only checks numbers (POST ~700-706; PATCH UPDATE ~745). Same remedy as problem 6: put the tag condition in the write.
- Treasurer save (PUT /treasurer, ~526-549). It checks the family's kind by number and then writes the number, with no tag. A family replaced on that number becomes the treasurer. Lower likelihood, since the parent must pick from a list and the replacement must land in the window.
- The 401 path in saveExpense (see item 2), which predates the plan.

What holds up:
- The root cause in each of the six matches the code and the reviewer's reproductions.
- The uid-in-WHERE pattern is already the codebase convention for families and people, so the fixes for 4 and 6 follow it.
- Nothing in the plan looks like gold-plating, except that the clearing on reopen (item 3) is blunt, and the first check in item 5 is redundant.
