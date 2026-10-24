# Round 13: the problems, and the author's plan (no code yet)

## Problem 1: an edit walked away from mid-save, then refused, is lost
A parent edits an expense and taps Save; the form freezes. They leave with the phone's back gesture (which works while the form is frozen); leaving drops the kept draft. The save is then refused (another phone changed the expense, or a family changed), or gets no answer. Only a new expense is kept (in "Waiting to send"); for an edit, a brief message says the change couldn't be saved, and what they typed is gone.

**Plan:** an edit refused (or unanswered) after the parent left is kept as the tab's kept draft for that expense, unless the tab is already keeping a different draft (then only the message). The message says "Your change to Dinner couldn't be saved: … Open it again to pick it up." Reopening the expense finds the kept draft; if the expense has changed since, the existing rebuild runs (keeping the parent's changes on the newest version). The kept draft is only in this browser tab, as all kept drafts are.

## Problem 2: a failed tap on the family or fencing-days screen still shows as saved
On the family and fencing-days screens, a tap (a fencing day, Fencer) flips on screen first, then saves. With no signal the save fails, the reload after it fails too, and nothing redraws: the tap stays showing after the "may or may not have saved" message fades. A typed name or pay note likewise stays as typed.

**Plan:** when a save there gets no answer and the reload can't happen, the screen redraws from the trip as last loaded (what is known to be saved), so a tap that didn't save is shown unticked; the message says "No signal: that change wasn't saved." A text field still being typed in keeps its text (as the redraw already does); a field they've left shows the saved value, and the message names what didn't save.
