# Predictions for round 11, written before it ran

Round 11 is round 4 of the updated method, and the first review of the rebuilt split (billing-model.md). It reviews 7b2be8a. Cast: two whole-code reviewers (Sonnet, Haiku), a fix auditor on 6cc7e4d..7b2be8a (Sonnet), a bad-signal reviewer (Haiku), and, new this round, a rules reviewer (Sonnet) holding the app to billing-model.md.

- **HIGH: 1 or 2**, in the rebuild: most likely a screen or path still written for attendance days (the "you" card, steps card, an old hint, the activity log), or a split rule the server and the screen apply differently (Other, or a kind changed on an edit).
- **MEDIUM: 4 to 8.** The rebuild is big and touched every screen.
- **The rules reviewer finds at least one place the app disagrees with billing-model.md**, probably in wording (a hint that still says "per person" or "there that day") rather than in the money.
- **The fix auditor finds something the test-helper translation hid**: an old script still passing because stamp.mjs rewrote its expense, while the real app would behave differently.
- **The whole-code reviewers overlap on at most one.**
- **The disposition auditor finds one rating too soft.**
