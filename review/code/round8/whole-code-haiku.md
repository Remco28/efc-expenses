Review of the EFC trip-expenses app at commit ddd5fc4 (my copy: /tmp/claude-1000/-home-frank-Dev-agent-office/5c8f63e1-975c-455f-891c-a49fa0bbcc0b/scratchpad/rl8/agy). I ran the local dev server, drove the API with scripts, and read src/index.ts, public/app.js, public/split.js and public/pdf.js. The server is stopped and port 8833 is free. Scripts are in .../scratchpad/rl8/t/ (s1.mjs to s4.mjs). Nothing outside my copy was touched.

Findings, most serious first.

1. HIGH (ran it). Changing the trip dates silently and permanently removes people's attendance, and existing expenses are re-priced.
- Steps: trip 13-14 Mar. Family Lee (Ann, fencer, both days) pays a whole-trip "Team dinner" (meal, split by person, no date) for $100. Family Kim has Ben, who is only there on the 13th. Before: Kim owes $50, Lee is owed $50.
- Save the trip with start 14 Mar. Ben's days become []. Kim owes $0 and Lee is owed $0. The dinner was re-split without any warning.
- Save the start back to 13 Mar. Ben's days stay []. The balances do not come back.
- Trigger: any date change that drops days (a mistyped first or last day, later corrected, or a real schedule cut). The Trip details form has only a one-line hint ("Shortening the trip removes the dropped days from everyone's attendance"), with no confirmation. The only visible sign is a "has no days" flag on the Families list.
- Code: index.ts PATCH /tournaments/:id runs the trim with json_each/BETWEEN; nothing is recorded to restore.

2. MEDIUM (ran it). Unticking Fencer and ticking it again replaces the hand-picked fencing days with every trip day.
- Steps: Diego is a fencer who fences only on the 13th. Untick Fencer: fencing_days becomes []. Tick Fencer again: fencing_days becomes ["13th","14th"].
- Effect: the coach's stay ("per fencer-day") counts Diego for an extra day, and the split shifts silently. The family screen shows the extra chip.
- Code: index.ts PATCH /people/:id sets `fencing = ... !p.is_fencer ? days : wasFencing`, so re-ticking uses the full family days, not the previous choice.
- Rare, but a plausible mis-tap on a checkbox that sits beside the name.

3. MEDIUM, rare sequence (ran it). A stale expense editor can save a hand-set count onto a different, newly added family.
- Steps: Phone A opens the editor for an expense where Kim (the highest family id) has 3 people hand-set. Phone B deletes Kim, then adds Nash. SQLite reuses the id, so Nash gets id 4 (Kim's old id). Phone A saves its unchanged editor. The server accepts split {"4":3}, because family 4 exists. Nash now gets 3 people's share (net -$67.50 to Nash, +$67.50 to Lee), with no warning.
- Why the guard misses it: the expense revision (rev) does not change when a family is deleted, so the rev check passes. Family and person ids are reused, and the round 4 note covered only family screens, not expense editors.
- Requires a stale editor left open while someone deletes and re-adds the most recent family.

4. MEDIUM (ran the duplicate part; the lost-response part is from the code). A retry after a lost response creates a duplicate.
- Two identical POST /tournaments/:id/expenses calls create two expenses (verified). POST families and POST people have no idempotency either.
- Path: a save commits on the server but the response is lost on a weak signal. fetch throws, act() shows "No connection", the draft stays, and Save is re-enabled. Tapping Save again creates a second, identical expense.
- It is visible as two identical rows and recoverable by deleting one, so MEDIUM rather than HIGH.

Reasoned from the code, LOW:
- Back arrow in the expense form discards an in-progress draft with no warning (app.js show() sets S.draft = null on trip routes). An uploaded receipt is also left in R2 with no owner. The receipt-orphan cleanup only runs on reset or purge.
- PDF draft totals (pdf.js): the "Total" uses the sum of shares, but the Amount column total uses the sum of amounts. They differ when an expense has nobody included. Finalize is blocked in that case, so only draft PDFs show it.
- Design choice, not a bug: a family added with no days gets the whole trip, so it is charged for earlier expenses until its days are set. A one-day cost left as "Whole trip" is split across everyone there on any day. The UI hints at this, but it is easy to miss.

Checked and fine:
- Expense edit revision guard (ran it): two stale saves of the same expense, the second gets 409 and nothing is overwritten.
- Money math (reasoned, consistent with the test suite): shares add up exactly, balances net to zero, the treasurer plan nets correctly including the treasurer's own family, and finalize's fingerprint check and the payment writes are atomic.
- Family day toggles and person edits use compare-and-set on the values they read, so two phones racing on the same family or person get a 409 instead of a silent overwrite (reasoned).

Not tested: browser behaviour (saves in flight, visibilitychange), the PDF output, and the AI receipt path (switched off in this copy).
