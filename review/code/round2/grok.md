I'll review the browser app in `public/app.js` for injection, stale state, routing, and money that can disagree with the server. First I'll read the latest fixes and the client code so I don't re-report issues already closed.The client fix commit is in. Next I’ll check the routes and save paths it depends on, and look for places where the screen can disagree with what the server stored.The receipt-fill and share-count paths can still save different money than the screen shows. HTML escaping in `public/app.js` holds: user text that reaches `innerHTML` or attributes goes through `esc`.

### Custom share counts don't update the dollars on screen
- Severity: high
- Where: public/app.js:899
- What goes wrong: The count field is `type="number"`. In Chrome and Safari, reading `selectionStart` on a number input throws `InvalidStateError`, so `drawSplit()` never runs. The typed count is stored anyway. The dollars beside each family, the include checkbox, and the save-bar total stay on the previous split. Saving then uses the typed count, including `0`, which drops that family even though the checkbox still looks on.
- How to trigger it: Edit an expense, change a family's count from 2 to 4 (or to 0), and save without using the checkbox. The row still shows the old dollar amount. After save, Settle up uses the new count.
- Evidence:
```javascript
el.oninput = ev => {
  const u = ev.target.closest("[data-units]"); if (!u) return;
  d.splitTouched = true;
  d.split[u.dataset.units] = u.value === "" ? null : Math.max(0, Number(u.value));
  const pos = u.selectionStart; drawSplit();
  const again = el.querySelector(`[data-units="${u.dataset.units}"]`); again.focus(); try { again.setSelectionRange(pos, pos); } catch {}
};
```

### A receipt read still wipes a saved split, day, and category
- Severity: high
- Where: public/app.js:968
- What goes wrong: `splitTouched` only records edits made during this visit. An expense that already has unticks or hand-set counts loads with that flag clear, and a day or category change does not set it either. When the receipt read finishes, it always replaces the day and category, and if the flag is clear it replaces the split with all-automatic. Saved exclusions are gone, and who shares follows the receipt date.
- How to trigger it: Save a Friday meal with one family unticked and another hand-set to 3. Edit it, add a receipt, and don't touch "Who's sharing". When "Reading the receipt…" finishes, every family is included again and the day is the receipt's date. Save.
- Evidence:
```javascript
if (f.category && CATEGORIES[f.category]) { d.category = f.category; $("cat").value = f.category; if (!d.basisTouched) d.basis = CATEGORIES[f.category].basis; }
if (f.date && days.includes(f.date)) { d.date = f.date; $("day").value = f.date; }
// Keep any sharing changes they made while the receipt was being read.
if (!d.splitTouched) d.split = defaultSplit(d.basis, S.trip.families);
```

### Saving during "Reading the receipt…" keeps the pre-fill split
- Severity: medium
- Where: public/app.js:949
- What goes wrong: Save is blocked only while `uploading` is true. That flag is cleared before the receipt is read. The save body is copied before the request, so a read that finishes while the save is in flight updates the form and then the page leaves. The stored expense keeps the basis, day, and shares from before that fill.
- How to trigger it: Add an expense, choose a receipt, enter an amount, pick who paid, and tap Save while it still says "Reading the receipt…". If the read returns before the save does, the form fills in (for example coach travel, per fencer) and then navigates away. The saved expense is still the default team meal, per person.
- Evidence:
```javascript
d.receipt_key = r.key; d.receipt_type = r.type; d.aiNote = "";
d.uploading = false;
if (!stillHere()) return;
drawReceipt("reading");
```
```javascript
if (d.uploading) return toast("The receipt is still uploading. Save again in a moment.");
const amount_cents = cents(d.amount);
// ...
const body = { description: d.description, vendor: d.vendor, date: d.date, category: d.category, basis: d.basis,
  amount_cents, paid_by: Number(d.paid_by), split: d.split, receipt_key: d.receipt_key, receipt_type: d.receipt_type };
```

### A stale family screen overwrites newer attendance
- Severity: medium
- Where: public/app.js:171
- What goes wrong: Coming back to a family or staff screen never reloads, and a day tap sends the whole day list from the page, not a single toggle. That list replaces the family's days on the server, including days another parent set after this page was opened, and people who follow the family get that same list.
- How to trigger it: Open a family on phone A. On phone B, turn Saturday off. On phone A, switch apps and come back (the page stays as it was), then tap Friday. Saturday is turned back on for the whole family.
- Evidence:
```javascript
if (/^#\/t\/\d+\/f\//.test(location.hash) || document.activeElement?.matches?.("input, textarea, select")) return;
```
```javascript
root.querySelectorAll("[data-famday]").forEach(b => b.onclick = () => {
  const days = tap(b, "[data-famday]");
  famSave(fid, () => api(`/families/${fid}`, { method: "PATCH", body: { days } }));
});
```

### A finished family save wipes text still being typed
- Severity: medium
- Where: public/app.js:692
- What goes wrong: When the last queued save finishes, the family screen is redrawn from the server. Name and payment fields commit on blur, so text that has not blurred yet is thrown away. The same redraw clears a new person's name that has not been submitted.
- How to trigger it: Open a family, tap a day, and while "Saving…" type a Venmo handle into "how should the treasurer send it?" without leaving the field. When the save completes, the handle is gone and the field shows the old value.
- Evidence:
```javascript
const f = focusAfter || focusKey();
await loadTrip(S.trip.tournament.id);
if (!here()) return;
renderFamily(fid, f);
```

### A slow response can paint a different trip than the URL
- Severity: medium
- Where: public/app.js:194
- What goes wrong: `show()` and `refresh()` apply whatever response returns, with no check that the hash is still the one they started with. If an earlier load finishes last, the screen shows that trip's balances and actions while the address bar shows the later trip. Links and Finalize then act on the trip that is on screen.
- How to trigger it: On a slow connection, tap trip A, then trip B before A appears. If A's response arrives last, the header and balances are A's and the URL is `#/t/` plus B's id.
- Evidence:
```javascript
if (parts[0] === "t" && parts[1]) {
  await famQueue;
  await loadTrip(Number(parts[1]));
  if (parts[2] === "e") return renderEditor(parts[3] === "new" ? null : Number(parts[3]));
  if (parts[2] === "f") { S.draft = null; return renderFamily(Number(parts[3])); }
  if (parts[2] === "day") { S.draft = null; return renderDay(parts[3]); }
  S.draft = null;
  const tab = q.get("tab");
  return renderTrip(["expenses", "families", "settle", "treasurer"].includes(tab) ? tab : "expenses");
}
```

### Balances total still counts an expense nobody shares
- Severity: medium
- Where: public/app.js:1038
- What goes wrong: Family rows use `balances()`, which now skips an expense with nobody included, so those dollars are not in anyone's Share or Paid. The Total row adds every expense's full amount. The two columns no longer add up to the footer, and the payer's "You've paid" figure leaves that expense out while the Expenses list still shows they paid it.
- How to trigger it: Add a $40 Sunday lunch paid by family A, then clear Sunday for every family so the expense says "nobody included". On Settle up, the family rows sum to less than the Total by $40 in both Share and Paid. A's "If the trip ended now" card does not include the $40.
- Evidence:
```javascript
const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
```
```javascript
<tr><td><b>Total</b></td><td class="n"><b>${money(total)}</b></td><td class="n"><b>${money(total)}</b></td><td></td></tr>
```

### "Out of your own pocket" ignores the treasurer's own family
- Severity: medium
- Where: public/app.js:1232
- What goes wrong: The progress panel treats the treasurer's own negative balance as already collected. The confirm dialog before marking a payout does not. It can say nothing has been collected, and that the payout comes out of pocket, when the treasurer's own share already covers it.
- How to trigger it: Finalize a trip where the treasurer's family owes $100 and another family is owed $60. Tick that $60 payout. The dialog says you've collected $0.00. The progress panel shows "Your own family's part" $100.00 and would show $40.00 still in hand.
- Evidence:
```javascript
const held = S.trip.payments.reduce((s, p) => s + (p.paid_at ? (p.direction === "in" ? p.amount_cents : -p.amount_cents) : 0), 0);
if (x.amount_cents > held && !(await confirmSheet(`Record paying ${esc(famName(x.family_id))} ${money(x.amount_cents)}?`,
  `So far you've collected ${money(Math.max(held, 0))}, so this would come partly out of your own pocket until the others pay. That's fine if it's what you did.`, "Yes, I sent it"))) return;
```

### Whole-trip expenses say only that day's families share
- Severity: low
- Where: public/app.js:877
- What goes wrong: With no day chosen, per-person and per-family shares include everyone who has any day on the trip. The note under Day still says only families there on this day share, and tells you to pick Whole trip, which is already selected. The family rows show the real shares.
- How to trigger it: Add a team meal and leave Day on "Whole trip, or more than one day". A family that attended one day is checked and given a share, while the note says only families there that day share.
- Evidence:
```javascript
return (away.length ? `Not there that day, so not sharing: ${away.join(", ")}. ` : "")
  + "Only families there on this day share the cost. Pick \"Whole trip\" if it covered more than one day.";
```
