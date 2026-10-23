Review of commit ddd5fc4. All four fixes landed and the common paths work. I found two small gaps, both in the expense revision fix. Nothing is HIGH. I ran the app (port 8832, now stopped) and a pdf-lib script in my copy only.

**Did each fix land?**

1. **Expense revisions (EFC-01): landed.**
   - `rev` is checked in both the PATCH and DELETE statements. The new UPDATE still checks `created_at` and `rev` in the write, and `rev` replaces the old `receipt_key IS ?` check.
   - Receipts are only ever changed through that one PATCH, so dropping the `receipt_key` check loses nothing.
   - Ran it: an older editor is refused with 409 after a newer correction, and a delete from the older editor is refused too.
   - The editor takes `rev` from the draft it opened with. The delete button reads `rev` from `S.trip`, but `S.trip` does not change while the editor is open.
2. **Family and person tags (EFC-03): landed.**
   - The browser's `api()` helper attaches the tag on every PATCH or DELETE of `/families/:id`, `/people/:id` and `/families/:id/people`. I found no other caller of those paths.
   - The server checks the tag on all five handlers.
   - Ran it: a reused person id is refused. A new person or family has a tag at once because of the insert triggers.
3. **Back to the family's days (EFC-02): landed.** The write now also requires that the family's days are unchanged.
4. **PDF receipts (EFC-04): landed.**
   - Ran the new filter and test-embed logic in pdf-lib. A page with no content is skipped, a blank page next to a real one works, and empty content streams and empty content arrays embed fine.
   - A PDF with only blank pages shows the "couldn't be included" note, which is reasonable.

**Findings**

1. **MEDIUM (ran it). The fix is missed in one place: removing a family changes expenses without bumping `rev`.**
   - Removing a family rewrites every expense's split (`json_remove`, src/index.ts ~line 571), but `rev` stays the same.
   - Family ids are reused after a delete (no AUTOINCREMENT).
   - Steps:
     1. Parent X opens an expense whose split includes family B (id 2).
     2. Parent Y removes family B. The expense's `rev` stays 1.
     3. Someone adds family C, which gets id 2.
     4. X saves the old editor with `rev` 1. It succeeds, and the new family C now carries the share B had.
   - The result is a wrong split that nobody chose, though it is visible on the expense. Fix: the family-delete statement should also do `rev = rev + 1`.
2. **LOW to MEDIUM (ran it). A save whose reply was lost cannot be retried.**
   - On a flaky phone connection, the server may apply an expense edit while the reply never arrives. The user taps Save again with the old `rev`, and gets 409 "Someone changed this expense after you opened it", although the only change was their own.
   - Before this commit, that retry would have worked, because it was the same edit again.
   - The expense is correct and the message is visible, but the user is told to reopen, which discards their draft, and the message wrongly suggests someone else made the change. Tournament venues are where this happens.
   - Possible fix: have the client reload on a lost reply, or let the server accept a retry whose content matches what is stored.
3. **LOW (reasoned from the code). The tag check and the write are separate statements.** For families (PATCH, DELETE) and for person DELETE (`DELETE FROM people WHERE id = ?`), the tag is read in one statement and the write by id comes in another. An id reused inside one request's window would slip through. The window is a few milliseconds, so I would not act on it.
4. **LOW (reasoned from the code). The PDF trial embed roughly doubles the serializing work for large scanned PDF receipts on a phone** (one extra `save()` of the receipt). I did not measure it.

Nothing else turned up.
