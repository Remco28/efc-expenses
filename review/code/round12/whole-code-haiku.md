Review of the EFC trip-expenses app, copy at /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl12/whole-haiku (commit 64a1243). Nothing in /home/frank/Dev was touched. The local wrangler dev server is stopped and port 8872 is free.

**Verdict: no HIGH problems found. One MEDIUM. Two LOW notes.** The money math holds, and the sync/race handling that earlier rounds fixed looks sound on the paths I read.

**What I checked**
- Read all of src/index.ts, public/split.js, and the money, save, offline-queue, family, fencing, editor, settle and treasurer code in public/app.js. I did not read pdf.js or the receipt-reader UI in full.
- `npm test`: 16 of 16 pass.
- Randomised check of split.js (scratch script, /tmp/claude-1000/-home-frank-Dev-agent-office/338f6aba-3ec2-449c-a0be-b0793dfbf9ad/scratchpad/rl12/probe/s2.mjs): 20,000 random trips with mixed kinds, staff, zero-fencer and zero-day cases. Every expense's shares sum exactly to its amount, balances net to zero, and the treasurer plan's money in minus money out equals the treasurer family's balance. 0 violations.
- Ran the app locally and drove the API (probe/s1.mjs): trip with two families, a fencer each, a team meal split by head count (A 2, B 1) and a coach hotel by fencing days (A's fencer 2 days, B's fencer 1 day). Figures match a hand calculation: A owes 4000 net to the treasurer and B is owed 4000 (A is the treasurer). Also ran a stale-revision edit (refused with 409), a trip shortening and re-extension, and finalize. All as designed.
- Not run: the browser UI, the offline queue under a real dropped connection, and the older regression scripts in review/code/briefs.

**MEDIUM 1: a rejected edit loses what was typed, after a visible error (reasoned from code, stale-edit case run on the API)**
- Steps: Parent A opens an existing expense and starts editing (revision 0). Parent B saves a change to the same expense first (it becomes revision 1). Parent A taps Save.
- The server refuses with 409 "This expense changed after you opened it…", which the probe reproduced. The app shows the toast and keeps the form as it is.
- The form still holds the old revision in S.draft (public/app.js saveExpense and renderEditor do not refresh it from the trip). So Save fails again. Going back runs leaveDraft and discards the typed edits. The only way forward is to reopen and retype.
- The same happens after a reload: the kept draft in sessionStorage carries the old revision.
- Revisions also bump when a family is removed from the trip (index.ts, the family DELETE batch), so an open editor can be refused for a reason the parent never saw.
- Why MEDIUM: it needs two people editing the same expense (or one stale editor), it is visible, and the nothing-saved state is clear. But the typed changes are lost.

**LOW 1 (wording): removing a family changes other families' shares silently**
- The family-removal confirm says only "Everyone in it is removed from this trip too." It does not say that the family is taken out of every expense it was ticked on, so the others' shares rise. The billing model lists this as intended, so this is a wording gap, not a bug.

**LOW 2 (comment): the code says late-joining families and fencers pay "from now on", but shares are recalculated live**
- index.ts (families POST) says a family that joins late "shares the coach's costs from now on". In fact unitsFor reads the current families and fencing days, so every unfinalized expense re-splits when a fencer is added or a fencing day is ticked. That is the intended "every fencer on the trip" rule, so the numbers are consistent. The comment is the thing that is wrong, and a parent comparing before and after could be surprised.

**Accepted by design, not counted:** expenses waiting on a phone when the trip is finalized are refused later, with "Couldn't send" on that phone (saving-design-v4 §4, "no reminder on the finalize screen"); trip-date shortening deletes the dropped fencing days (warned, and the warning says it can't be undone); duplicate expenses from a resent waiting item; a reused add key treated as "already added" for a second person with the same name typed again.
