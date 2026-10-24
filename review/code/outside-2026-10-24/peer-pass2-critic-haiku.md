Review of plan-v2 against the current code (/home/frank/Dev/efc-expenses, public/app.js and src/index.ts). I read only problems.md, plan-v2.md and those two files. I changed, created and ran nothing.

Short verdict: the plan is mostly right and not over-built. Items 1, 3, 4 and 6 close real gaps. But several fixes are described in ways the code doesn't support, and there are gaps the plan doesn't touch, one of which is a real data problem (item 6 below).

Item by item

1. Expired login during a save. The two named paths are the right ones. The real bug is that the freeze is a flag on the whole app and renderLogin never clears it, so the login form is inert today. Put the reset inside renderLogin (and renderName) rather than per call site, so no path can be missed.

2. Leaving during the save. The plan says the save carries on to the send, but the code after the first check has a branch that sets S.trip to the freshly loaded trip and redraws the editor. Today the guard "if the draft is no longer this one, return" sits right before that branch. If the plan removes that guard, a parent who has moved to trip B gets trip A's data written over S.trip and the editor drawn on B's screen. That is problem 1 coming back. The plan must say that branch is skipped when they have left, and that any refusal toast or reload after the send is guarded the same way. Also, the freeze blocks the in-page Back link, so "leaving" is only reachable through browser history; say that. Finally, the server's family-tag check does not cover fencer or fencing-day splits (see 3), so the plan should decide whether a save from a form the parent has left should still go out on those bases.

3. Family tags in the expense write. This closes the took-part gap for new expenses, edits, and the queued auto-send, which has no form check at all. Four things the plan should state:
- Today both the split-tag check and the payer-tag check are separate reads done before the insert, not in the same statement. The plan must put them in the insert and update statements, or the race it is meant to close stays open.
- The check is opt-in: a took-part expense with no split tags is not checked. Old queued bodies do not have them. Decide whether to refuse or accept those.
- Check the tags of the keys actually stored in the split, not every key sent. The server skips zero counts and staff.
- Per-fencer and fencer-day expenses store an empty split. The money is recomputed from the roster on every read, so a replacement family's fencers join those expenses anyway. The write check cannot cover that; only the form's pre-send check does. That is a design limit, so say it, not "every family in the split".

4. Payer tag on edits. The plan says edits send the tag "from the tags kept with the form". Edit drafts are built from the saved expense with no tags at all; tags are only recorded when a family is ticked. So for edits the tag comes from the trip as loaded when the save runs. Edits are safe today for a different reason: deleting a family bumps the expense's revision, and the revision check refuses the save. Better to record the tags when the edit form opens, so the plan's wording is true. Note also that a payer can't be deleted, so this item is low value on its own.

5. Refusal, reload, redraw. The existing reopen check that clears picks (in the editor renderer) only runs for new drafts. For an edit, after the reload the form still shows the replacement family ticked, and every save then fails with "changed after you opened it" until the parent reopens the expense. The plan needs to extend the check to edits, or drop the stale picks on refusal. The reload must also be guarded as in item 2, or it can pull the old trip back into S.trip.

6. Treasurer family. The treasurer save checks that the family is a real family but then writes the bare number with no tag, so the tag check in the write is right. The bigger hole is not in the plan: deleting a family refuses only when it paid for something, not when it is the treasurer's family. The treasurer is stored as a bare number, so if the treasurer's family was the newest and is deleted, the next family added takes the same number and silently becomes the treasurer's family, and the payment plan changes. The fix is one more refusal in the family delete, like the payer's. The plan should add it.

7. Adding a person to a replaced family. The insert already requires the tag in the same statement, so the real change is the null read. Today a deleted family already gets a 404 "No such family" from the earlier lookup; the null read only matters in the gap between the two queries. So "server error" overstates it, though the fix is still right. The same null read sits in the family PATCH and DELETE, which the plan does not mention.

8. The "you" label. whoNow() looks up the family by id only, while myFamily() also checks the tag. Switching whoNow to myFamily() is the smallest change in the plan and is correct.

9. Old drafts with no tags. The current code gives them the "changed since you opened it" message, so the plan's new wording needs its own branch. Cheap and correct.

10. Finalize. Holds. The trip read and its fingerprint come from one batch, so comparing that fingerprint to the snapshot is equivalent to the third read. The final write still guards on the snapshot.

11. Family and fencing saves capture the trip. Holds, though the family screen checks only the family id, not its tag. If the number was reused, the screen quietly switches to the replacement family after the stale-screen toast. Writes are refused, so no money is lost, but say so.

Gaps the plan does not cover
- Item 6's treasurer-family delete (above).
- The family PATCH and DELETE null read (sibling of item 7).
- The login form being inert (sibling of item 1; fix in renderLogin).
- Person PATCH still accepts a whole fencing-day list. The client never sends it today, so it is latent, but it is the same shape as problem 4.
- Trip-details save writes name and location from the form (last writer wins). Dates are guarded; name and location are not. Probably outside the six.

What holds up
- The freeze during the save, and the reset when they navigate.
- loadTrip's stillHere guard and the reload guards in the family and fencing saves (problem 1).
- The trip row in the same batch as the fingerprint (problem 5).
- Person PATCH writing only the fields sent (problem 4).
- The payer-tag check on new expenses, and the revision check that protects edits when a family is deleted.

Nothing was run, so these are read-through findings only.
