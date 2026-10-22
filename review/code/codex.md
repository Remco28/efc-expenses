### Receipt keys allow stored JavaScript execution
- Severity: high
- Where: src/index.ts:167
- What goes wrong: The server accepts arbitrary text after the trip prefix in `receipt_key`. The browser inserts that value into unescaped HTML attributes, allowing a saved expense to execute JavaScript when another parent views it.
- How to trigger it: Save an expense with `receipt_key` set to `t<ID>/missing" onerror="alert(document.domain)` and `receipt_type` set to `image/jpeg`, then open that expense.
- Evidence:
  ```ts
  // src/index.ts:167
  receipt_key: typeof b.receipt_key === "string" && b.receipt_key.startsWith(`t${tid}/`) ? b.receipt_key : null,
  ```
  ```js
  // public/app.js:825
  ${e.receipt_key ? `<div class="receipt" style="margin:12px 0">${e.receipt_type === "application/pdf" ? `<div class="pdf">PDF</div>` : `<img src="/api/receipts/${e.receipt_key}" alt="Receipt photo">`}
  ```

### Finalization can freeze payments that disagree with expenses
- Severity: high
- Where: src/index.ts:340
- What goes wrong: The open-state check, settlement calculation, and finalization batch are separate operations. A concurrent expense mutation can commit after the settlement snapshot, leaving a finalized trip with incorrect frozen payments; batch atomicity does not cover the preceding reads.
- How to trigger it: Have one parent finalize while another saves an expense. If the save passes its open-state check before finalization and commits after the finalizer reads expenses, the expense is saved but omitted from payments.
- Evidence:
  ```ts
  // src/index.ts:340–350
  const t = await openTournament(env, tid);
  if (!t.treasurer_name) throw new HttpError(409, "Someone needs to be the treasurer before the trip can be finalized");
  const trip = await loadTrip(env, tid);
  const { rows, perExpense } = balances(trip.expenses, trip.families);
  if (trip.expenses.some((e: any) => perExpense[e.id].total === 0)) throw new HttpError(409, "An expense has nobody included. Fix it first.");
  const plan = treasurerPlan(rows, t.treasurer_family_id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payments WHERE tournament_id = ?").bind(tid),
    ...plan.map((x: any) => env.DB.prepare("INSERT INTO payments (tournament_id, family_id, direction, amount_cents) VALUES (?, ?, ?, ?)")
      .bind(tid, x.family_id, x.direction, x.amount_cents)),
    env.DB.prepare("UPDATE tournaments SET status = 'final', finalized_at = ?, finalized_by = ? WHERE id = ?").bind(now(), name, tid),
  ]);
  ```

### Concurrent family additions silently lose split membership
- Severity: medium
- Where: src/index.ts:426
- What goes wrong: Adding a family reads each existing split and later replaces it with a modified copy. Two concurrent additions can overwrite each other’s changes, excluding one new family from existing costs.
- How to trigger it: With an existing non-custom expense, submit two family additions concurrently so both read the original split before either updates it. Add people to both families, then finalize without editing the expense.
- Evidence:
  ```ts
  // src/index.ts:426–428
  const { results: exps } = await env.DB.prepare("SELECT id, split FROM expenses WHERE tournament_id = ? AND basis <> 'custom'").bind(tid).all<any>();
  if (exps.length) await env.DB.batch(exps.map(e => env.DB.prepare("UPDATE expenses SET split = ? WHERE id = ?")
    .bind(JSON.stringify({ ...JSON.parse(e.split), [r.id]: null }), e.id)));
  ```

### Oversized split weights can eliminate all settlement payments
- Severity: medium
- Where: src/index.ts:155
- What goes wrong: Split weights have no upper bound or aggregate finiteness check. Accepted finite values can overflow the allocation arithmetic into `NaN`, after which finalization succeeds with missing payments.
- How to trigger it: Create a 100-cent expense paid by one of two families, with both families’ custom split weights set to `1e308`. Set a treasurer and finalize: the total weight becomes `Infinity`, both balances become `NaN`, and neither produces a payment.
- Evidence:
  ```ts
  // src/index.ts:155
  split[k] = v == null ? null : Math.max(0, Number(v) || 0);
  // src/index.ts:344
  if (trip.expenses.some((e: any) => perExpense[e.id].total === 0)) throw new HttpError(409, "An expense has nobody included. Fix it first.");
  ```
  ```js
  // public/split.js:77,81–82
  const total = ids.reduce((s, id) => s + units[id], 0);
  const exact = (expense.amount_cents * units[id]) / total;
  return { id, exact, cents: Math.floor(exact) };
  // public/split.js:120–121
  if (r.net < 0) out.push({ family_id: Number(id), direction: "in", amount_cents: -r.net });
  else if (r.net > 0) out.push({ family_id: Number(id), direction: "out", amount_cents: r.net });
  ```

### Purging can permanently delete a successfully restored trip
- Severity: medium
- Where: src/index.ts:94
- What goes wrong: Purging selects an expired trip and subsequently deletes its receipts and rows without rechecking its deletion state. A concurrent restore can succeed before the purge permanently removes the restored trip.
- How to trigger it: For a trip deleted over 30 days ago, load the main trip list while another tab restores it. Let restoration finish after the purge selects the ID but before its deletion batch executes.
- Evidence:
  ```ts
  // src/index.ts:94–95
  const old = await env.DB.prepare("SELECT id FROM tournaments WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 1").bind(cutoff).first<any>();
  if (old) await purgeTrip(env, old.id);
  // src/index.ts:86
  env.DB.prepare("DELETE FROM tournaments WHERE id = ?").bind(tid),
  // src/index.ts:359
  await env.DB.prepare("UPDATE tournaments SET deleted_at = NULL, deleted_by = NULL WHERE id = ?").bind(tid).run();
  ```

### Removing one expense can destroy another expense’s receipt
- Severity: medium
- Where: src/index.ts:547
- What goes wrong: Multiple expenses may reference the same receipt key, but replacing or deleting either expense unconditionally deletes the object. Other expenses retain a permanently broken receipt reference.
- How to trigger it: Upload one receipt and save two expenses in that trip using its returned key. Delete either expense, then try to view the other expense’s receipt.
- Evidence:
  ```ts
  // src/index.ts:167
  receipt_key: typeof b.receipt_key === "string" && b.receipt_key.startsWith(`t${tid}/`) ? b.receipt_key : null,
  // src/index.ts:547
  if (old.receipt_key && old.receipt_key !== e.receipt_key) await env.RECEIPTS.delete(old.receipt_key);
  // src/index.ts:552–553
  await env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
  if (old.receipt_key) await env.RECEIPTS.delete(old.receipt_key);
  ```

### Deleted trips remain writable and their receipts remain readable
- Severity: medium
- Where: src/index.ts:438
- What goes wrong: Family payment-note and staff-role updates bypass the deleted-trip check. Receipt downloads also bypass it, allowing retained URLs to read files belonging to deleted trips.
- How to trigger it: Record a family ID and receipt key, soft-delete the open trip, then PATCH `/api/families/<id>` with `{"pay_notes":"changed"}` or GET `/api/receipts/<key>`. Both still succeed.
- Evidence:
  ```ts
  // src/index.ts:434
  const tid = await familyTournament(env, fid);
  // src/index.ts:438–440
  if (b.pay_notes != null && str(b.pay_notes, 300) !== f.pay_notes) {
    // How to pay this family; editable after finalizing, since that's when it's needed.
    await env.DB.prepare("UPDATE families SET pay_notes = ? WHERE id = ?").bind(str(b.pay_notes, 300), fid).run();
  // src/index.ts:443–444
  if (b.role != null && f.kind === "staff" && str(b.role, 40) !== f.role) {
    await env.DB.prepare("UPDATE families SET role = ? WHERE id = ?").bind(str(b.role, 40) || "Coach", fid).run();
  // src/index.ts:571–572
  if ((m = path.match(/^\/receipts\/(t\d+\/[0-9a-f-]+)$/)) && method === "GET") {
    const obj = await env.RECEIPTS.get(m[1]);
  ```

### Chunked uploads bypass the receipt size limit
- Severity: medium
- Where: src/index.ts:565
- What goes wrong: The 10 MB limit checks only `Content-Length`, treating an absent header as zero while streaming the entire body into R2. Oversized stored receipts can then crash receipt reading because it buffers and base64-encodes the whole object in Worker memory.
- How to trigger it: Send an authenticated chunked upload exceeding 10 MB with an accepted content type and no `Content-Length`. A sufficiently large upload, such as 150 MB, will exhaust Worker memory when passed to `read-receipt`.
- Evidence:
  ```ts
  // src/index.ts:565–568
  const size = Number(req.headers.get("content-length") || 0);
  if (size > MAX_RECEIPT_BYTES) throw new HttpError(413, "That file is over 10 MB");
  const key = `t${tid}/${crypto.randomUUID()}`;
  await env.RECEIPTS.put(key, req.body, { httpMetadata: { contentType: type } });
  // src/index.ts:236
  const data = Buffer.from(await obj.arrayBuffer()).toString("base64");
  ```
