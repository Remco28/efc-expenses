### [HIGH] Category changes discard sharing edits made in the same form

public/app.js:849. Scenario: Open an automatic $120 meal shared by families A, B and C, each with one fencer. Untick C, then correct the category to Coach travel and save. Unticking sets `splitTouched`, but leaves `basisTouched` false, so the category change calls `resetSplit()`. Wrong outcome: C is silently included again; each family owes $40 instead of A and B owing $60 each. Suggested fix: Protect exclusions and hand-set counts made during the current editing session when applying a category’s suggested basis.

### [MEDIUM] A new family can retain chargeable days outside shortened trip dates

src/index.ts:496. Scenario: Adding family A reads Saturday–Sunday as the allowed days. Another phone shortens the trip to Saturday and finishes trimming attendance before A’s INSERT executes. A is inserted with both days; subsequently adding its fencer inherits both as attendance and fencing days. Family B’s fencer attends Saturday only. Wrong outcome: A $300 coach-stay expense splits $200/$100 instead of $150/$150. Sunday is invisible in the attendance controls, and finalization accepts the inflated count. Suggested fix: Derive or clamp family attendance against the current tournament dates inside the INSERT; apply equivalent protection to attendance writes using previously read date limits.

### [MEDIUM] Payment identity check still permits updating a replacement payment

src/index.ts:458. Scenario: A payment-tick request reads its payment and final trip status. Before its UPDATE executes, another phone reopens the trip, changes expenses and finalizes again, reusing that payment ID for a different family or amount. The request’s identity check compares against its earlier read and passes. Wrong outcome: The unconditional UPDATE marks the replacement payment paid even though that payment was never received or sent. Suggested fix: Check payment identity and final status within the UPDATE itself, rejecting zero affected rows. Use a non-reused payment ID or finalization generation to distinguish replacement rows.
