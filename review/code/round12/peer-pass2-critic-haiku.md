Review of /home/frank/Dev/efc-expenses/review/code/round12/plan-v2.md, checked against src/index.ts, public/app.js and public/pdf.js. Nothing was changed or run.

Short version: the three big items each fix a real bug, but item 1 has a gap that would break the "Step down as treasurer" button, and item 2 misses a case where it would tell the parent that someone else made changes that were really their own. Several "same problem elsewhere" spots are not covered.

**1. Treasurer save (server PUT /tournaments/:id/treasurer)**

What holds:
- The reverse race is real today. A full treasurer form sent after the trip was finalized is silently accepted as notes-only and logged as "updated the treasurer's payment notes". The name change is dropped with no error. Refusing a mismatch fixes this.
- A worse case the plan does not name: a notes-only request (from a payment-details form opened on a final trip) that reaches an open trip (because it was reopened in between) is treated as "no name", so the server clears the treasurer name, family and notes. Refusing notes-only requests on an open trip fixes this.
- The UPDATE already has `status = 'open'` for the open-trip branch. The plan's "status checked in the write" is therefore mostly already true for that branch. The new part is the final-trip notes write, which has no status check today.

What breaks or is unclear:
- The "Step down as treasurer" action sends `treasurer_name: ""` and no family id. The plan says a full-form request without `treasurer_family_id` keeps the family. Applied to this request, the family would stay set while the name is cleared. The settle-up code (public/app.js around line 1330) passes `treasurer_family_id` to the payment plan without checking the name, so the settle-up numbers would still count a treasurer that no longer exists. The keep-the-family rule has to apply only when a non-empty name is sent. Removal must clear the family explicitly.
- The mismatch rule has to test whether the key is present, not whether the value is truthy. Removal sends an empty name, and that must count as "full form".
- The refusal says "Reload", but the treasurer sheet closes on submit (public/app.js around line 1479), so any typed notes or name are lost. This is the same problem item 2 fixes for expenses, and the plan does not carry it over here.
- Only the open-trip branch with a family uid mismatch uses the "out of date" message today. The plan's wording fix for a finalize-just-before-save case only changes the `sameFam` branch. Make sure the test covers both.

**2. Expense edit refused because the revision changed**

What holds:
- The client does nothing useful today on a revision refusal (a toast only), so reloading and rebuilding is a real improvement.
- The existing "same edit sent again after a lost reply" check (server: rev one behind, same fields) must keep working. The plan does not mention it. Its rebuild must not turn a retry into a refusal.
- The 404 on a delete is currently treated as success by the client ("deleted" on a retry). The plan adds a code to that 404. The delete handler's 404 branch must stay, or a delete retry will start showing an error.

What breaks or is misleading:
- The message attributes every difference between the parent's opened version and the current version to "someone" on another phone. If the parent's own earlier save went through but its reply was lost, the parent is the one who changed it. The message would then blame another person for the parent's own change. The plan should say what it does in that case, or at least not name the other person.
- Fields are not independent. The split basis is set by the category, and the split is only meaningful for the basis it was made under. Re-applying the parent's category or split changes from "base" on top of the other person's version could produce a basis and split that do not match. The plan should say that category, basis and split are re-applied as one unit.
- The server checks the trip is open before it checks the expense's id and creation time. On a finalized trip, the "deleted on another phone" case shows the finalized message first. This is minor, but the plan says it covers the reused-id case without mentioning this.
- Is it more than needed? Mostly no. The merge is the heavy part. A simpler version (reload, show the current version, and show the parent's old values beside it) would be easier to build and test. That is a judgment call, and Frank has already agreed to this one.

**3. A refused save after leaving the form goes to Waiting**

What holds:
- Today a refused save from a form the parent has left is lost with only a toast, so this is a real fix.
- The queue already has "Couldn't send" and "Open it to fix", so the plan reuses existing machinery.

What to check:
- A new expense refused because the trip was finalized in the meantime goes to Waiting with "Couldn't send". It cannot be fixed until the trip is reopened. The queue never retries refused items. This is consistent with existing behavior, but the message should say the trip is finalized, not just show the server text.

**Items the plan does not cover (the same problem, left out)**
- Trip details (dates and name, public/app.js around line 667): the sheet closes, the save is refused with the generic "out of date" error, and the typed text is lost. Server line 428 returns the same stale error.
- Family and person edits (server lines 607, 653, 680 use the same generic stale error). I did not check the client flows for these in full. The plan should say whether they are in scope.
- The treasurer sheet (see item 1 above).

**Wording and records (round 12 LOWs)**
- PDF zero-cent shares: confirmed. The statement list filters on the share value being truthy, so a share of 0 cents is dropped. Changing the test to "is present" fixes it. The "Not included in any expense" line will change with it, so check that case too.
- The family-removal confirmation, the late-families comment, and the fencer-mark note are text-only and low risk.

**Overall**
- Holds: items 1 and 3 fix real bugs, the PDF zero-share fix is correct, and the wording changes are cheap.
- Breaks or needs fixing before code: removal of the treasurer and its family (item 1), and key-presence versus empty-value for the mismatch rule (item 1).
- Misleading: "someone else changed this" when the parent's own earlier save landed (item 2).
- Left out: the same lost-input problem in trip details, family and treasurer edits.

Relevant files: /home/frank/Dev/efc-expenses/src/index.ts (treasurer PUT around lines 545-570, expense PATCH/DELETE around lines 750-800, stale/closed helpers around lines 150-151), /home/frank/Dev/efc-expenses/public/app.js (treasurer sheet around lines 1462-1481, saveExpense around lines 1248-1320, waiting queue around lines 1199-1230, delete around line 1551), /home/frank/Dev/efc-expenses/public/pdf.js (statement filter around line 207).
