# Saving on a bad connection: design v2 (the small version)

v1 (saving-design-v1.md) was broken by two fresh critics (saving-design-v1-critic-*.md): the core held, but it was a general sync engine for a few parents. Frank chose the small direction: **hold new expenses on the phone until there's a signal; everything else needs a signal; no duplicate detection** (duplicates are caught before finalizing, and anyone can delete one).

## 1. New expenses wait on the phone

- Saving a new expense when the app can't get a real answer puts it in **"Waiting to send"** on this phone, instead of an error. The parent never types it again.
- "Waiting to send" sits at the top of the trip's Expenses list, set apart from the real list: "On this phone only, not on the trip yet. Dinner, $45.00". Waiting items don't count in anyone's totals.
- The app tries again by itself, oldest first: when the trip opens, when the app comes back to the screen, when the phone says it's back online, and every 30 seconds while something is waiting. It works only while the app is open; nothing sends with the app closed.
- Each waiting expense keeps the key the phone gave it when the form opened (the existing `client_key`), so sending it twice can't add it twice.
- Tapping a waiting item opens it in the form. Saving puts the changed version back in the queue. It can also be removed, with an "are you sure".
- It's kept in the phone's browser storage (localStorage). It's lost if site data is cleared or the browser is private. Safari and the home-screen app don't share it. The page also can't open at all without a signal (there's no offline copy of the app). So this covers a signal that drops while the app is open, which is the common case at a venue.

## 2. What counts as an answer

- **Saved:** a success reply with the expense's id. It leaves the queue: "Dinner, $45.00 was sent."
- **Refused:** the app's own refusal (a 4xx with the app's error message), except "logged out". The item moves to **"Couldn't send"**, with the reason, and stays until the parent opens it to fix it or removes it. A refused item never blocks the others; each one is sent on its own. Examples: the trip was finalized ("Tell the treasurer about Dinner, $45.00"), the paying family was removed, or the receipt photo expired.
- **Logged out:** the queue pauses until they log in again.
- **Anything else is "don't know yet":** no reply, a timeout, a reply cut off, a page that isn't the app's (a wifi sign-in page, a network error page), a server crash, or "too many requests". It stays waiting and is tried again.

## 3. A late copy can't undo a correction

- The server already accepts a resend with the same key and changed content as a correction, if nobody else has edited that expense since.
- New: each change to a waiting expense gets a number on the phone (1, 2, 3...). The server remembers the highest one it has applied, and ignores a lower one arriving late. So a stalled old copy landing after the fixed one can't put the typo back.

## 4. Receipt photos

- The photo uploads on its own, as now, and AI reading needs signal. If the photo can't upload, the expense can still wait without it: "Add the photo when you have signal."
- Uploads nobody refers to are cleaned up after an hour today. An expense can now wait for days, so that becomes 30 days.

## 5. The treasurer

- Finalize keeps its existing check that nothing changed since the treasurer's screen loaded. Nothing new on the finalize screen: Frank judged a reminder a burden for a case that needs the uploader and everyone else not to notice.
- A waiting expense that arrives after finalizing is refused, and lands loudly in "Couldn't send" on that parent's phone (see 2).

## 6. Everything else needs a signal

Adding a person, family, coach or trip, any edit, deleting, payments, finalizing: these stay online-only, with a plain message when there's no signal, and what they typed is left on the screen.

This also removes last night's known flaw (a lost "Ava" followed by adding "Ben" could rename Ava to Ben):
- Each tap of Add gets a fresh key. No key is reused for the next add.
- The server never changes a person, family or trip because a key was resent. It only answers "already added".
- After a lost reply, the screen reloads. If what they added is there: "Rosa was added after all." If not: "That didn't save. Try again when you have signal," with the name still in the box.
- A duplicate can now happen only if the add landed, the reload also failed, and they tapped again. It's visible, and can be deleted.

## What it doesn't handle, on purpose

- Two parents entering the same bill on two phones.
- Edits and deletes while offline.
- Sending while the app is closed.
- Opening the app with no signal.
- Losing the phone's storage while something waits.
- Duplicate detection.
