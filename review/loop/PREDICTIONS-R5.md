# Predictions, round 5: family screens at scale (written before the round)

Artifact: the new Families list, Manage family screen (saves on every tap), Check a day, and "+ Add my family". Trip: 15 families, 37 people, 7 days.
Cast: 5 parent personas and 1 accessibility specialist, all claude-haiku-5-5.

- All tasks pass. Tier 1: 2 to 4.
- Likely tier 1: saving on every tap. Someone looks for a Save button, or the "Saved" note in the header goes unseen. Also "Different days?" vs family days may confuse whoever has to set a parent leaving early.
- Fencing chips greyed out for days a person isn't there: someone won't understand why they're disabled.
- The dropdown picker works, but someone misses "+ Add my family" under it.
- Accessibility: the day chips need aria-pressed (they have it), and saving re-renders the page; focus restore should hold.
