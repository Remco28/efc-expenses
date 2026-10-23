Review of billing-build-plan.md against billing-model.md and the current code. Nothing was run or changed.

**What holds up**
- The core design is sound. The kind fixes the split, and only Other can choose. `{ familyId: headCount }` for who-took-part is saved as entered, so a later sibling or family-size change can't alter past meals. Both of those match the owner's rules.
- The two automatic splits are computed live: a family counts its fencers, or its fencers' ticked days. Ava's example (6 shares, she pays 2) comes out right. A family with two fencers just sums.
- Reusing `shares`, rounding, balances, the treasurer plan, the revision guards and the client keys keeps the money trail that works today.
- The family tags on queued meals (`split_uids`) fix a real hazard: a family id reused after a delete can't be charged by mistake.
- Keeping a person's ticked days when Fencer is unticked protects a parent from an accidental tap.
- Leaving the old columns in place and clearing the trips by hand avoids a risky data migration.

**Where it can give a wrong result or lose work**

1. **Concurrent ticking on the trip-wide Fencing days screen.**
   - Today's code deliberately makes per-day flips in SQL, and guards whole-list writes with `days = ? AND rest_days = ?`.
   - The plan says `fencing_days` is stored directly but doesn't say how a tap is saved.
   - If it sends the whole list, several parents ticking at once (the point of that screen) either get 409s on most taps or silently overwrite each other's ticks.
   - It should set or clear one day at a time, inside the database.
   - That endpoint also needs the same open-trip and trip-dates guards the other writes have. The plan never says "until finalized" is enforced for it.

2. **Fingerprint and the pre-save "who's on the trip changed" check are written for the old columns.**
   - `FINGERPRINT_SQL` reads `p.days` and `rest_days`, and the check compares `f.days` and `p.days`. Both must be rewritten, not just extended.
   - The fingerprint should count `fencing_days` only for people who are currently fencers. Otherwise hidden days on a non-fencer can cause false "something changed" blocks at finalize.
   - The form check as planned bounces a parent's meal save whenever anyone anywhere changes a fencing day, or a family's size. Neither affects a who-took-part meal, since head counts are saved as entered.
   - During a tournament, with parents ticking days, that will fire constantly. The bounce re-renders the editor, so the typed head counts must survive it.
   - Compare only what the expense depends on. For who took part, that's the family ids and kinds. For the other two, the fencers and their days.

3. **The window between deploy and the hand-run clearing.**
   - Until the one-off runs, old rows have bases `person`, `family`, `custom` and `fencer`. New code reads these as zero units, so every old expense shows "nobody included" and finalize is blocked.
   - The PDF and the expense view for old trips may also misbehave.
   - Clear and re-seed in the same step as the deploy, or clear before it. Also check that the practice-trip reset path works from the new seed.

4. **Old and stale clients.**
   - A phone with the app open during the deploy still runs old JS. `autoUnits` calls `p.days.length`, which throws if the API stops sending `days`.
   - Either keep sending harmless empty `days`, or make the app reload when the API changes. I found no service worker; check the cache headers on `app.js` and `split.js` too.
   - Expenses waiting on a phone in the old format come back as "couldn't be sent" and are kept, not lost. They can't be edited, only removed, so say so in the notes.

5. **Queued meal refused on a tag mismatch.**
   - A waiting expense is only removable, not editable. If a ticked family was removed in the meantime, the parent has to retype the whole meal and head counts.
   - Say in the message which family was the problem, and consider letting the refused one be reopened as a draft.

6. **No default for a new fencer's days.**
   - Today a new fencer fences every day they're there. In the new model the plan says nothing, and a new fencer will probably have none.
   - Because the owner chose "warn, block nothing", a fencer left at zero days silently shifts the hotel to the others.
   - The "Ava has no fencing days ticked" warning must show where the treasurer finalizes, not only on the Fencing days screen.

7. **Receipt reader.**
   - The model must now tell "coach's own meals" (breakfast, coffee, lunch) from "team meal". The existing hint says a single-person meal is usually the coach's.
   - A wrong guess changes who pays, and the kind is fixed. Show the chosen kind with its split sentence on the form so a parent notices.
   - The zod enum is built from `CATEGORIES`, so removing `supplies` and `transport` there automatically changes what the model sees.

8. **Shortening the trip.**
   - The trim must cover every person's fencing days, including non-fencers' hidden ones. The plan's prompt lists only fencers, so check that the stored data and the prompt agree.
   - The current trim touches `people.days` and `families.days`, which are being retired. It needs a new `fencing_days` clause.

9. **Smaller gaps.**
   - On editing an expense, the server must discard the old `split` when the kind or split changes (and, for Other, when the choice changes).
   - Switching Other from who-took-part to another split and back loses the head counts unless the draft keeps them.
   - The plan doesn't mention the activity-log wording or the API notes in the README.

**Rules checked against the plan**
- Coaches and staff never pay: covered. The server drops staff from the split, and units skip them.
- A family that paid can't be removed: kept.
- Removing a family takes it out of every expense: kept, via `json_remove`.
- Finalize blocked for "nobody included": kept.
- Nobody ticked to begin with: the plan requires it on the form but doesn't say how "Tick everyone" interacts with a later-added family. It shouldn't auto-include one.
- Head count above family size allowed: covered, up to 50.

**More than needed**
- Little. The only extra worth questioning is the server refusing an empty who-took-part expense while zero-fencer or zero-day expenses save and only flag. It's harmless, but the rule is inconsistent, and the refusal adds one more path for a queued expense to be rejected.
- Keeping hidden days after Fencer is unticked is cheap, but it is the cause of items 2 and 8. Worth keeping only if those are handled.
