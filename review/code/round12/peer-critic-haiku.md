Review of the round-12 plan (peer12/plan.md) against src/index.ts and public/app.js. Nothing was changed or run.

PROBLEM 1: the notes-only treasurer save wipes the treasurer

Would it fix it: yes, for the reported case. I traced it. On a final trip the sheet has no name or family field, so it sends only the notes. If the trip has been reopened, the server's open-trip branch (index.ts, PUT /tournaments/:id/treasurer, about lines 556-569) reads the missing name as an empty string, which means "remove", and clears name, family and notes, then logs "removed the treasurer". The plan's rule (a missing name never means removal) stops that. Today's flows are safe: the open-trip sheet always sends a name (it is a required field), and "Step down" sends an explicit empty name.

Breaks anything that works now: I found nothing. The explicit empty name keeps removal working.

Same problem left elsewhere:
- The family id has the same missing-means-clear behaviour. If a request has a name but no family id, the family is silently cleared (fid becomes null). The plan does not cover it. Only old or stale clients would send it, but it is the same bug class. The open sheet sends an empty string for "not on this trip", so a missing key could be told apart from it.
- A notes-only save on a trip that has no treasurer (someone stepped down on another phone) writes notes onto a trip with no treasurer. The next treasurer's sheet pre-fills them. The plan should say whether to refuse that or drop the notes.

More than needed: no. Small. One gap in the wording: the log line "removed the treasurer" would still be written for notes-only saves unless the plan says to change it.

No test: the repo's only test is test/split.test.mjs, so the plan should say how this is checked (by hand, or a test for the server branch).

PROBLEM 2: the stale expense edit

Would it fix it: the core idea is right, and it copies an existing pattern. saveExpense already reloads the trip on a family_changed refusal and redraws (app.js about lines 1305-1308). But the plan leaves out three things that make it fail as written:

1. The draft keeps the old revision. S.draft is built from the expense, including rev and created_at. renderEditor keeps S.draft when the id matches, so a reload alone does not change it. The plan has to copy the new rev and created_at into S.draft explicitly.
2. The reload brings back the stale form from sessionStorage. keepDraft runs on input and click, and the save click has already stored the old revision before the refusal arrives. A reload right after the refusal therefore restores the old revision. This is the "reload brings back the same stale form" symptom. Call keepDraft after updating the revision.
3. The server gives the revision refusal no code (index.ts, about line 766, a plain 409). The client branch keys on e.code, so the server must add a code, and the plan does not say so.

The deleted case is also wrong as planned. A deleted expense returns 404 "No such expense" before the revision check, not the revision message. A reused id returns a different 409 ("deleted on another phone"). The plan's trigger only matches the revision message, so both need their own branch.

Blind overwrite: the form replaces B's values with A's, so A never sees what B changed. "Check them" and "save knowingly" then mean guessing. The app already has a read-only expense view (renderExpenseView) that could show B's version beside A's typed values. Also, "go back to keep theirs" throws away A's typed text, and the message does not say so.

Same problem left elsewhere:
- Other 409s on this screen reach the same dead end with no reload: the generic "This expense or the trip just changed on another phone" message, and "That receipt was replaced on another phone". The plan covers only one message.
- Delete uses the same revision check, and the delete button only shows a toast, so a stale delete keeps failing until the screen is reopened.
- The treasurer sheet's stale() refusal ("This screen is out of date") is the same dead end and is not in the plan.

Would it break anything that works now: I found nothing. The plan keeps the new revision on the next save, so the server's "same edit resent" check (rev minus one, same fields) still behaves.

More than needed: the reload-and-keep step is close to the minimum. The extra is the message wording and whether to show B's version, which is a design choice for Frank.

WHAT HOLDS UP
- Problem 1's diagnosis is exact, and the explicit empty name keeps Step down working.
- Problem 2's diagnosis is right, and the reload is the same mechanism the app already uses for family changes.
- The "Back" question at the end is fair to leave for now.

Key files: /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl12/rules/src/index.ts (treasurer PUT about 545-570; expense PATCH about 740-800; stale/closed helpers about 150) and /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl12/rules/public/app.js (api and act about 86-127; waiting/draft code about 1175-1260; saveExpense about 1262-1322; volunteerSheet about 1455-1482). Line numbers are approximate.
