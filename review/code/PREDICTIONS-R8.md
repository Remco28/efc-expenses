# Predictions for round 8, written before it ran

Round 8 is the first run of the updated review-loop skill and its code-review
profile: short briefs, reviewers who may run their own copy of the app, two
whole-code reviewers with no focus, a fix auditor on ddd5fc4, one specialist
(money), and a disposition auditor on our own triage.

## Per fix (ddd5fc4), what the fix auditor should say

| Fix | Prediction |
|---|---|
| EFC-01 expense revisions | Landed. Most likely "landed and broke something adjacent": removing a family rewrites expense splits without bumping their revision, so an editor left open can still save a split from before the removal |
| EFC-02 back to family days | Landed |
| EFC-03 family and person tags | Landed, with a note that the tag is checked before the write rather than in it (a race inside one request); and that a page from before the release must reload |
| EFC-04 PDF receipts | Landed. Possibly: the test embed doubles the work for a large PDF receipt |

## Per round

- **HIGH: 0 or 1.** If one comes, it comes from a whole-code reviewer, in an area no round has named: logging in and the access code, the AI receipt reader, or the practice trip.
- **MEDIUM: 3 to 6**, mostly two parents acting at once, in routes the rounds touched less (trip details, payments, the treasurer).
- **The money specialist finds no wrong amount in the math itself.** Anything it finds is in what a screen shows, not in what anyone owes.
- **The two whole-code reviewers overlap on at most one finding.**
- **The disposition auditor contests one or two of our ratings**, most likely the LOWs where our reason was "rare timing", and the round-6 decision to leave the expense created_at check optional.
- **Running the app changes what comes back:** more findings arrive with a reproduction, and fewer are argued from reading alone.
