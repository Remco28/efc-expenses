# EFC Expenses — CODE REVIEW — 2026-10-24 (UTC)

**REVIEW COMPLETE — REPORT ONLY — NO APPLICATION CODE CHANGED**

Reviewed commit: `d4b7f66395d4f43e79cc4a9a9a7b4b7b833b6acb`.
Reviewer: Codex (`codex-3826`). This is a fresh review after the billing and saving changes, focused on medium to severe issues. The current rules in `review/design/billing-model.md` and the updated saving design are the requirements used here.

## Findings

**Six reproduced findings: 2 HIGH, 4 MEDIUM. No critical issue confirmed.** HIGH means realistic use can silently lose a material edit or change the wrong trip. MEDIUM findings below require a narrower interleaving or leave a visible opportunity to recover, but can still affect saved data or payments.

| ID | Severity | Finding | Primary location |
|---|---|---|---|
| R2-01 | HIGH | A delayed fencing refresh can send a later action to the wrong trip | `public/app.js:893–904`, `287` |
| R2-02 | HIGH | Corrections made during Save's preliminary trip check are silently discarded | `public/app.js:1212–1253` |
| R2-03 | MEDIUM | Restored meal drafts can charge a replacement family on a reused ID | `public/app.js:921`, `1203–1204`, `1220–1225` |
| R2-04 | MEDIUM | A name-only PATCH can undo another parent's Fencer change | `src/index.ts:648–673` |
| R2-05 | MEDIUM | A response can show one treasurer but carry a fingerprint for another | `src/index.ts:167–185` |
| R2-06 | MEDIUM | Adding a person can pass the family-tag check, then insert into a replacement family | `src/index.ts:626–637` |

### R2-01 — HIGH: Check navigation before replacing shared trip state

**Location:** `public/app.js:893–904`; `loadTrip()` at line 287; routing at lines 251–262.

The fencing save refresh calls `loadTrip()`, which unconditionally assigns its response to `S.trip`. Its second `here()` check prevents redrawing the old screen, but runs **after** this assignment. Navigation to a different trip waits for `famQueue`, not `fenceQueue`, so the newer page can finish loading first.

**Reproduction in Chromium against the isolated Wrangler app:**

1. Open trip A's Fencing days and tap a day.
2. Delay the GET that refreshes A after the successful PATCH.
3. Navigate to trip B's Treasurer tab and let B finish loading.
4. Release A's delayed response.
5. On the page still headed with B's name, volunteer as treasurer and save.

**Observed:** the heading remained **“Second review trip”** and the URL remained `#/t/2?tab=treasurer`, but the saved treasurer appeared on **trip 1**. Trip 2 still had no treasurer. The test used the unchanged browser code; only delivery of the earlier GET response was delayed.

**Impact:** the visible page and the object used by its action handlers disagree. This is a demonstrated write to the wrong trip, with implications for other handlers that read `S.trip`, including finalization and PDF export. Those additional handlers were not separately reproduced.

**Suggested correction:** fetch into a local variable, capture the originating trip/route, and verify it is still current **before assigning `S.trip`**. Apply the same rule to asynchronous refresh helpers. Checking only whether to render is too late. Regression coverage should navigate through another trip while the fencing refresh is delayed and assert both the displayed trip and the destination of a subsequent write.

### R2-02 — HIGH: Protect the form throughout Save, including the preliminary GET

**Location:** `public/app.js:1215–1231,1247–1253`.

`saveExpense()` builds the request body before awaiting its fresh-trip GET. It disables Save and makes the form inert only after that GET finishes. During the wait, the user can change amount, description, category or payer, but the eventual request still contains the earlier values. A successful save then clears the draft and closes the form.

**Browser reproduction:** enter a valid $60 coach-travel expense and press Save. Delay only the preliminary `/api/tournaments/<id>` GET. While it waits, change the visible amount to $80, then release the response.

**Observed:** Save remained enabled and the form was editable during the delay. The browser sent `amount_cents: 6000`, the server stored **$60**, and the app said **“Expense saved”**, discarding the visible $80 correction.

**Impact:** slow venue connections create a substantial window for silently losing financial corrections. The existing freeze protects the POST/PATCH phase, but not the whole save operation.

**Suggested correction:** lock the operation before the first await, restoring interactivity on every exit path, or explicitly detect intervening edits and require confirmation/restart using a freshly validated body. The preliminary-GET failure path that holds an expense on the phone must follow the same rule. Add a delayed-GET browser regression, not just a delayed-POST test.

### R2-03 — MEDIUM: Persist the original family tags with an unfinished expense

**Location:** `public/app.js:921,1203–1204,1220–1225`.

An ordinary draft remembers numeric payer and split IDs but does not retain their original family tags. After a reload, `saveExpense()` manufactures `paid_by_uid` and `split_uids` from the **current** trip. If a deleted family's number has been reused, the draft's old selection is therefore certified as belonging to the replacement family. The fresh-trip check also compares two current versions, so it cannot recover the selection's original identity.

**Browser reproduction:**

1. Start a $30 meal paid by Chen and tick Bennett as its participant. Leave it unfinished so it is kept in session storage.
2. From another client, remove Bennett and add Torres, which reuses the highest family ID.
3. Reload the original expense form and save it.

**Observed:** the retained draft contained a numeric split and no `split_uids`. Torres appeared already ticked with $30, and Save succeeded with **“Expense saved”** and a split charging Torres. The description still read **“Meal for Bennett”**. No changed-family warning appeared.

**Impact:** an unfinished bill can charge a family that never took part. The replacement name is visible on the restored form, so this is rated MEDIUM rather than HIGH. The same loss of original identity exists for the draft's numeric payer. The special “Open it to fix” path for refused waiting items checks tags; ordinary kept drafts do not.

**Suggested correction:** capture immutable tags when a payer or participant is chosen, retain them with the draft, and validate them on restoration and save. If a selection no longer names the original family, clear it and explain why; do not attach a fresh tag to an old selection. Treat identity-less legacy drafts explicitly.

### R2-04 — MEDIUM: A partial person update must not rewrite unrelated fields from an earlier read

**Location:** `src/index.ts:648,669–673`.

The name/Fencer branch always writes both `name` and `is_fencer`. When a field is omitted, its value comes from the person SELECT earlier in the request. The UPDATE checks identity, open status and trip dates, but does not check that these field values are unchanged.

**Controlled handler reproduction:** pause a name-only PATCH after its initial person SELECT. Let another request successfully untick Fencer. Resume the name PATCH.

**Observed:** both requests succeeded with HTTP 200. The person was renamed to Alexander **and became a fencer again**, restoring the saved fencing day that the app deliberately retains when Fencer is unticked.

**Impact:** a harmless spelling correction can undo another parent's change to who shares coach travel, hotel and meals. This requires two requests to overlap, hence MEDIUM. The reverse ordering can overwrite a concurrent name correction as well.

**Suggested correction:** update only explicitly supplied fields, or read untouched values inside the SQL statement. If using optimistic concurrency instead, compare a revision atomically and surface the conflict. Test a name-only PATCH against a concurrent Fencer toggle.

### R2-05 — MEDIUM: Include the tournament row in the fingerprint's snapshot

**Location:** `src/index.ts:167–185`; finalize uses the fingerprint at lines 445–481.

The families, people, expenses, payments, activity and fingerprint now share one database batch. However, the tournament row returned to the client is still read **before** that batch. The fingerprint itself includes the treasurer's identity. A treasurer change between those reads produces a response whose visible tournament row and fingerprint describe different versions.

**Controlled handler reproduction:** start GET trip with Lisa Chen as treasurer. After its first tournament SELECT, change the treasurer to Laura Bennett and complete that change before the batch. Finalize using exactly the activity maximum and fingerprint returned by that GET.

**Observed:** the GET showed **Lisa Chen**, but finalize returned **200** and locked **Laura Bennett** as treasurer, with the payment plan for Bennett's family. Both client checks accepted the mixed response because its fingerprint and activity already included the newer treasurer.

**Impact:** the “finalize only what this screen showed” guarantee still has a gap. This is a narrower race than R2-01, so MEDIUM. It is a remaining path in the snapshot class addressed after round 11, not a re-report of the already-fixed separate expense/fingerprint reads.

**Suggested correction:** return the tournament row from the same atomic batch as the other rows and fingerprint, checking missing/deleted status against that snapshot. Test a treasurer change between the former first read and batch boundary.

### R2-06 — MEDIUM: Repeat the family identity condition in the person INSERT

**Location:** `src/index.ts:626–637`.

Adding a person checks the supplied family `uid` in a SELECT, but the INSERT later checks only the original tournament's open status and date span. It does not require that `family_id` still names the family whose tag was validated.

**Controlled handler reproduction:** start adding Laura to Bennett. After the family-UID SELECT passes, remove Bennett and add Torres with the same numeric ID, then resume the pending add.

**Observed:** the original request returned **201** and added Laura as a fencer to **Torres**, despite carrying Bennett's old tag. The replacement family had a different UID. No foreign-key error occurs because the numeric parent ID exists again.

**Impact:** a person can be attached to an unrelated family and change that family's coach-travel allocation. It requires a delete/re-add to overlap an in-flight add, so MEDIUM. Existing UID guards on PATCH/DELETE correctly stop ordinary stale screens; this separate create path needs the same write-time protection.

**Suggested correction:** make the INSERT conditional on the current family's ID, UID and expected tournament in the statement that writes the person. Return a conflict if the original family no longer exists. A successful pre-write SELECT is insufficient.

## Verification and scope

Reviewed the current Worker, browser routing/edit/save/queue flows, shared math, PDF export, migrations, configuration and the current billing/saving requirements. Compared the earlier review's findings with the changes; intentional design limits such as no cross-phone duplicate detection, no offline opening, and explicit head counts are not findings.

- **TypeScript:** `npm run check` passed.
- **Unit tests:** `npm test` passed; explicit `node --test --test-isolation=none --test-reporter=spec test/split.test.mjs` confirmed **16/16** cases.
- **Local Cloudflare runtime:** initialized all **12 migrations** in a fresh database under `/tmp`, seeded the practice trip and ran a separate Wrangler dev server on port 8829. No production database or R2 bucket was accessed.
- **Existing API checks:** all **111 PASS checks across nine scripts**, with zero FAIL lines: `regress` 12, `staff50` 8, `round2` 9, `round3` 16, `round4` 5, `revisions` 9, `round8` 13, `round9` 6, `round10` 33. Copies changed only the local port; the test helper's existing translations were retained.
- **Browser reproductions:** R2-01, R2-02 and R2-03 ran against that unchanged app copy in Chromium. Delays controlled response delivery, not application behavior.
- **Server interleavings:** R2-04, R2-05 and R2-06 exercised the unchanged, bundled Worker handler with an in-memory SQLite database built from the same migrations and a small D1 adapter. Hooks paused specific reads and completed competing requests before resuming. These give deterministic reproductions of the handler/SQL races; they are not measurements of their frequency on deployed Cloudflare infrastructure.
- **Earlier safeguards checked:** the stale expense revision test now returns 409; the populated PDF receipt with a trailing blank page now exports successfully. Family attendance/own-days handling from the earlier review has been removed by the new billing model. Existing tag/revision regressions pass.
- **Excluded candidate:** capture-phase draft persistence initially appeared one keystroke behind, but an actual browser reload preserved the complete $120 value through the visibility handler. It is not counted as a finding.

Temporary app copy, local database and API logs: `/tmp/efc-review-20261024/`. Deterministic server probe: `/tmp/efc-review-20261024-probes.mjs`. These are scratch artifacts, not repository changes. External receipt-model availability, production quotas and deployment operation were not tested.

**No fixes, source changes, commits, deployments or production-data changes were made.** Prioritize R2-01 and R2-02; the remaining fixes should preserve original identity and make each read/write boundary consistent without changing the agreed billing rules.
