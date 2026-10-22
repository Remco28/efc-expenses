# Predictions, round 1 (written before any reader ran)

Artifact: commit aa37296 plus the uncommitted panel and vendor-field fixes. Each reader uses a private local copy at http://127.0.0.1:880N.
Cast: 8 readers, all on claude-haiku-5-5. With a single model, an agreement between readers is a strong hint, not proof.

## Shape of the round
- All six task readers complete their task. Nobody fails outright. Tier-1 count: 3 to 6.
- The likely tier-1 findings:
  1. The "Who's included" list in the expense editor: grey auto numbers next to editable boxes read as ambiguous ("do I have to type these?").
  2. "Per fencer-day" is jargon on first sight.
  3. The steps card's "Next:" text is long and competes with the "your family" card on a phone.
  4. On a phone the attendance grid scrolls sideways, and on a 3-day trip some readers won't notice; on longer trips the hidden days would be missed.
- Likely tier 3: the amount of text in hints, and whether gold buttons read as primary.
- The visual specialist calls it finished-looking, with some nitpicks about small, low-contrast grey text.
- The accessibility specialist finds that the bottom-sheet panels don't trap focus, and possibly the contrast of the grey hint text.

## What would surprise me
- A reader who can't find where to add an expense, or what they owe. That would mean the "your family" card or the button placement failed.
- A reader who misreads the treasurer model, for example thinking they pay several people.
