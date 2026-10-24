Audit of the round-13 ratings and decisions in /home/frank/Dev/efc-expenses/review/code/README.md.

I read the README sections for rounds 10, 11, 12 and 13, all six round13 reports (not plan.md), both design docs, the profile and the r13-field brief. I checked the code at `famSave`/`loadTrip`/`act`, `draftFromExpense`/`mergeOnto` and `saveExpense`, and the split.js tables. I ran nothing. Where I mark something "reasoned", I read the code or the reports and did not run it.

**Summary.** The table is mostly honest. Row 1 is rated and cited correctly, and no HIGH looks missed. The weak points are the disposition of rows 8, 7 and 9, and the "how checked" column. Row 2's rating holds but its reason is false.

## 1. Ratings and decisions that don't hold up

**Row 8, "sheets that fail with no signal lose what was typed (round 3)": LOW and not fixed. It should be MEDIUM, or at least not buried in a "rare or cosmetic" bundle.**
- The bad-signal reader also raised this as a design violation. saving-design-v4 section 5 promises "what they typed stays on screen", and the code closes the sheet before the request. The reader said so explicitly.
- The author cites "round 3" as precedent. That rating predates round 10 row 4, round 12 row 2 and this round's row 1, which all rated typed work lost after a save that couldn't land as MEDIUM.
- No reason is given for treating sheets differently from expense forms.
- The only argument anywhere is the round-12 aside "short fields".
- The brief's "chosen on purpose" list names the "doesn't handle" section of the design. It does not name section 5's promise. The author folded the violation into a bundle labelled "rare or cosmetic". "Rare" is not a reason for LOW under the profile.

**Row 7, second item: a queued expense sending refreshes the Families tab under someone typing (Haiku whole-code, LOW). It should be MEDIUM, or carry a stated reason for not being MEDIUM.**
- Typed text is wiped by a timer, which is rare timing plus lost typed work.
- The README says "to fix the first and third" and gives no reason for skipping the second.
- It is the same mechanism as the row 8 sheets, and it is not fixed either.

**Row 9, a waiting expense refused after finalize: bad-signal MEDIUM, ours LOW "accepted". This should stay MEDIUM, with the disposition "accepted by Frank".**
- The reason given, "Frank's choice in saving design v4 (no reminder at finalize)", is a decision and says nothing about severity. Frank chose no reminder on the finalize screen. He did not choose the consequences: the treasurer's frozen totals omit money a parent paid, and "Open it to fix" is a dead end until the trip is reopened. The author's own note admits the dead end.
- Item 5 of the design's "What it doesn't handle" list, the section the brief declares intended, does not name this case. The reviewer said so ("I am flagging it"). Section 4 describes the refusal landing in "Couldn't send" on the payer's phone, but not that nobody else ever sees it.
- The scale puts a rare-timing wrong result at MEDIUM, and the profile says the reviewer's rating is evidence that a lower rating must answer.
- There is precedent: round 12 row 7 was accepted as LOW by its disposition audit. That precedent is one decision and was never tested against the scale. Rating a finding LOW to close it, instead of recording a MEDIUM that was accepted, is the pattern the profile warns about.

**Row 6, second half: a receipt key missing from storage makes every Save refuse with "changed since you opened it". The reason given, "predates this and is rare", is not a reason.**
- "Predates this" doesn't lower a severity.
- "Rare" or "speculative" timing is MEDIUM, and the user has no escape except discarding the edit.
- The author did not try to produce the missing-key state. I would leave it at LOW only if someone shows the state can't arise.

**Row 6, first half: the legacy `base` bug. The reason for LOW is unchecked, and one of the two available reasons contradicts the author's own rating of the mechanism.**
- Reasoned: if reachable, it overwrites another phone's split change with the parent's stale one. That is the lost update that round 12 rated MEDIUM and built `mergeOnto` to prevent.
- The only thing keeping it LOW is that legacy rows may not exist. billing-model.md says the live trips were cleared. The author did not query the live data, though round 12's audit response did this for a sibling row.
- Rate it LOW only with a stated query result, otherwise MEDIUM. It is being fixed anyway, so this is a reasoning gap, not a missed fix.

**Row 2: the MEDIUM stands but the reason is false.**
- "Visibly wrong once the toast fades" is the reverse of what the reviewer showed. After the failed `loadTrip`, `famSave` returns without a redraw, so the tick stays on screen and looks saved. The wrongness is invisible after the toast.
- Reasoned: this is closer to round 10 row 2 and round 11 row 5 (silent wrong share, HIGH) than the stated reason admits.
- I think MEDIUM is still defensible. The toast does say "may or may not have saved", and the treasurer checks the Fencing days screen before finalizing. But the author should have argued that, not asserted "visible".
- "Read in the code" is also all the checking there is. Nobody ran this one.

**Row 3, deciding "asked Frank" rather than the rules.** LOW is defensible. But the rule says "the rules decide", and billing-model says the warnings block nothing and that only finalize is blocked for an expense nobody splits. Because a new fencer now starts with no days, a coach hotel booked before the trip can't be entered at all, on the default state of every trip. That is a rules disagreement the code should lose, not a choice. It is a minor point.

## 2. Reasons: real or convenient

- **Real:** rows 1, 3 (as LOW), 4, 5 and 7a.
- **Convenient:**
  - Row 2's "visibly wrong".
  - Row 8's "rare or cosmetic" bundle: one of its six items is a design violation, and the hung-queue item is understated (the reviewer said minutes; the author says 25 s, which is one request, but taps queue).
  - Row 6b's "predates".
  - Row 9's "Frank's choice" standing in for a severity.
  - The "How checked" column. Row 1's "the refusal reproduced" is true only of the API's 409. Haiku ran that. The actual loss is reasoned for both readers. Row 3's "Two readers" is two readers who both only read the code. Nearly every other row says "Read".

## 3. Did earlier audit responses change round 13?

- **Changed:**
  - The rows cite precedent (row 1 cites round 10 row 4 and round 12 row 2).
  - They state that four of the five readers only read the code.
  - Row 4 follows the "wording regression" lesson.
- **Described but not applied:**
  - The round-12 audit asked that observations dropped without a row be listed. One is dropped again: bad-signal's "deleting an expense or replacing a receipt deletes the R2 photo immediately, no undo, after confirm". It may be intended, but it needed a row.
  - The round-10 and round-11 lesson was to re-rate old classes when they return. Typed-work-lost came back in rows 7b and 8, and "(round 3)" was reused as precedent without being re-rated.
  - The "How checked" column was added after round 10 but mostly says "Read".

## 4. Same kind of problem, different ratings

- **Typed or user work lost:** MEDIUM for expense forms (round 10 row 4, round 12 row 2, round 13 row 1). LOW for sheets (round 12's "not in this round", row 7b, row 8e), with no principled difference argued. The nearest candidate is the length of what was typed, and the author never says so.
- **A fix applied in one place and missed in another:** row 5 is consistently LOW, matching round 12 row 4. That is consistent, and it is fine.
- **Missed or unreliable accepted limits:** round 12 row 7 and round 13 row 9 are rated LOW for the same decision-not-severity reason.

## Bottom line

I found no missed HIGH. Rows 1 and 2 correctly trigger a round 14. The README also never states that outcome; the "So round 13 had…" line other rounds close with is absent. Rows 7b, 8 and 9 are the ones to push back on, and the unrun row 2 and row 6 claims need a reproduction or a live-data query before their reasons are trusted. I did not run any scenarios myself.
