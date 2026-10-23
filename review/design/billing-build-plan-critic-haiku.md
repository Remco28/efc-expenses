Review of billing-build-plan.md against billing-model.md and the current code (read-only; nothing in efc-expenses was changed or run).

WHERE THE PLAN BREAKS OR LOSES MONEY

1. The per-fencer count can silently go to zero. In public/split.js, autoUnits only counts people who have at least one entry in their days list. The plan says people's days are no longer read. If that helper survives in the rewrite, every fencer counts as zero, so coach travel and coach stay split to nobody, or to the wrong families. Per-fencer and fencer-day counts must come from is_fencer and fencing_days alone. Fencer-day counts must also ignore fencing days kept for someone who has been unticked as Fencer (the current loader in src/index.ts does this filter; the rewrite has to keep it).

2. The default for a new fencer is not stated. Today a new fencer fences every day they are there. If the new default is "all trip days", a parent who isn't fencing gets billed for the hotel. If it is "none", a forgotten tick under-bills the coach's stay with no error. Either way it changes money silently. Pick one and say it; the treasurer's check is the only backstop.

3. fencing_days is a column that migration 0012 says is no longer written. Rows created or edited since then hold stale values or an empty list. The plan says to read it "stored directly" without saying it must be rebuilt or cleared first. The practice trip and any trip not cleared by the one-off would show wrong fencing days.

4. Leftover old-model data crashes the app. public/app.js reads CATEGORIES[...].label and BASES[...].label without guards (around lines 543, 973, 990). Once transport, supplies, person, fencer, family and custom are removed, any expense still carrying them throws. The plan has no step that stops this during the window between deploy and the one-off clear, and it does not say the new app must tolerate old values.

5. Phone-held expenses from the old version are not covered. Expenses waiting for a signal are stored on the phone (the efc-wait- entries) in the old shape. After deploy they will be refused, and the plan never says what the parent should do. The one-off clear also removes the trips they belong to.

6. The one-off clear is risky as written. It is a manual step "after deploying". Any trip or expense a parent adds between deploy and clear gets wiped. A hand-written delete also leaves receipt files in R2, because only purgeTrip and dropOrphanReceipts clean those up. The order needs to be: freeze, clear, then deploy, or use the app's own purge path.

7. Unknown families in a split are dropped without an error. expenseInput in src/index.ts skips split keys for families it doesn't recognise (and staff) and saves the rest. For "who took part" that means a tick naming a removed family vanishes and the expense saves with fewer people, with no message. The plan's tag check covers new expenses, but edits and head counts also need refusal rules: no null, no zero, whole numbers only, unknown tags refused.

8. The practice-trip reset is not in the plan. resetSandbox in src/index.ts writes every seeded expense with an empty split and depends on the current shape of src/sandbox.js. A rewritten sandbox with ticked meals needs resetSandbox's SQL to look up families by name and write the splits. Otherwise the reset either writes "nobody included" expenses, which the server's own rule forbids, or throws.

9. "A meal can wait on the phone" needs a client change, not only a server one. Today canWait is false whenever any split value is hand-set (saveExpense in public/app.js). Every "who took part" split holds head counts, so no meal could wait until the tags also reach holdExpense and the saved body. The plan names split_uids but not that client change.

10. The rules say two things about nobody-ticked meals. The plan says the server refuses to save one, and also that such expenses are flagged and block finalize. The flag only arises when the last ticked family is removed. The plan should say that once, and check that an already-flagged expense can still be edited to fix it.

11. Fencing-day ticks need to keep per-day flips, applied on the server against the stored value with a guard, the way rest days work now. If the client sends the whole list, two phones will overwrite each other.

12. The plan does not say what happens to the trip-date trim. The current PATCH still trims the old days lists under a guard. Say whether that code is removed or redirected to fencing_days, and make sure the trim still happens.

WHAT IS MORE THAN NEEDED, OR ISN'T TESTED

- The "API scripts" the plan says to rewrite are in review/code/briefs/*.mjs, not in test/. npm test runs only test/split.test.mjs, so none of the server rules are checked by the normal run. Either wire them in or drop the claim.
- No test is listed for the new server rules: kind fixes the split, Other is the only free choice, head count range, tag mismatch, nobody ticked, staff never ticked.
- Migration 0013 changes nothing. A file that does nothing is only a note. Keep the clear as a documented one-off script, or make it a real, reviewed migration.
- The basis column repeats the kind for everything except Other. Keeping it is defensible for history, but the server has to enforce the match, which the plan does.
- The head count range of 1 to 50 is an invented limit. It is fine, but say so.

WHAT HOLDS UP

- The three splits reduce to the existing share code. Rounding to the cent, balances and the treasurer plan are untouched, so the arithmetic risk is low.
- Making the kind fix the split on the server, with only Other free, matches the rule.
- Staff never pay a share, and that exclusion is kept.
- Adding split and fencing days to the finalize fingerprint covers what moves money. Keeping the fingerprint as the finalize guard fits the code.
- Tagging families in queued meals fixes the reused-id risk, and it is the right way to meet "can wait like other new expenses".
- Dropping the people-level days and rest-day arithmetic removes the place where 0012 needed its extra column. The model is simpler.

Recommended first checks before writing code: decide the new fencer's default, decide what happens to phone-held expenses and to any old-shape data during the window, and move the one-off clear into the same step as deploy.
