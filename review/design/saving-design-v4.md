> **Status (2026-10-23): built, with changes.** After the split was rebuilt (billing-model.md), every new expense can wait on the phone, ticked meals included: they name their families by their tags, so the "hand-set shares need a signal" rule below no longer applies. A refused expense can be opened to fix (it comes back in the form as a new one). Round 11 added: a waiting meal shows who's ticked.

# Saving on a bad connection: design v4

v3 went to two fresh critics (saving-design-v3-critic-*.md). Both, independently, proposed making it smaller. Frank agreed to both cuts. This is the third pass; changes from v3 are marked **(v4)**.

Frank's choices: **new expenses wait on the phone until there's a signal; everything else needs a signal; no duplicate detection; no reminder on the finalize screen; (v4) a waiting expense can be removed but not edited; (v4) an expense with hand-set shares needs a signal.**

## The one rule for keys

**(v4)** A key names one thing being added. The server, seeing a key it already has, answers "already added" and changes nothing: not for expenses, people, families or trips. Nothing is ever corrected through a resent key. (This removes today's correction code for expenses and the `client_sig` comparison for the rest.)

## 1. New expenses wait on the phone

- Saving a new expense when the app can't get a real answer (including the check it does first, reloading the trip) puts it in **"Waiting to send"** on this phone, and the form closes. The parent never types it again. The next new expense gets a new key.
- **(v4)** Only if its shares are automatic. If the parent set any family's share by hand (a custom split, or any share changed or excluded), it isn't held: "This one needs a signal, because its shares were set by hand." The form stays open, and what they typed is kept as it is today.
- "Waiting to send" sits at the top of the trip's Expenses list, apart from the real list. **(v4)** It reads: "On this phone, not confirmed yet. It may already be on the trip. Dinner, $45.00". Waiting items don't count in anyone's totals. **(v4)** Items waiting or refused for any trip also show, as a count, on the trip list.
- The app sends them by itself, one at a time, for every trip: when the app opens, when it comes back on screen, and every 30 seconds while something waits. A hang holds up the rest for 25 seconds at most. Nothing sends while the app is closed. Sending the same item twice at once, from two tabs, is harmless (see the rule for keys).
- Each item is sent under the name it was entered under (the full name, with "(Coach)" if that applies), stored with it.
- **(v4)** A waiting item can't be edited. It can be removed, with "This may already be on the trip. Check the list first." To fix a typo, remove it and enter it again, or edit it once it has sent.
- **(v4)** The waiting expense also carries the paying family's tag (the existing family `uid`). Family numbers can be reused after a delete, so the server checks that the tag matches, and refuses if it doesn't: "The family that paid was removed."
- Storage is the phone's browser storage (localStorage). It's lost if site data is cleared or the browsing is private. Safari and the home-screen app each keep their own, and iPhones may clear it after about a week of not opening the site. The page can't open without a signal. So this covers a signal that drops while the app is open, the common case at a venue.
- The existing single "pending expense" slot, and its "put it back in the form" step, are replaced by this list.

## 2. What counts as an answer

- **Saved:** a success reply that is the app's own JSON and carries an id. **(v4)** This applies to every save in the app, not only the queue: payments, finalize, edits, deletes. A success reply that isn't the app's own JSON (a wifi sign-in page, for example) means "don't know", never "saved". The reload after a lost add follows the same rule: if it can't get the app's own answer, the app says "still not sure" rather than "didn't save".
- **(v4) Already saved:** the server checks the key **before** anything else, including whether the trip is finalized. So an expense that landed before finalizing, whose reply was lost, is answered "already added", not "finalized".
- **Refused:** the app's own refusal (a 4xx with its JSON error), except logged out and **(v4)** "no such page" (a 404 for a route the server doesn't have, as an old phone could hit after a release). The item moves to **"Couldn't send"** with the reason, and stays until the parent removes it. It can be opened, to copy what it said into a new expense. Refused items don't block the others.
- **Logged out:** the queue pauses until they log in again.
- **Anything else is "don't know yet",** and the item is tried again.
- On opening a trip, a waiting item whose key is already on the trip is dropped as sent.

## 3. Receipt photos

The photo uploads on its own, as now, and AI reading needs signal. If it can't upload, the expense can still wait without it, and the photo isn't kept: "The photo didn't upload. Add it when you have signal." **(v4)** Correction to v3: resetting the practice trip does clear photos that no saved expense uses, so a practice-trip expense waiting for over an hour can lose its photo and be refused. It's the practice trip, so this is accepted. A removed waiting item's uploaded photo stays in storage until its trip is purged.

## 4. The treasurer

Finalize keeps its existing check that nothing changed since the treasurer's screen loaded. A waiting expense that arrives after finalizing, and wasn't already saved, is refused and lands in "Couldn't send" on that parent's phone.

## 5. Everything else needs a signal

Adding a person, family, coach or trip, any edit, deleting, payments, finalizing: online only. When there's no signal, the parent gets a plain message and what they typed stays on screen.

**(v4)** Adds keep their key across retries of the same thing: retrying "Ava" uses Ava's key; typing "Ben" instead makes a new key. The phone keeps that key until the app gets a real answer. The server, per the rule for keys, only ever answers "already added". So a slow first "Ava" can't become a second Ava, and "Ben" can never rename Ava. After a lost reply the screen reloads. If the record with that key is there: "Rosa was added after all".

## What it doesn't handle, on purpose

- Two parents entering the same bill on two phones.
- Edits and deletes of saved things while offline.
- Sending while the app is closed.
- Opening the app with no signal.
- Losing the phone's storage while something waits, including looking in Safari for something entered in the home-screen app.
- Duplicate detection.
- A waiting expense that landed with its reply lost, then was deleted on another phone before the next resend. The resend brings it back, visibly.
- **(v4)** Removing a waiting item whose earlier send had in fact landed. It stays on the trip, visibly, and can be deleted there.
