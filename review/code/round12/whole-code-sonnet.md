Review of the fencing-club expense splitter at commit 64a1243: I found nothing HIGH, and one narrow MEDIUM that I reproduced. I read all of src/index.ts, public/split.js, public/app.js, public/pdf.js and the migrations. I ran the app locally.

**What I ran**
- A full trip through the API: 3 families, one coach, 6 people, 3 expenses, then treasurer and finalize.
  - The expenses were an uneven-cents meal with head counts, a coach hotel split by fencing days that the coach paid, and a coach flight split per fencer.
  - The treasurer was a family on the trip.
  - Balances netted to exactly 0. The treasurer's own family correctly got no payment line.
  - The in and out payments reconciled with that family's "adds $303.57" to the cent.
- Five concurrent fencing-day taps on one person all returned 200, and the final list was consistent.
- The server is stopped and port 8871 is free.

**MEDIUM: a notes-only treasurer save on an open trip removes the treasurer and wipes the payment notes**
- *Cause.* `PUT /tournaments/:id/treasurer` handles a final trip by updating only the notes. On an open trip it reads a missing `treasurer_name` as an empty name, which means "remove the treasurer". It then sets name and family to NULL and notes to "".
- *When it happens.* A treasurer on a final trip opens "Treasurer details" to fix their Venmo or Zelle line. The sheet then sends only `treasurer_notes`. If someone reopens the trip before they tap Save, the save lands on an open trip.
- *Result.* The treasurer is removed and the payment notes are blanked. The "needs a treasurer" banner comes back and the notes are gone. The second part is not obvious. The write is accepted with a 200 and a "Saved" toast.
- *Recovery.* It is visible and recoverable: someone has to notice, re-pick the treasurer and retype the notes.
- *Evidence.* Ran it. A final trip with treasurer "Tre" and notes "venmo" was reopened. `PUT {treasurer_notes:"new venmo"}` returned 200, and the trip then had a null treasurer name, a null family and empty notes.
- *Fix.* Make the server require `treasurer_name` to be present before treating it as a removal, and refuse a notes-only body on an open trip.

**LOW, reasoned from the code only**
- **Typed expense lost on Back.** A half-typed new expense is dropped without asking if the parent taps Back, or follows a link to another screen, before saving. `show()` calls `leaveDraft()` on every non-editor screen. The comment at `leaveDraft` suggests the draft should be kept. It is kept only when a save was attempted with no signal and went to "Waiting to send". The same happens after an edit conflict: the 409 message says to open the expense again, and going Back discards what was typed. It is visible and quick to retype.
- **Waiting expense refused after finalize.** The design already accepts this (saving-design-v4 section 4). An expense queued on a phone with no signal is refused if the treasurer finalizes before that phone reconnects. The "Couldn't send" message shows only on that parent's phone, and the treasurer's numbers leave it out. A parent who paid and never reopens the app is not reimbursed until someone reopens the trip. Visible and recoverable, but the treasurer has no way to see it.

**What I checked and found correct**
- Rounding: shares always sum to the amount.
- The treasurer plan and netting.
- Finalize being guarded by the fingerprint in the same SQL statements.
- Fencing-day taps applied inside SQL, and trip shortening trimming fencing days inside SQL.
- The expense revision, creation-time and family-tag checks.
- The idempotency keys.
- HTML escaping on the client.
