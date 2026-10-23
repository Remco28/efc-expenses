Review of billing-model-v1 against the current app (src/index.ts, public/app.js, split.js, pdf.js, src/sandbox.js, README). I read all of it and ran nothing. I take the rules as given and look only at what could go wrong for parents.

WHAT HOLDS UP
- The core is simpler and easier to explain. Fencing days are the one per-day input, and the old "days at the trip" flow, with its own-days override and rest days, goes away. A parent can see why they owe what they owe.
- "Nobody is ticked to begin with" is the safe default. A forgotten meal blocks saving instead of silently charging the wrong families, which is how the old "automatic" mode could go wrong.
- "The coach is never ticked" removes the old question of whether the coach counts as a head.
- The money layer does not depend on the split rules. Largest-remainder rounding, balances, the one-payment-per-family treasurer plan, the payment checklist, reopen and finalize all work with any set of share counts. Keep them as they are.
- The worked example (six shares for a two-day hotel) is clear and checkable.
- Resetting the test trips instead of converting them is the right call.

GAPS: CASES THE DESIGN DOES NOT SAY WHAT TO DO WITH
1. Empty pools.
   - Fencing days has zero shares until someone ticks days. Equal-per-fencer has zero if no one is marked Fencer.
   - Old behaviour: the expense is flagged "nobody included" and finalize is blocked. That must carry over to these two splits.
   - It is more likely now, because a new fencer starts with nothing ticked. In the old app a new fencer got every day they were there, so forgetting was harmless.
   - The old Settle warning "X has no fencing days ticked" must survive. It should also say that the child still pays the equal-per-fencer items, which brings the next point.
2. A fencer with zero fencing days is treated differently by the two coach splits. They pay the airfare share (equal per fencer) but nothing toward the hotel. That is probably intended for a kid who was injured. But a parent who simply forgot to tick days looks identical, and underpays quietly. The design should say which it is, or the warning in point 1 is the only protection.
3. Head count defaults. "Starts at the family's size" does not say what happens in these cases:
   - Does it keep following the family's size if someone is added later? Or is it frozen once saved? The old app had "automatic" versus "hand-set" for this, and the design needs the same distinction.
   - A family with no people entered has size 0. Ticking it gives a head count of 0, which is the same as unticked.
   - Can a head count be 0? Can it exceed the family size (a guest)?
   - What should the screen show when the saved head count no longer matches the family?
4. Is the split fixed by the kind of expense, or only suggested? The table reads as fixed, except for Other. The old app let the person entering change it. If it is fixed, there is no way to handle a coach lunch the whole group shared, or a hotel that only some families helped pay for. If it is only suggested, the table needs to say so. Either way, picking the wrong kind now silently changes who pays. That makes the saved expense's share preview more important (see "What a rebuild would lose" below).
5. Kind boundaries are fuzzy in ways that move money:
   - "Hotel and getting around: gas, Ubers, parking" does not say whose parking or gas. The old app had a ground-transport kind for the families' own van, gas and venue parking. With it gone, a parent entering the group's van gas or venue parking has to guess between coach hotel and getting around (split by fencing days) and Other.
   - Receipts for food: a restaurant receipt can be a team meal (diner head counts) or the coach's own meals (fencing days). The receipt-reading model chooses the kind for the parent.
   - The design says supplies are the coach's job and snacks are not shared. Nothing stops someone entering them under Other.
   - Other has no default pick. Is it "who took part", like a meal?
6. Late changes to the roster. Fencing-day and equal-per-fencer shares are computed live. If a family joins or a fencer is added after other expenses were entered, everyone's earlier hotel and airfare shares shift. The old app had the same behaviour, but the design should confirm it is intended. It should also keep the existing rule that finalize freezes the numbers.
7. Shortening the trip's dates. Today, days outside the new dates are removed from everyone (the PATCH on /tournaments/:id in src/index.ts). In the new model that deletes fencing-day ticks, and the hotel shares change for every family. The design is silent about warning the user.
8. What happens to fencing-day ticks when someone un-ticks Fencer and later re-ticks it. The old app remembered the rest days so it came back as it was.
9. Fencing days are by definition known only once the pools and brackets are run. Who ticks them, and when? A kid who advances to a second day, or is eliminated early, changes the hotel pool after the fact. The design does not say whether ticks are expected days or days actually fenced, or who may change them. Today any parent can edit any family.
10. A family that paid but was not ticked is fine (they are simply owed). That is worth stating, because the parent entering snacks for a subset may expect otherwise.

PLACES WHERE THE RULES CONTRADICT OR CLASH
- The coach's food is split two ways. A coach plate at a team dinner is billed to the diners by head count. The coach's lunch at the venue is billed to every fencer by fencing days. Which one applies depends on which kind of expense the parent picks, and nothing in the form tells them the money rule differs.
- "Check a day" is allowed to go. But it is the only screen that shows everyone's fencing days at once, and after this change those days are the only per-day input and the main source of hotel money. If it goes, the family screen is the only place to see or fix them. A trip-wide fencing-days view on the Settle screen is worth keeping, and the PDF grid alone is not enough to catch mistakes before finalize.
- "Nobody ticked to begin with" is stated for Who took part. It does not say whether the form offers a quick "everyone" tick. For a large team dinner with a dozen families it is a lot of taps, on a phone, at a restaurant.

WHAT A REBUILD WOULD QUIETLY LOSE OR GET WRONG
1. Offline saving. Today an expense with automatic shares can wait on the phone and send when there is signal. Expenses with hand-set shares cannot (canWait = !handSet in saveExpense in public/app.js). Under the new model every team meal is hand-ticked, so meals (the most common expense, often entered at a restaurant) can no longer be held, and the user gets "This one needs a signal". The design should decide whether ticks can wait offline, or accept the loss.
2. Server-side empty-split check. Today the server only rejects an empty split for custom splits (expenseInput in src/index.ts). In the old model an empty split meant "everyone on automatic". In the new model an empty Who-took-part split means nobody. The server must reject it for that split, or an API caller or old page can save an expense that blocks finalize. Likewise, an empty split object means different things in the old and new models (see the sandbox point below).
3. The consistency fingerprint used by finalize (FINGERPRINT_SQL) reads people.days, rest_days, is_fencer and the expense split, and the client's whoIs check in saveExpense reads family and person days. These feed two protections: "your screen is out of date, reload" on finalize, and "who's on the trip changed since you opened this" on saving an expense. Whatever replaces the columns, the new fingerprint must include everything that now moves the money: fencing days, who is a fencer, family size (the default head count), the ticked families and their counts, and staff versus family. If any of these is left out, finalize can lock numbers that someone else just changed.
4. Cleanup when a family is removed. Today removing a family also strips it from every expense's split, and a family that paid cannot be removed. Keep both. Also keep the rule that staff ids cannot appear in a split.
5. The practice-trip reseed. src/sandbox.js has attendance days (Garcia is there only Saturday), a ground-transport expense (venue parking), and every expense inserted with an empty split. In the new model an empty split means nobody ticked, so the re-seeded practice trip would start with unsplit meals that block finalizing. The seed needs explicit ticks and head counts, and the sandbox expenses must be rewritten to the new kinds. The sandbox is also what the tour tells new users to practice on.
6. Trips in "Recently deleted" (kept 30 days and restorable). Old-model data restored after the change would be in the wrong shape. The reset should cover them or purge them.
7. The receipt reader. The category list is built from CATEGORIES and the model prompt includes "A hotel, flight or meal for one person is usually the coach's" and example descriptions. Both need rewriting for the new kinds. A wrong category now changes the split rule, so the form should show the resulting shares before saving. The old form did, and the new one should keep it.
8. Text that explains the rules is spread through many places and will go stale if one is missed: BASIS_HELP, the tour (the meals, coach travel and van/parking slide), the "nobody included" and "no fencing days" warnings, the Families-screen hints, the Settle and expense-detail text ("X of Y people"), the README table, the PDF summary note, and the PDF line "Per-person costs count the people there on the cost's day". The PDF statement lines use the form "units of total basis". For Who took part that should read as head counts and the families who took part. pdf.js looks up BASES by key for every expense, so any leftover old key would break the download.
9. Behaviour that is fine today and should be kept: shares always add up to the cent; the largest-remainder rounding note in the PDF; the "Share / Paid / Balance" table; the treasurer's own family having no payment; staff excluded from every share.

SUMMARY OF WHAT TO ASK THE OWNER
- Does a head count follow the family size or stay frozen, and can it be 0 or above the family size?
- Is each kind's split fixed or only suggested, and what does Other default to?
- Which kind do the group's van, gas and venue parking go under?
- Who ticks fencing days, when, and expected versus actual?
- Should the form offer an "everyone" tick?
- Can ticks wait offline?
- Does a zero-fencing-day fencer pay the equal-per-fencer items, and does the app warn?
- Should a trip-wide fencing-days view replace Check a day?
