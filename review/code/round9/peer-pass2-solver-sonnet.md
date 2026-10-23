I read the code, and it already has an attempt at this. I think the expense half is sound and the person/family half has a real flaw. My own proposal is further down.

**What exists**

- **Migrations 0009 to 0011:** `client_key` columns with partial unique indexes, plus a `client_sig` column.
- **Server:** in `src/index.ts`, the add endpoints for expenses, people, families and tournaments look up the key first. A matching key returns the existing row instead of inserting.
- **Phone:** in `public/app.js`, `api()` attaches a key to adds (`addKeyFor`). On a lost reply, `saveExpense` stashes the form in localStorage (`keepPending`). The next "new expense" screen then reopens that form (`settlePending`) or says "did save".

**Expenses: good design**

- The key is minted once per form (`crypto.randomUUID()` in the draft) and travels with the draft.
- A retry from the same form can't double-insert. The server also handles two requests landing at once (`ON CONFLICT DO NOTHING`, then re-select).
- Re-entering from scratch is the case it can't catch. That happens if the pending slot is gone (cleared storage, different browser) or the parent keys it in on someone else's phone. The slot is also singular: a second lost save overwrites the first.
- The fix-and-resubmit path only applies while `rev = 0`, and otherwise returns a clear 409. That's careful.

**People and families: the key is per endpoint, not per attempt**

- `addKeyFor(path)` keys on the URL path, in sessionStorage, for 10 minutes. The server treats "same key, different content, row untouched" as a typo correction, so it rewrites the existing row.
- Failure case: the parent adds "Ava", the reply is lost, and they decide to add a different person, "Ben", to the same family. The server sees the same key and an untouched row, and renames Ava to Ben. Ava is silently gone and no error appears. This is the wrong kind of failure, because it loses data quietly.
- The cause is that "I'm fixing the typo" and "I'm adding someone else" look identical. The client has a guess about intent and the server can't verify it.
- Smaller issues:
  - The key is forgotten on any server reply, including 4xx. A validation error followed by a fixed retry makes a fresh key, which is probably right.
  - sessionStorage dies when the tab is closed. Phones evict tabs often, and the 10-minute TTL is arbitrary.
  - The person-add success check (`p.client_key === k` on `S.trip`) depends on the reload having completed.

**Approach A, which I'd do: make the pending add visible and let the parent choose**

- Keep per-attempt keys, but mint the key when the "Add person" sheet or row opens, as the expense form does. Never reuse it for a different submission.
- On a lost reply, keep the typed text in the box and mark the attempt "unconfirmed".
- Refetch the trip, then check by key. If the row is there, say "Ava was added" and clear the box. If not, a retry is safe to send. A typo fix is just a retry with the same key, and the server overwrites only the row that key created.
- When the parent explicitly starts something new, for example by clearing the box or opening a new add, mint a new key. Then "Ben" can never overwrite "Ava".
- Cost to parents: nearly nothing. They see their text still in the box and a one-line "not sure that saved, checking". The cost is a refetch on a bad signal.
- What it could get wrong:
  - The refetch itself can fail. Then the UI must stay in "unconfirmed" and not offer a fresh add that mints a new key.
  - Tracking per-attempt state across reloads needs localStorage. Be careful about stale pending state hanging around for days.

**Approach B: don't prevent duplicates; make them cheap to see and fix**

- Skip typo-correction magic. Use a plain key for exact-retry safety only: same key and same content returns the existing row, and same key with different content is a fresh key.
- Add a near-duplicate warning at add time. When the name matches or is very close to an existing person in the same family, or a similar family name or an expense with the same amount, payer and date on the same trip, show "Looks like Ava is already here. Add anyway?" with a one-tap merge or delete afterwards.
- Cost to parents: an occasional extra tap, and the confirmation fires even when there was no lost reply.
- What it could get wrong:
  - Two parents often do add genuinely similar things, such as two $12 coffees by the same payer. A hard block would be wrong, so this must be a soft prompt and never a refusal.
  - Fuzzy matching on names is noisy. "Ava" and "Eva" are different kids.
  - Warning fatigue trains parents to tap through.

**My recommendation:** do A as the default, because it fixes the actual cause (which attempt a retry belongs to) without nagging anyone. Use B only for expenses as a soft hint, since parents do add real lookalike expenses. Don't let the server decide what counts as a correction by comparing signatures. The signature-and-untouched logic is a lot of machinery, and its failure mode (renaming the wrong person) is worse than the duplicate it prevents.

**Code to change if you adopt A**

- `addKeyFor` and `forgetAddKey` in `public/app.js`.
- The person-add handler near line 815 of `public/app.js`.
- The `client_sig` branches in `src/index.ts` at about lines 365, 547 and 643.
