Verdict: the plan is not fine as written. It would catch some real double-entries, but it misses the typo case you gave, prompts on legitimate repeats, and aims at the wrong part of the code. I read the code (read-only) in /home/frank/Dev/efc-expenses: src/index.ts (create handlers around lines 355-380, 527-545, 612-640, 680-715), public/app.js (api wrapper around lines 55-90, saveExpense around 1095-1120, route handling around 220-235, the add-person loop around 800-815), and migrations 0009/0010.

What the code does today, which matters for the plan:
- Adds (trip, family, person) get a key from `addKeys`, an in-memory Map in app.js keyed by path plus the whole JSON body. The body includes the name, so any edit gives a new key, and a page reload empties the map. So the typo case (1) and the reload case (2) both get a new key today.
- Expenses: the key lives on the draft (`client_key: crypto.randomUUID()` when the draft is created). Route handling sets `S.draft = null` and calls `dropDraft()` when you navigate to the trip screen without `/e`. So a parent who taps back after "connection dropped" and re-enters the expense gets a brand new key. Case 1 is therefore not a retry the key can catch.
- Server key-match behaviour differs by type. For expenses, a key match with changed fields applies the correction (UPDATE with rev=0). For people, families and trips, a key match returns the old record with 200 and ignores the new fields. So if the phone ever reused a key for a corrected name, "Av" would be saved and the phone would show "Ava" with no error.

How the plan goes wrong:
1. It misses your own example. "Av" vs "Ava" is not an exact name match, so no prompt, and two people get created. Fuzzy matching would fix that but adds false positives (Ann/Anna, a "Mike" Sr. and "Mike" Jr. in one family).
2. Legitimate repeats get prompted: two identical $10 parking fees or three snacks from the same payer on the same day; two people with the same first name in one family; two unrelated families with the same surname on one trip. Each one costs a tap, and the prompt is another request that can be lost on a bad signal.
3. Corrections are missed: an expense re-entered with a different amount, date or payer, or re-entered after the window (bad-signal retries often come 10+ minutes later). The window is a dial with no good setting: longer means more false prompts, shorter means more misses.
4. Ordering: the near-match check must run after the exact client_key check. If it runs first, a plain retry of an add that already landed gets prompted against its own row.
5. The confirmed resend must carry the same key and skip only the near-match step, or a second lost confirm can add a third row.
6. Wiring: the prompt is a new non-error response. The `api` wrapper throws on any non-OK status, and the add-person path runs through `famSave`'s queue, so a prompt mid-queue needs its own UI. Call sites: expense save, family add (including staff), person add, trip create (your plan doesn't list trip create at all).
7. The check and the insert are not atomic. Two different-key requests from two phones can both pass the check. That's rare and acceptable, but say so.

What it does catch: a same-name, same-amount, same-date double entry from two different phones within the window. That is real value (two parents entering the same receipt), but it is probably the rarest of the cases.

Simpler route, aimed at the cause:
- Key the attempt, not the body. Keep the key in localStorage with what was sent until a reply comes back, and reuse it on any resend, including after a reload. This fixes case 2's reload.
- Make a keyed retry with changed fields apply the change for people, families and trips, as expenses already do. Then "Av" sent with key K, corrected to "Ava" and resent with K becomes "Ava" with no duplicate. This is the only fix for the typo case that doesn't guess.
- For expenses, don't drop the pending save on navigation. If the parent opens Add expense on that trip while an unconfirmed save exists, show "Your last expense may have saved. Check the list" with the pending one, and let them choose "It's saved" or "Send it again" (same key). This uses the phone's exact knowledge of what it sent, so it has no false positives on other people's entries.
- Keep a server near-match only as a non-blocking warning, or drop it. It covers the rare cross-phone case and costs a prompt on every legitimate repeat.

Before building, check how often this really happens: the `activity` table logs each add, so the treasurer's real trips can show identical-looking entries that came close together. I didn't run any queries, since you asked for nothing that writes.
