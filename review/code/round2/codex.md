### Activity check still permits stale finalized payments
- Severity: high
- Where: src/index.ts:383
- What goes wrong: The new guard checks activity rows, but mutations and their activity logs commit separately. A write that already passed the open-state check can finish after the final activity check, leaving frozen payments inconsistent with expenses.
- How to trigger it: Have one parent save an expense while another finalizes. Let the save pass `openTournament`, then pause before its INSERT; let finalization calculate payments and finish its activity check, then let the save complete. The trip remains final with the new expense omitted from payments.
- Evidence:
  ```ts
  // src/index.ts:383
  if ((await lastChange()) !== before) {
  ```
  ```ts
  // src/index.ts:562–568
  await openTournament(env, tid);
  const e = await expenseInput(env, tid, await body(req));
  const r = await env.DB.prepare(
    `INSERT INTO expenses (tournament_id, description, vendor, date, category, basis, amount_cents, paid_by, split, receipt_key, receipt_type, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(tid, e.description, e.vendor, e.date, e.category, e.basis, e.amount_cents, e.paid_by, e.split, e.receipt_key, e.receipt_type, now(), name).first<any>();
  await log(env, tid, name, `added ${e.description}, $${(e.amount_cents / 100).toFixed(2)}`);
  ```

### Adding a receipt erases an existing expense’s saved split
- Severity: medium
- Where: public/app.js:971
- What goes wrong: The receipt fix preserves sharing edits made during the current editing session, but existing expenses load without `splitTouched`. Successful receipt reading therefore replaces their saved exclusions and hand-set counts with defaults.
- How to trigger it: Save a $100 custom expense with two families assigned 1 and 3 shares ($25/$75). Reopen it, attach a readable receipt, wait for reading to finish, and save without touching sharing. Both families now have 1 share ($50/$50).
- Evidence:
  ```js
  // public/app.js:783
  S.draft = e ? { ...e, split, amount: (e.amount_cents / 100).toFixed(2), basisTouched: true }
  ```
  ```js
  // public/app.js:970–971
  // Keep any sharing changes they made while the receipt was being read.
  if (!d.splitTouched) d.split = defaultSplit(d.basis, S.trip.families);
  ```
  ```js
  // public/split.js:57
  for (const f of families) if (f.kind !== "staff") split[f.id] = basis === "custom" ? 1 : null;
  ```

### Correcting an expense’s date resets custom allocations
- Severity: medium
- Where: public/app.js:819
- What goes wrong: Changing Day unconditionally replaces the entire split, including deliberate exclusions and custom weights. Even for a custom split, where attendance does not determine shares, correcting the date changes who owes what.
- How to trigger it: Create a $100 custom expense with two families weighted 1 and 3. Edit only its Day and save; the allocation changes from $25/$75 to $50/$50.
- Evidence:
  ```js
  // public/app.js:819
  $("day").onchange = () => { d.date = $("day").value || null; resetSplit(); };
  ```
  ```js
  // public/app.js:848
  function resetSplit() { S.draft.split = defaultSplit(S.draft.basis, S.trip.families); drawSplit(); }
  ```
  ```js
  // public/split.js:57
  for (const f of families) if (f.kind !== "staff") split[f.id] = basis === "custom" ? 1 : null;
  ```

### Trip-date pruning can overwrite a saved attendance correction
- Severity: medium
- Where: src/index.ts:345
- What goes wrong: The new pruning fix reads attendance and later replaces whole arrays without checking for intervening edits. A concurrent parent’s successful correction can be silently overwritten, changing automatic expense shares.
- How to trigger it: Start with a Friday–Sunday trip and a fencer fencing Friday and Saturday. Let a request shortening the trip to Saturday–Sunday read attendance; then have a parent successfully untick Saturday before the shortening batch commits. Pruning writes its stale `[Saturday]` fencing array back, charging the family a fencer-day they removed.
- Evidence:
  ```ts
  // src/index.ts:343–345
  const keep = (list: string) => JSON.stringify((JSON.parse(list) as string[]).filter(d => d >= start && d <= end));
  const { results: fams } = await env.DB.prepare("SELECT id, days FROM families WHERE tournament_id = ?").bind(tid).all<any>();
  const { results: ppl } = await env.DB.prepare("SELECT p.id, p.days, p.fencing_days FROM people p JOIN families f ON f.id = p.family_id WHERE f.tournament_id = ?").bind(tid).all<any>();
  ```
  ```ts
  // src/index.ts:350–351
  ...ppl.filter(p => keep(p.days) !== p.days || keep(p.fencing_days) !== p.fencing_days)
    .map(p => env.DB.prepare("UPDATE people SET days = ?, fencing_days = ? WHERE id = ?").bind(keep(p.days), keep(p.fencing_days), p.id)),
  ```
