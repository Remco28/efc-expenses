I read problems.md and the code (public/app.js, mostly saveExpense, refusedAfterLeaving, show/route, famSave, fencingSave). I changed and ran nothing.

PROBLEM 1: an edit walked away from mid-save, then refused or unanswered, is lost

What is happening:
- Once the parent leaves the form, `show()` calls `leaveDraft()` on any trip screen other than the editor. That clears `S.draft` and the sessionStorage draft.
- `saveExpense` still holds the draft object `d`, so it knows what was typed. When the answer comes back, `refusedAfterLeaving` keeps a new expense as a "Couldn't send" entry in Waiting to send, but for an edit it only toasts.
- There is a second hole. The paths that check `S.draft !== d && !e.unsure` (the pre-check fetch, and the PATCH) skip `refusedAfterLeaving` when the failure is "no answer". For an edit that has left the form, that falls through to a plain toast, so a no-answer edit is lost the same way.

Simplest right fix:
- Use the "Waiting to send" card the app already has. When an edit is left and then comes back refused or unanswered, store the whole draft, including its `base`, `created_at`, `rev` and `id`. Store it as its own entry in the same localStorage list, marked as a refused edit and keyed by expense id, not `client_key`. Do not store the request body, because `base` is what makes the merge work.
- The card shows it as "Your change to X couldn't be saved. Open it to fix". Opening it sets `S.draft` to the stored draft and goes to `#/t/N/e/<id>`.
- `renderEditor` already handles the rest. If the expense's `rev` or `created_at` moved, it merges the parent's changed fields onto the newest version, or says it was deleted. If their own save had actually landed, the merge is effectively a no-op. That is the "reply lost" case it was built for.
- Remove the entry when the editor save succeeds, when the parent taps Remove, or when the expense is gone.
- Do this for every left-the-form failure of an edit, "no answer" included. Not only for refusals.

Why not just keep the sessionStorage draft: `show()` runs `leaveDraft()` on the next trip screen or on return to the app, so it would be wiped again. It is also a single slot, and the next editor the parent opens overwrites it.

Costs:
- A small amount of code, plus one more entry type in the waiting list.
- The card and the home-screen line ("expenses on this phone, not sent yet") need wording for edits.
- `sendWaiting` and `settleWaiting` must skip these entries. `sendWaiting` already skips anything marked refused, and `settleWaiting` matches on `client_key`, so a distinct key is safe.

What it might break:
- Entry-type assumptions in the waiting list. The `rewait` action reads `w.body` and builds a new expense (id 0). Edits need their own open action, or `rewait` will mishandle them.
- Opening two stored edits for the same expense is avoided by keying on expense id, so a newer failure replaces an older one.
- localStorage is shared across tabs, so the entry shows in all of them. That is probably what you want.

Same problem elsewhere:
- Delete and the other expense actions carry nothing typed, so the loss is only a toast.
- The family and staff text fields are saved on blur when the app is hidden, so they are not affected.
- I found no other path where typed work is dropped after leaving.

PROBLEM 2: a failed tap still shows as saved

What is happening:
- The tap flips the button before saving. That happens in `wireFamily` (`flipBtn`) and in `renderFencing`.
- After the save, `famSave` and `fencingSave` redraw only if `loadTrip` succeeds. With no signal the reload throws. `famSave` swallows it in its outer catch, and `fencingSave` swallows it too. Nothing redraws, so the flipped button stays.
- A typed name or pay note has the same cause: the field keeps the typed value because nothing redraws.
- `S.trip` was never updated, so it still holds the last server truth.

Simplest right fix:
- In both functions, treat a failed reload as "redraw from what we have". Wrap `loadTrip` in its own try/catch. A thrown error means "couldn't reload", so carry on and re-render from the current `S.trip`, but only if they are still on the screen (`here()`).
- A reload that returns false (they moved on) still returns without drawing, as now.
- In `famSave`, the existing code that carries over the field being typed in, the new-person name and the Fencer checkbox keeps working, since it runs before the redraw.
- The redraw puts back the last known server state. Taps revert and unfocused text reverts. The toast already said it didn't save, so the screen no longer contradicts it.
- In the "may or may not have saved" case the redraw shows the old state, which could be wrong if the save did land. That is honest enough, because the message says to check. The next successful load corrects it.

Costs:
- A few lines in each of the two functions.
- A failed save now throws away a typed name or pay note instead of leaving it on screen. If you would rather keep the typed text and only revert taps, you would need extra code to carry it over, which I would not do.

What it might break:
- The add-person handler (around line 869) re-enables its button only if the same form element is still there. After a redraw it is a new element. The fresh form is already enabled, and the handler already restores the typed name when the add failed, so this should be fine. Check it.
- Focus and scroll are re-applied by `focusKey()`, as on the normal path.

Same problem elsewhere:
- Yes, in all three of these places. Look at the other optimistic UI:
  - the family screen's fencing-day taps;
  - the Fencer checkbox, which is flipped by the browser itself;
  - the staff and family text fields (line 752, `save1`), which go through `famSave`, so the one fix covers them;
  - the fencing-days screen, which has its own queue and needs the same change.
- The expense editor does not behave this way, because its changes are kept in the draft.
