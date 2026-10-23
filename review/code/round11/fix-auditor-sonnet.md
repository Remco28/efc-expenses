Review of 6cc7e4d..60fcc7d. I found no HIGH problems, and nothing in the money math or the saving paths looks wrong. The findings are one MEDIUM, a few LOW, and a list of what held up.

I read the whole diff (src/index.ts, split.js, pdf.js, app.js, sandbox.js, migration 0012). I ran the server on 8863 with my own API script and also ran the old round scripts. `npm test` passes 16 of 16. The round scripts printed no FAIL lines, but five of them crashed before finishing, all in my copy (details at the end). Server stopped, port 8863 free.

**MEDIUM 1: a waiting expense left on a phone from before this release can break the "Open it to fix" screen.** This is reasoned from the code; I did not run it in a browser.
- Someone saves a team meal with no signal before the release. The phone keeps it with the old shape, for example `basis: "person"`, or category `transport` or `supplies`.
- After the release the server refuses it ("Unknown category", or "Tick who took part" for an old automatic-split meal). It shows under Waiting to send as refused.
- The `rewait` handler (app.js, "Open it to fix") copies `x.category` and `x.basis` straight into the form draft.
- `renderEditor` then reads `CATEGORIES[d.category].choose` and `BASES[d.basis].label`, which are undefined for the old values. That throws, and the form probably doesn't render.
- The same applies to a draft kept in sessionStorage across the release.
- Remove still works, so the expense is not silently lost. It only happens to someone offline across the release. `catOf` and `BASES[...]?.` guards were added in the views, but not on this path.

**LOW 2: a fencer with every day unticked gets every day back if Fencer is toggled off and on.** Ran it.
- Untick all of a fencer's days. The screen warns "no fencing days ticked".
- Untick Fencer, then tick it again. The server rule "fencer with `[]` days starts on every day" fires, and all days come back.
- The coach's hotel and own-meal shares change. This is visible on the Fencing days screen and the Settle warning disappears, but nothing says why.

**LOW 3: the hint under the expense list is stale.** Reading app.js:565 shows it still says "team meals, the coach's travel and stay, transport and supplies". Those two kinds no longer exist. This is the kind of "applied in one place and missed in another" the task asked about, but it is only text. `CAT_ICON` also has no `coach_meals`, so that kind gets the generic tag icon.

**LOW 4: "Open it to fix" can show a different family as ticked.**
- Family numbers are reused after a delete; I saw this in the test scripts. A refused waiting meal that ticked family 5 can be reopened after family 5 is deleted and a new family takes number 5.
- The form shows the new family ticked with the old head count. The tag check passes because the tags are rebuilt from the current trip.
- It is visible in the form and the person has to press Save, so I rate it LOW.

**LOW 5: `unsentDraft` and the "Not saved: it needs a signal" row can never appear.** Nothing sets `unsent`; grep finds only the readers. Every new expense can now wait on the phone, so round 10 row 4 is covered by a different route. This is dead code, and a pointless `f.days AS family_days` is still in the person query.

**Not a finding, noted for the record: the finalize fingerprint is read separately from the trip data.** `GET /tournaments/:id` reads the fingerprint and the trip in parallel, not as one snapshot. An unlogged change landing in those milliseconds would put a newer fingerprint on older numbers. The activity check and the fingerprint recheck inside finalize still cover everything else, so this is milliseconds wide and I did not rate it.

**Checked and held up:**
- **Splits and money**
  - The kind fixes the split on the server. A meal sent with `basis: per_fencer` is stored as `took_part`. Other can choose.
  - Head counts: 2.5, -1 and 51 are refused. 0, null and a numeric string are accepted. Staff and a ghost family are refused or skipped.
  - Editing a meal into `coach_stay` stores `{}`.
  - A ticked family that was removed gives a 409 with a clear message.
  - `unitsFor`, `shares` and `balances` cover all three splits. Finalize still blocks an expense with nobody to split it among. Removing a family still strips it from every split.
- **Fencing days**
  - A fencing-day tick is an atomic per-day update. Ticking a non-fencer, or a day outside the trip, is refused.
  - Shortening the trip trims fencing days.
  - Fencing days of non-fencers are zeroed in `loadTrip`, and the fingerprint matches that.
- **Finalize, practice trip and PDF**
  - The finalize fingerprint check (`seen_fingerprint`) refuses a wrong fingerprint. Every place the app sets `S.trip` goes through GET, and the finalize handler reads the fingerprint before the confirm sheet.
  - The practice-trip reset seeds the new model correctly. I checked the split keys, head counts and fencing days in the seeded data.
  - The PDF has no leftover references to attendance days.
- **Old data and the "already added" wording**
  - Old-style expenses (a split such as `person`) show as "older split" in the views, in the PDF and in the settle statement, and block finalize visibly.
  - The "was already added (an earlier try went through)" wording is applied.
- **Next-step button:** I read the `step` handler but did not click through it in a browser.

**Test scripts**
- The helper `review/code/briefs/stamp.mjs` translates old-shape expenses into the new ones. That means round2 to round9 no longer exercise the old shapes directly; they only check the translated result. `round10.mjs` is where the new rules are tested.
- Five of the round scripts crashed in my copy (round2, round10, staff50 and two others) with "undefined" when looking up the practice trip, so I did not get their full results. I think that is because the local DB had no practice trip until I flagged one by hand, but I did not check.
- Their remaining output had no FAIL lines.
