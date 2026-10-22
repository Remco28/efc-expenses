## Objective
- Produce a second-round, read-only code review of EFC Trip Expenses reporting only real defects, max 15, most severe first, in the user’s exact format.
- Focus: migrations `0001-0006` on existing data, `src/sandbox.js` + reset endpoint, soft-delete/purge, and `public/pdf.js` layout logic; also verify whether first-round fixes are incomplete.

## Important Details
- Repository: `/home/frank/Dev/efc-expenses`.
- Do NOT modify/create/delete repo files, run the app, or make network calls. Read-only review.
- First-round findings are fixed in commit `039b993`; do not re-report them, but incomplete fixes are valid.
- First-round reports: `review/code/codex.md`, `grok.md`, `agy.md`, `README.md`.
- Deliberate non-bugs: shared access code, unverified `x-user-name`, split semantics (`null`/number/`0`), staff never share, one treasurer, 30-day soft delete with lazy purge, 10 ms Worker CPU limit.
- Required final format:
  `### <title>` then `- Severity`, `- Where: <file>:<line>`, `- What goes wrong`, `- How to trigger it`, `- Evidence`.
- Keep final answer short; “Nothing found” is acceptable; do not pad with style/refactor/test suggestions.
- Migrations were test-run in `node:sqlite` via `/tmp/opencode/mig.mjs`; all apply cleanly. Reproduction confirmed `0005` preserves out-of-range legacy days.

## Work State
### Completed
- Read `migrations/0001-0006`, `src/sandbox.js`, `src/index.ts`, `public/pdf.js`, `public/split.js`, relevant `public/app.js`, tests, first-round reports, and git history.
- Verified candidate findings:
  - **High — purge/restore race incomplete:** `purgeTrip` rechecks deleted state at `src/index.ts:81-84`, but after R2 deletion it unconditionally deletes payments/expenses/families/activity at `src/index.ts:92-95`; only the tournament row delete is guarded at `src/index.ts:96`. A restore landing after the recheck leaves a restored but emptied trip.
  - **High — finalize race incomplete:** `src/index.ts:383` second `lastChange()` check cannot see an in-flight write that passed `openTournament` before finalize but inserts/logs after the check. Frozen payments can omit the new expense.
  - **High/medium — legacy shortened-trip attendance never migrated:** `migrations/0005_family_days.sql:8-14` unions old `people.days` without clamping to `tournaments.start_date..end_date`; `src/index.ts:341-352` only prunes on future PATCH. `public/split.js:36-40` still counts unfiltered `person.days`, so old dropped days keep charging per-fencer/per-fencer-day costs; final trips stay wrong.
  - **Medium — balance totals still overstate unsplit expenses:** `balances` skips zero-share expenses at `public/split.js:106`, but Settle total still uses `total` at `public/app.js:1074`; PDF has same issue at `public/pdf.js:182`.
  - **Medium — soft-deleted trip still writable via payments:** `PATCH /payments/:id` in `src/index.ts` does not call `tournament()`/`openTournament()`, so a payment on a deleted trip can still be patched.
  - **Medium — PDF attendance day loop unbounded:** `public/pdf.js` builds every day from `start_date` to `end_date` with no 60-day cap (around lines 237-240). A long/typo date range makes export hang/freeze.
  - **Low/medium — sandbox reset non-atomic:** `resetSandbox` in `src/index.ts` sequentially deletes R2/DB rows then inserts families/people/expenses. Concurrent resets can duplicate seed data or leave a partial practice trip.
- No repo files were changed. A temporary migration test script was written outside the repo.

### Active
- Drafting the final review answer; candidate list is verified but final ordering/wording and exact line numbers for a few routes still need confirmation.
- Decide whether to include the sandbox reset concurrency finding or omit it as practice-only/low impact.
- Possibly note but likely omit: unguarded `embedPage` for malformed/encrypted PDF receipts; legacy invalid `BASES` values from before the prototype-name fix.

### Blocked
- Exact line number for `PATCH /payments/:id` was not captured in visible output; grep before final.
- Exact line numbers for the PDF day-range loop may need a quick grep to avoid an off-by-one citation.

## Next Move
1. Run grep for exact lines: `grep -n "payments/\\|lastChange\\|const days = \\|for (let d = utc\\|if (!s.total) continue" src/index.ts public/pdf.js public/split.js public/app.js`.
2. Write the final formatted report with the strongest 5-7 findings, most severe first; include the incomplete-fix framing where applicable and quote the relevant code.

## Relevant Files
- `src/index.ts`: `tournament()`, `purgeTrip`, `purgeExpired`, finalize/race check, reset-sandbox, payments/family/expense routes.
- `migrations/0005_family_days.sql`: family-days backfill and `own_days` migration; missing date-range clamping.
- `migrations/0001_init.sql` … `0006_staff.sql`: schema history.
- `src/sandbox.js`: practice-trip seed data.
- `public/pdf.js`: PDF layout, totals, attendance grid, receipt pages.
- `public/split.js`: `autoUnits`, `balances`, `shares`, caps.
- `public/app.js`: Settle balances total at `1074`, PDF export trigger, reset UI.
- `test/split.test.mjs`: current split/balance expectations.
- `review/code/*.md`: first-round findings to avoid duplicating.
Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.
### Purge can still erase a trip restored during the purge
- Severity: high
- Where: `src/index.ts:92`
- What goes wrong: The first-round fix rechecks the trip only once, before the R2 deletion loop. The payment/expense/family/activity deletes are then unconditional. If a restore lands after that recheck, the tournament row is kept because the final delete requires `deleted_at IS NOT NULL`, but its children are already gone; the user gets a successfully restored, empty trip.
- How to trigger it: Delete a trip with receipts, wait 30 days, then trigger the trip list in one tab and restore the trip in another. If the restore happens after line 82’s recheck but before line 91’s batch, restore still succeeds but the data is gone.
- Evidence:
  ```ts
  // src/index.ts:81-84
  const still = await env.DB.prepare("SELECT 1 FROM tournaments WHERE id = ? AND deleted_at IS NOT NULL AND deleted_at < ?")...
  if (!still) return;

  // src/index.ts:91-96
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?")...
    env.DB.prepare("DELETE FROM expenses WHERE tournament_id = ?")...
    env.DB.prepare("DELETE FROM families WHERE tournament_id = ?")...
    env.DB.prepare("DELETE FROM activity WHERE tournament_id = ?")...
    env.DB.prepare(`DELETE FROM tournaments WHERE id = ?${deletedBefore ? " AND deleted_at IS NOT NULL" : ""}`)...
  ]);
  ```

### Finalization can still freeze payments that omit a concurrent expense
- Severity: high
- Where: `src/index.ts:383`
- What goes wrong: The first-round fix checks `MAX(activity.id)` only after the finalize batch. A write that passed `openTournament` before finalization can insert an expense after `loadTrip` and write its activity row after this check. Finalization then succeeds with payments calculated without that expense. The same window allows a deleted expense or changed amount to be missed.
- How to trigger it: Have one parent save or edit an expense while another finalizes. If the save’s `INSERT` happens after `loadTrip` and its `log()` after line 383, the trip is finalized with stale payments.
- Evidence:
  ```ts
  // src/index.ts:372-383
  const before = await lastChange();
  const trip = await loadTrip(env, tid);
  ...
  await env.DB.batch([... DELETE payments, INSERT payments, UPDATE tournaments ...]);
  if ((await lastChange()) !== before) { /* rollback */ }

  // src/index.ts:562-568
  await openTournament(env, tid);
  ...
  INSERT INTO expenses ...
  await log(env, tid, name, `added ...`);
  ```

### Migration 0005 leaves dropped days in existing attendance and splits
- Severity: high
- Where: `migrations/0005_family_days.sql:10`
- What goes wrong: Before the first-round cleanup, shortening a trip left `people.days` and `fencing_days` containing the dropped dates. Migration 0005 copies the union of every historical day into `families.days` without limiting it to `start_date..end_date`, and `autoUnits` still counts the stale fencing days. The new PATCH cleanup only runs on a later trip-details save and cannot run while the trip is finalized.
- How to trigger it: On an older database, shorten a three-day trip to two days, then upgrade and finalize. The coach-hotel split still counts three fencer-days; the PDF attendance grid prints only the two current days, so its F marks do not add up to the units.
- Evidence:
  ```sql
  -- migrations/0005_family_days.sql:8-10
  UPDATE families SET days = COALESCE((
    SELECT json_group_array(value) FROM (
      SELECT DISTINCT j.value AS value FROM people p, json_each(p.days) j ...)
  ), '[]');
  ```
  ```js
  // public/split.js:46
  case "fencer_day": return fencers.reduce((n, p) => n + p.fencing_days.length, 0);
  ```
  The cleanup is only here: `src/index.ts:349-351`.

### Balances total still includes an expense nobody shares
- Severity: medium
- Where: `public/app.js:1074`
- What goes wrong: The first-round fix makes `balances` skip a zero-unit expense, so the family rows and payer are zero. The Settle table’s total row still uses the raw sum of every expense, so Share and Paid display the full amount while every family row is `$0`.
- How to trigger it: Create a `$40` per-person expense paid by family A with someone there that day, then clear that day from every family (or remove the only people). Settle up warns that nobody is included, but the total row still says `$40`.
- Evidence:
  ```js
  // public/app.js:1038
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  // public/app.js:1074
  <tr><td><b>Total</b></td><td class="n"><b>${money(total)}</b></td><td class="n"><b>${money(total)}</b></td>...
  ```
  ```js
  // public/split.js:106
  if (!s.total) continue;
  ```

### A payment on a soft-deleted trip can still be marked paid
- Severity: medium
- Where: `src/index.ts:415`
- What goes wrong: The deleted-trip checks were added to family writes and receipt reads, but the payment PATCH never calls `tournament()` or `openTournament()`. A payment belonging to a trip that is only soft-deleted can still be updated and logged for up to 30 days.
- How to trigger it: Finalize a trip, delete it, leave its Settle tab open in another browser tab, and tick a payment there. The PATCH succeeds even though the trip is in “Recently deleted”; restoring it shows the changed payment status.
- Evidence:
  ```ts
  // src/index.ts:415-422
  if ((m = path.match(/^\/payments\/(\d+)$/)) && method === "PATCH") {
    const x = await env.DB.prepare("SELECT x.*, f.name AS family FROM payments x JOIN families f ON f.id = x.family_id WHERE x.id = ?")...
    if (!x) throw new HttpError(404, "No such payment");
    await env.DB.prepare("UPDATE payments SET paid_at = ?, paid_marked_by = ? WHERE id = ?")...
  }
  ```

### PDF export builds the attendance grid for every day in the trip range
- Severity: medium
- Where: `public/pdf.js:238`
- What goes wrong: Unlike the app and `allowedDays`, the PDF has no 60-day cap. It creates a `days` array for the full `start_date` to `end_date` range and then draws a cell for every person and day. A long or mistyped range can make export allocate thousands of columns and hundreds of thousands of text operations, hanging the browser.
- How to trigger it: Create a trip from `2027-03-13` to `2037-03-13` (or a 100-year typo), add a few families, finalize, and click “Download PDF record”. The app’s day chips stop at 60 days, but the PDF still renders the entire range.
- Evidence:
  ```js
  // public/pdf.js:238
  const days = []; for (let d = utc(t.start_date); d <= utc(t.end_date); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  ...
  days.forEach((d, j) => { ... text(mark, M + 170 + j * dayW, y, { ... }); });
  ```
  `src/index.ts:325` validates date order only, not a maximum range.

### Practice-trip reset is not atomic
- Severity: low
- Where: `src/index.ts:201`
- What goes wrong: The reset performs one delete batch, then separate family/person insertion batches, then the expense insertion batch. There is no transaction or lock around the whole reset. Two resets can both delete before either seeds, producing duplicate seed families and expenses; a reset can also race with a normal expense save.
- How to trigger it: Open the practice trip on two devices and press “Reset practice trip” at the same time, or reset while another parent saves an expense. The resulting trip can contain duplicated seed data or a stray expense from the other action.
- Evidence:
  ```ts
  // src/index.ts:201-209
  await env.DB.batch([ DELETE payments, expenses, families, activity, UPDATE tournament ... ]);

  // src/index.ts:211-235
  for (...) {
    const f = await env.DB.prepare("INSERT INTO families ... RETURNING id")...
    await env.DB.batch(people.map(... INSERT INTO people ...));
  }
  ...
  await env.DB.batch(rows); // seed expenses
  ```

### Attendance continuation pages are labeled “Family statements”
- Severity: low
- Where: `public/pdf.js:203`
- What goes wrong: `runningTitle` is set to “Family statements” before that section and never updated for the following “Who was there, by day” section. Page breaks use `newPage()` without a title, so attendance pages after the first carry the wrong running header. The attendance section title itself appears only once.
- How to trigger it: Add enough families/people that the attendance grid starts on a new page or spans more than one page, then export. The top-of-page header on the attendance continuation pages says “Family statements”.
- Evidence:
  ```js
  // public/pdf.js:79
  if (title != null) runningTitle = title;
  ...
  // public/pdf.js:203
  runningTitle = "Family statements";
  ...
  // public/pdf.js:242
  section("Who was there, by day", "...");
  ```
