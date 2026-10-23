# Predictions for round 9 (round 2 of the new method), written before it ran

Cast: two whole-code reviewers (Sonnet, Haiku), a fix auditor on 4719bbd (Sonnet), a specialist with the lens "a parent at a tournament, on a phone, with a bad signal" (Haiku), and a disposition auditor on round 8's triage (Sonnet). Same brief template as round 8.

## Per fix (4719bbd), what the fix auditor should say

| Fix | Prediction |
|---|---|
| Trip form sends the dates it opened with; shortening asks first | Landed |
| Removing a family bumps expense revisions | Landed |
| Retried new expense found by its key; identical retried edit accepted | Landed. Possible adjacent damage: "identical" compares fields that a later, unrelated edit could make identical again |
| Families checked before saving an expense | Landed; likely note: adding a coach (staff) also forces the refresh, needlessly |
| Unticking Fencer keeps the days | Landed or "missed in one place": some screen still reads fencing days without checking the person is a fencer |
| Reopen names the ticks it saw | Landed |

## Per round

- **HIGH: 0.** Moderate confidence.
- **The field specialist finds that a save that hangs (no reply, no error) leaves the expense form frozen**, because the form is made inert during a save and the request has no time limit. MEDIUM.
- **MEDIUM: 2 to 5** across the round. **The whole-code reviewers overlap on at most one.** Likely areas no one has looked at closely: the treasurer screens, coaches and staff, the practice trip.
- **The disposition auditor contests 2 to 4 of round 8's ratings**, most likely the items left unfixed as "judgement" (Back discarding a draft is lost work, which the scale may call MEDIUM).
