Report on peer13 problems 1 and 2 (read-only: I read problems.md and public/app.js and src/index.ts; I changed and ran nothing, and read nothing else).

PROBLEM 1: an edit walked away from mid-save is lost when refused or unanswered

What causes it: the draft is kept in the tab's session storage on every input and click, so the typed text is not the problem. The loss comes from the trip screen's route. When the parent leaves during the save, the route runs leaveDraft() (public/app.js, near the "expense draft" section, called from show()), and leaveDraft explicitly drops the kept draft. Then the save comes back refused or with no answer. For an edit, saveExpense only toasts (the "couldn't be saved" message from refusedAfterLeaving, or the no-answer message), and the draft is gone. The only place that keeps a failed save is the Waiting list, and that is for new expenses only.

Simplest right fix: have leaveDraft skip the drop while that draft's save is still in flight. Set a small module variable to the draft when saveExpense starts and clear it when the save settles. The existing success path already drops a kept draft whose client key matches, so a save that did land will not come back. A refused or unanswered edit then stays in session storage. Reopening that expense runs the existing kept-draft path in renderEditor, which rebases the changes onto the newest version and shows the "kept on newest version" message. The refused-edit toast should say the change is kept and where to find it.
Cost: about five lines and a toast wording change. No server change.
What it might break: a refused edit can come back later, possibly after the parent has moved on, with a "picked up where you left off" message. It is per tab, so closing the tab still loses it, as drafts do today. If the expense was deleted, the kept draft lingers until the tab closes; renderEditor redirects, so it is harmless. Does not affect new expenses, which keep using the Waiting list.
Elsewhere: the same drop-on-leave happens nowhere else for drafts that I could see. Not checked in depth: the receipt-upload path, if the parent leaves while a photo is uploading.

PROBLEM 2: a failed tap on the family or fencing-days screen still shows as saved

What causes it: the tap flips on screen before the save (fencingSave, and the flipBtn path in wireFamily). A failed save leaves that flip in place. The redraw that would correct it is the reload after the save, and that reload is exactly what fails with no signal. The error is swallowed, and the status text is cleared, so nothing signals the mismatch. The typed name and pay note have the same shape: the field keeps its value because nothing restores it.

Simplest right fix, two parts, both local (no reload needed):
- If the save was refused (the server answered with an error, not "no answer"), put the control back to its last-known state from the loaded trip right away. For a day, that is whether the day is in that person's fencing days. For a text field, that is the old value. For the fencer checkbox, the old checked state.
- If the outcome is unknown (no answer, flagged "unsure"), do not revert, because the server may have saved it. Leave the control as it is and set the status to a persistent line such as "Not sure this saved. Reload to check." Also never blank the status when the reload fails; show the same persistent line.
The server's fencing change is absolute ("set this day on or off"), so retrying a tap is safe; no server change is needed.
Cost: about 10 lines across the two screens, mostly in fencingSave and famSave.
What it might break: if an earlier tap on the same day in a quick burst had succeeded but the reload has not run, the revert uses last-loaded data and could show that day off. That case is rare and the status line covers it. Reverting a refused save also means the parent sees the tap undo itself, which is the honest result.
Rejected alternative: always reload and redraw on failure. It fails under the exact condition in the problem.
Elsewhere: the same stale-control pattern applies to every famSave call on the Manage family and staff screens (name, pay note, staff name and role, the Fencer checkbox). The add-person form already restores what was typed on failure, so it is fine. The trip-settings form (tripedit submit) has a related gap: a refused save throws out of the handler without refreshing, so the typed dates stay as typed with no message; I read this but did not trace it in a running app.
