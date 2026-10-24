# Round 12: the problems, and the author's plan (no code yet)

## Problem 1: a notes-only treasurer save wipes the treasurer
On a final trip, the treasurer's sheet sends only the payment notes (`treasurer_notes`), since the treasurer itself can't change. If the trip is reopened before Save is tapped, the server (PUT /tournaments/:id/treasurer) handles the request as an open trip, reads the missing `treasurer_name` as an empty name, which means "remove the treasurer", and clears the name, the family and the notes. "Saved" is shown.

**Plan:** a missing `treasurer_name` is never a removal. If the request carries no `treasurer_name`, only the notes are updated, on an open or a final trip alike. Removing the treasurer stays an explicit `treasurer_name: ""` (which is what the sheet's "Step down" sends).

## Problem 2: an edit refused because someone else changed the expense
Parent A edits an expense; parent B saves a change to it first; A's Save is refused ("This expense changed after you opened it"). A's form keeps the old revision, so every Save is refused again; Back throws away what A typed; a reload brings back the same stale form.

**Plan:** on that refusal, the form reloads the trip (only if still on that form), and shows A's typed version on top of the newer revision: the form keeps A's values but now carries B's revision, with the message "Someone changed this expense a moment ago. Your changes are still here: check them, then save to replace theirs, or go back to keep theirs." Saving again then replaces B's version with A's, knowingly. If the expense was deleted meanwhile, the message says so and the form goes back to the list.

## Not changed (question for Frank)
Back from a half-typed new expense discards it, as today: Back is how the form is cancelled.
