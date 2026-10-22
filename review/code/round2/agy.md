### Concurrent finalization undoes finalization and wipes payments
- Severity: high
- Where: [src/index.ts:381-389](file:///home/frank/Dev/efc-expenses/src/index.ts#L381-L389)
- What goes wrong: When two users finalize concurrently, the second request fails to update the tournament status (`status = 'open'` matches 0 rows) but still deletes and replaces payments. It then detects the first user's finalization activity log entry, treats it as a conflicting trip change, and executes an undo batch that wipes all frozen payments and resets the tournament back to open status.
- How to trigger it: Have two users submit `POST /api/tournaments/<id>/finalize` at the same moment for an open tournament. The first request succeeds with 200 OK, but the second request's rollback wipes all payments and reopens the tournament.
- Evidence:
```ts
    await env.DB.batch([
      env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
      ...plan.map((x: any) => env.DB.prepare("INSERT INTO payments (tournament_id, family_id, direction, amount_cents) VALUES (?, ?, ?, ?)")
        .bind(tid, x.family_id, x.direction, x.amount_cents)),
      env.DB.prepare("UPDATE tournaments SET status = 'final', finalized_at = ?, finalized_by = ? WHERE id = ? AND status = 'open'").bind(now(), name, tid),
    ]);
    if ((await lastChange()) !== before) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
        env.DB.prepare("UPDATE tournaments SET status = 'open', finalized_at = NULL, finalized_by = NULL WHERE id = ?").bind(tid),
      ]);
      throw new HttpError(409, "Someone changed the trip while you were finalizing. Check it and finalize again.");
    }
```

### Incomplete purge-vs-restore fix destroys child data and receipts of restored trips
- Severity: high
- Where: [src/index.ts:86-97](file:///home/frank/Dev/efc-expenses/src/index.ts#L86-L97)
- What goes wrong: `purgeTrip` purges R2 receipts in a loop before running a database batch to delete tournament data. If a user restores the trip while R2 deletion is in progress, the batch only conditions `DELETE FROM tournaments` on `AND deleted_at IS NOT NULL`, while deleting all payments, expenses, families, people, and activity unconditionally alongside the destroyed receipts.
- How to trigger it: For a trip deleted over 30 days ago, load `/api/tournaments` (which triggers `purgeExpired`). Concurrently call `POST /api/tournaments/<id>/restore` while R2 receipt deletion is in progress. The restored tournament survives as an empty shell stripped of all its expenses, families, payments, and receipts.
- Evidence:
```ts
  let cursor: string | undefined;
  do {
    const list = await env.RECEIPTS.list({ prefix: `t${tid}/`, cursor });
    if (list.objects.length) await env.RECEIPTS.delete(list.objects.map(o => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM expenses WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM families WHERE tournament_id = ?").bind(tid),
    env.DB.prepare("DELETE FROM activity WHERE tournament_id = ?").bind(tid),
    env.DB.prepare(`DELETE FROM tournaments WHERE id = ?${deletedBefore ? " AND deleted_at IS NOT NULL" : ""}`).bind(tid),
  ]);
```

### Non-calendar date inputs crash server and permanently wedge tournament views
- Severity: high
- Where: [src/index.ts:55](file:///home/frank/Dev/efc-expenses/src/index.ts#L55), [src/index.ts:128-130](file:///home/frank/Dev/efc-expenses/src/index.ts#L128-L130)
- What goes wrong: `isDate` tests only the regex `/^\d{4}-\d{2}-\d{2}$/`, allowing invalid calendar dates such as `2026-00-00` or `2026-13-45` to be saved as tournament dates. Subsequent calls to `allowedDays` and the client's `tournamentDays()` invoke `new Date(...).toISOString()`, which throws an unhandled `RangeError: Invalid time value`, returning 500 on all family/people endpoints and white-screening the browser so the trip cannot be loaded, edited, or deleted.
- How to trigger it: Submit `POST /api/tournaments` with `start_date: "2026-13-01"` and `end_date: "2026-13-02"`. Opening the trip crashes the UI, and calling any family or person endpoint returns a 500 error.
- Evidence:
```ts
// src/index.ts:55
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
// src/index.ts:128-130
const d = new Date(t.start_date + "T12:00:00Z");
const end = new Date(t.end_date + "T12:00:00Z");
while (d <= end && out.size < 60) { out.add(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
```

### 10 MB receipt files exceed Workers free plan 10 ms CPU limit in `readReceipt`
- Severity: high
- Where: [src/index.ts:21](file:///home/frank/Dev/efc-expenses/src/index.ts#L21), [src/index.ts:253](file:///home/frank/Dev/efc-expenses/src/index.ts#L253), [src/index.ts:259-263](file:///home/frank/Dev/efc-expenses/src/index.ts#L259-L263)
- What goes wrong: The server allows receipt uploads up to 10 MB (`MAX_RECEIPT_BYTES`), but `readReceipt` base64-encodes the entire buffer and passes it to Anthropic's SDK. In V8, serializing a ~14 MB base64 string via `JSON.stringify` inside the Anthropic client consumes >20 ms of pure CPU time, exceeding the 10 ms CPU execution limit on Cloudflare Workers free plan and aborting the Worker with error 1102.
- How to trigger it: Upload an uncompressed PDF or high-resolution photo receipt close to 10 MB via `POST /api/tournaments/<id>/receipts`, then call `POST /api/tournaments/<id>/read-receipt`.
- Evidence:
```ts
// src/index.ts:21
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
// src/index.ts:253, 259-262
const data = Buffer.from(await obj.arrayBuffer()).toString("base64");
...
const res = await client.messages.parse({
  model: env.RECEIPT_MODEL || DEFAULT_RECEIPT_MODEL,
  max_tokens: 2000,
  output_config: { effort: "low", format: zodOutputFormat(ReceiptFields) },
```

### In-flight mutations commit after finalize snapshot and freeze corrupted settlement payments
- Severity: medium
- Where: [src/index.ts:371-383](file:///home/frank/Dev/efc-expenses/src/index.ts#L371-L383), [src/index.ts:564-568](file:///home/frank/Dev/efc-expenses/src/index.ts#L564-L568)
- What goes wrong: Finalize detects concurrent mutations by checking whether the maximum `activity.id` changed between its initial read and its payment batch write. However, all mutation endpoints (`POST /expenses`, `PATCH /expenses`, etc.) commit their database changes first and execute `await log(...)` afterward; a mutation that commits to D1 between finalize's snapshot and write before its log executes leaves the finalized trip with payments that disagree with the committed expenses.
- How to trigger it: Concurrently submit `POST /api/tournaments/<id>/expenses` while another user finalizes the tournament. If the expense insert commits before finalize's write but its `await log()` resolves after finalize's `(await lastChange()) !== before` check, finalization succeeds with payments omitting the newly added expense.
- Evidence:
```ts
// src/index.ts:371-373, 383
const lastChange = () => env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM activity WHERE tournament_id = ?").bind(tid).first<any>().then(r => r.n);
const before = await lastChange();
const trip = await loadTrip(env, tid);
...
if ((await lastChange()) !== before) {
// src/index.ts:564-568
const r = await env.DB.prepare(
  `INSERT INTO expenses ... VALUES ... RETURNING id`).bind(...).first<any>();
await log(env, tid, name, `added ${e.description}, $${(e.amount_cents / 100).toFixed(2)}`);
```

### `PATCH /payments/:id` bypasses soft-delete check and allows modifying deleted trips' payments
- Severity: medium
- Where: [src/index.ts:415-423](file:///home/frank/Dev/efc-expenses/src/index.ts#L415-L423)
- What goes wrong: While all other endpoints check `tournament(env, ...)` to reject operations on soft-deleted trips with a 404 error, `/payments/:id` queries only `payments` and `families`. It never checks whether the payment's tournament is soft-deleted, allowing users with a payment ID to toggle payments and insert activity log entries on deleted trips.
- How to trigger it: Finalize a trip with payments, soft-delete the trip (`DELETE /api/tournaments/<id>`), and then send `PATCH /api/payments/<id>` with `{"paid": true}`. The request succeeds with 200 OK and modifies the payment row.
- Evidence:
```ts
  if ((m = path.match(/^\/payments\/(\d+)$/)) && method === "PATCH") {
    const id = Number(m[1]);
    const x = await env.DB.prepare("SELECT x.*, f.name AS family FROM payments x JOIN families f ON f.id = x.family_id WHERE x.id = ?").bind(id).first<any>();
    if (!x) throw new HttpError(404, "No such payment");
    const paid = !!(await body(req)).paid;
    await env.DB.prepare("UPDATE payments SET paid_at = ?, paid_marked_by = ? WHERE id = ?").bind(paid ? now() : null, paid ? name : null, id).run();
    const what = x.direction === "in" ? `${x.family}'s payment to the treasurer` : `the treasurer's payment to ${x.family}`;
    await log(env, x.tournament_id, name, paid ? `marked ${what} as done` : `marked ${what} as not done`);
    return json({ ok: true });
  }
```

### Server accepts staff family as treasurer, omitting their expense reimbursements
- Severity: medium
- Where: [src/index.ts:437-438](file:///home/frank/Dev/efc-expenses/src/index.ts#L437-L438), [public/split.js:127](file:///home/frank/Dev/efc-expenses/public/split.js#L127)
- What goes wrong: `PUT /tournaments/:id/treasurer` validates only that `treasurer_family_id` belongs to `familyIds()`, which includes staff entries (`kind = 'staff'`). When a staff member is assigned as the treasurer family, `treasurerPlan` skips their row under the assumption that the treasurer retains the residual balance, completely omitting their expense reimbursement payments from the settlement.
- How to trigger it: Add an expense paid by coach Mike ($160). Send `PUT /api/tournaments/<id>/treasurer` with `treasurer_name: "Mike Torres"` and `treasurer_family_id: <staff_id>`. Finalize the tournament: `payments` contains no payout to Mike Torres.
- Evidence:
```ts
// src/index.ts:437-438
const fid = b.treasurer_family_id == null || b.treasurer_family_id === "" ? null : Number(b.treasurer_family_id);
if (fid != null && !(await familyIds(env, tid)).has(fid)) throw new HttpError(400, "Pick a family on this trip");
// public/split.js:127
if (treasurerFamilyId != null && Number(id) === Number(treasurerFamilyId)) continue;
```

### Concurrent `resetSandbox` calls create duplicate families, staff, and expenses
- Severity: medium
- Where: [src/index.ts:211-235](file:///home/frank/Dev/efc-expenses/src/index.ts#L211-L235)
- What goes wrong: `resetSandbox` cleans up the trip in one batch and then sequentially inserts families, staff, and expenses without transaction isolation or unique constraints. If two users click "Reset practice trip" concurrently, both delete existing rows and both execute the re-seeding loop, inserting duplicate copies of all seed families, people, and expenses into the practice trip.
- How to trigger it: Send two concurrent `POST /api/tournaments/<id>/reset-sandbox` requests. The practice trip ends up with 6 families, 2 coaches, and 10 expenses.
- Evidence:
```ts
  for (const [fname, pay, people] of SANDBOX.families) {
    ...
    const f = await env.DB.prepare("INSERT INTO families (tournament_id, name, pay_notes, days) VALUES (?, ?, ?, ?) RETURNING id").bind(tid, fname, pay, JSON.stringify(famDays)).first<any>();
    fid[fname] = f.id;
    await env.DB.batch(people.map(([pn, fencer, days, fdays]: [string, number, string[], string[]]) =>
      env.DB.prepare("INSERT INTO people (family_id, name, is_fencer, days, fencing_days, own_days) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(f.id, pn, fencer, JSON.stringify(days), JSON.stringify(fdays), days.length === famDays.length ? 0 : 1)));
  }
  ...
  rows.push(env.DB.prepare(`INSERT INTO expenses ...`));
  await env.DB.batch(rows);
```
