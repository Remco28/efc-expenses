# Saving on a bad connection: design v3

v2 went to two fresh critics (saving-design-v2-critic-*.md). The direction held. This version fixes what they broke, and cuts what they showed does nothing. Changes from v2 are marked **(v3)**.

Frank's choices stand: **new expenses wait on the phone until there's a signal; everything else needs a signal; no duplicate detection; no reminder on the finalize screen.**

## 1. New expenses wait on the phone

- Saving a new expense when the app can't get a real answer puts it in **"Waiting to send"** on this phone, and the form closes. The parent never types it again. The next new expense gets a new key.
- **(v3)** That includes the check the app does before saving (reloading the trip to see if anyone joined). If that check gets no answer, the expense goes straight to Waiting, without the check.
- "Waiting to send" sits at the top of the trip's Expenses list, apart from the real list: "On this phone only, not on the trip yet. Dinner, $45.00". Waiting items don't count in anyone's totals.
- The app sends them by itself, **(v3)** one at a time, for every trip, not only the one on screen. It sends when the app opens, when it comes back on screen, when the phone says it's online, and every 30 seconds while something waits. One that hangs holds up the rest for 25 seconds at most. Nothing sends while the app is closed.
- Each waiting expense keeps its key (the existing `client_key`), so sending it twice can't add it twice.
- **(v3)** It's sent under the name of whoever entered it, not whoever is on the phone when it goes.
- Tapping a waiting item opens it in the form, even with no signal, since it lives on the phone. Saving puts the changed version back in the queue. **(v3)** While it's being sent, it can't be edited ("Sending, try again in a moment"). It can also be removed, with an "are you sure".
- It's kept in the phone's browser storage (localStorage), so it's lost if site data is cleared or the browsing is private. Safari and the home-screen app don't share it, and iPhones may clear it after about a week of not opening the site. The page can't open at all without a signal. So this covers a signal that drops while the app is open, the common case at a venue.
- **(v3)** The existing single "pending expense" slot is folded into this list.

## 2. What counts as an answer

- **Saved:** a success reply **(v3)** that is the app's own JSON and carries the expense's id. It leaves the queue: "Dinner, $45.00 was sent." **(v3)** Today the app treats any success page as saved, including a wifi sign-in page. That changes for every save, not only the queue.
- **(v3) Saved, but changed since:** "your first save went through, and someone has changed this expense since". It leaves the queue: "Dinner was saved, but someone edited it before your later change arrived. Have a look."
- **Refused:** any other refusal from the app (a 4xx with its error message), except "logged out". The item moves to **"Couldn't send"** with the reason, and stays until the parent opens it to fix it or removes it. Refused items don't block the others. Examples: the trip was finalized ("Tell the treasurer about Dinner, $45.00"), or the paying family was removed.
- **Logged out:** the queue pauses until they log in again.
- **Anything else is "don't know yet":** no reply, a timeout, a cut-off reply, a page that isn't the app's, a server crash, or "too many requests". It stays waiting and is tried again.
- **(v3)** On opening a trip, a waiting item whose expense is already on the trip, in the same version the phone has, is dropped as sent.

## 3. Corrections and late copies

- **(v3)** Each change to a waiting expense gets a number on the phone (1, 2, 3...). The server stores the number with the expense, from the first save on. A resent copy with a higher number is applied as a correction, as long as nobody else has edited the expense. Today's rule (correct only while the expense is untouched) refuses a second correction, as if the parent's own first one were someone else's edit; this replaces it. A lower or equal number arriving late changes nothing and is answered "saved".

## 4. Shares worked out on an old view of the trip

- **(v3)** Most shares are automatic and worked out when anyone looks, as now. A family that joins later, or a day ticked later, is counted the same as for any expense already on the trip.
- If the parent set shares by hand, and who's on the trip has changed since they made it, the waiting expense isn't sent. It goes to "Couldn't send": "Who's on the trip changed. Check the shares, then save."

## 5. Receipt photos

- The photo uploads on its own, as now, and AI reading needs signal. If it can't upload, the expense can still wait without it. **(v3)** The photo isn't kept: "The photo didn't upload. Add it when you have signal."
- **(v3) Cut:** the change to receipt cleanup. Cleanup runs only when a trip is purged or the practice trip is reset, so it never removes a real waiting expense's photo.

## 6. The treasurer

Finalize keeps its existing check that nothing changed since the treasurer's screen loaded. Nothing new on the finalize screen. Frank judged a reminder a burden for a case that needs the uploader and everyone else not to notice. A waiting expense that arrives after finalizing is refused and lands in "Couldn't send" on that parent's phone.

## 7. Everything else needs a signal

Adding a person, family, coach or trip, editing anything on the server, deleting, payments, finalizing: these stay online-only. When there's no signal, the parent gets a plain message and what they typed stays on screen.

This also removes last night's flaw, where a lost "Ava" followed by adding "Ben" could rename Ava to Ben:
- Each tap of Add gets a fresh key. No key is reused for the next add.
- The server never changes a person, family or trip because a key was resent. It only answers "already added".
- After a lost reply, the screen reloads. If the record with that key is there (by key, not by name): "Rosa was added after all." If not: "That didn't save. Try again when you have signal," with the name still in the box.

## What it doesn't handle, on purpose

- Two parents entering the same bill on two phones.
- Edits and deletes of saved things while offline.
- Sending while the app is closed.
- Opening the app with no signal.
- Losing the phone's storage while something waits.
- Duplicate detection.
- **(v3)** A waiting expense that landed (its reply lost) and was then deleted on another phone before the next resend. The resend brings it back, and it's visible.
