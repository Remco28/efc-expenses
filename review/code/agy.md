### Unhandled exception and crash in receipt reader if user navigates away
- Severity: high
- Where: public/app.js:945
- What goes wrong: When a receipt photo or PDF is selected, receipt upload and AI reading run asynchronously. If the user navigates away or saves the expense before reading finishes, `S.draft` is cleared to `null`; when `read-receipt` finishes, `fillFromReceipt()` attempts to access properties on `d` (`d.amount`, `d.description`, `d.split`) and DOM elements (`$("cat").value`) that no longer exist, throwing an unhandled `TypeError` and crashing.
- How to trigger it: Open any trip and click "Add expense". Select a receipt file to trigger receipt reading. While "Reading the receipt…" is displayed, click "Back" or the club mark to return to the trip page. When the API call completes, `TypeError: Cannot read properties of null (reading 'amount')` crashes in the console.
- Evidence:
```javascript
function fillFromReceipt(f) {
  const d = S.draft, $ = s => document.getElementById(s);
  const days = tournamentDays(S.trip.tournament.start_date, S.trip.tournament.end_date);
  if (f.total != null && !cents(d.amount)) { d.amount = f.total.toFixed(2); $("amt").value = d.amount; }
```

### AI receipt completion clobbers manual split customizations
- Severity: high
- Where: public/app.js:952
- What goes wrong: While the AI reads a receipt (which takes several seconds), the user can enter details and customize who is sharing the expense (unticking families who did not attend, adjusting headcounts). When `fillFromReceipt()` resolves, it unconditionally executes `defaultSplit(d.basis, S.trip.families)`, overwriting and discarding all manual share customizations and family exclusions the user configured.
- How to trigger it: Click "Add expense" and choose a receipt. While the receipt is reading, untick one or more families who were not at the meal or enter custom units for a family. When receipt reading completes 2–4 seconds later, line 952 executes and resets the split to default, reverting unticked families back to checked.
- Evidence:
```javascript
  d.split = defaultSplit(d.basis, S.trip.families);
  const out = f.date && !days.includes(f.date) ? ` The receipt is dated ${f.date}, which is outside the trip.` : "";
  d.aiNote = `We filled in the form from the receipt. Check the amount and who's included before saving.${out}${f.notes ? " Note: " + f.notes : ""}`;
  drawSplit();
```

### Race condition creates orphaned receipt and saves expense without receipt attached
- Severity: high
- Where: public/app.js:803, public/app.js:933, public/app.js:965-968
- What goes wrong: The "Save expense" button remains enabled while `uploadReceipt()` compresses and uploads the receipt file to `/tournaments/:id/receipts`. If the user submits the form before the upload request finishes, `d.receipt_key` is still `null`, saving the expense to the database without the receipt; when the upload subsequently finishes, the receipt file is left orphaned in R2.
- How to trigger it: Click "Add expense", fill in an amount and description, and pick who paid. Select a receipt image, and immediately click "Save expense" before compression and upload finish. The expense is created with `receipt_key: null`, leaving the uploaded image unlinked in storage.
- Evidence:
```javascript
    const blob = await shrink(file);
    const r = await api(`/tournaments/${tid}/receipts`, { method: "POST", body: blob, headers: { "content-type": blob.type } });
    d.receipt_key = r.key; d.receipt_type = r.type; d.aiNote = "";
```
and in [saveExpense](file:///home/frank/Dev/efc-expenses/public/app.js#L958-L968):
```javascript
  const body = { description: d.description, vendor: d.vendor, date: d.date, category: d.category, basis: d.basis,
    amount_cents, paid_by: Number(d.paid_by), split: d.split, receipt_key: d.receipt_key, receipt_type: d.receipt_type };
  document.getElementById("save").disabled = true;
  try { await act(() => d.id ? api(`/expenses/${d.id}`, { method: "PATCH", body }) : api(`/tournaments/${t.id}/expenses`, { method: "POST", body }), "Expense saved"); }
```

### Unhandled exception during PDF export when receipts are WebP or unsupported image formats
- Severity: high
- Where: public/pdf.js:301
- What goes wrong: The server allows receipt uploads with content-type `image/webp` (and some devices generate non-standard JPEG encodings like CMYK). While PDF receipts are loaded inside a `try/catch` block that falls back to a placeholder message, non-PDF receipts on line 301 pass directly to `doc.embedJpg(bytes)` without error handling; encountering a WebP or unparseable image throws an exception that halts the entire PDF generation.
- How to trigger it: Add an expense with a `.webp` receipt image (accepted by the API). Finalize the tournament and click "Download PDF record". `doc.embedJpg()` fails parsing the WebP bytes, throwing an unhandled error and preventing the user from downloading the record.
- Evidence:
```javascript
    } else {
      const img = e.receipt_type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      frame(box => page.drawImage(img, box), img.width, img.height, top - BOTTOM - 8);
    }
```

### Double submission creates duplicate people and corrupts attendance headcounts
- Severity: high
- Where: public/app.js:720-727
- What goes wrong: The `addperson` form does not disable its submit button or inputs while saving, and requests queue through `famQueue`. Rapidly double-clicking "Add" or pressing Enter twice sends two sequential POST requests to `/families/:fid/people`, creating duplicate people under the family that inflate headcounts, fencer counts, and fencer-days, corrupting all split calculations.
- How to trigger it: Open any family in the Families tab. In the "Add a person" input, type a name, check "Fencer", and double-press Enter or rapidly double-tap the "Add" button. Two duplicate person records are created in the database and both count toward travel splits.
- Evidence:
```javascript
  const add = document.getElementById("addperson");
  if (add) add.onsubmit = async ev => {
    ev.preventDefault();
    const n = document.getElementById("newname").value.trim();
    if (!n) { document.getElementById("newname").focus(); return toast("Type a first name"); }
    await famSave(fid, () => api(`/families/${fid}/people`, { method: "POST", body: { name: n, is_fencer: document.getElementById("newfencer").checked } }), `${n} added`);
    document.getElementById("newname")?.focus();
  };
```

### Tab switching wipes uncommitted edits on Family and Trip details screens
- Severity: medium
- Where: public/app.js:168
- What goes wrong: The `visibilitychange` listener invokes `route()` when returning to the tab unless `S.draft` is set or a modal sheet is open. Because `S.draft` is only set when editing expenses, switching away from the browser while editing a family name (`#fam-name`), entering payment notes (`#fam-pay`), typing a new person's name (`#newname`), or changing trip details (`#tripedit`) causes the page to reload from the server on return, discarding all uncommitted input.
- How to trigger it: Navigate to a family page, type an uncommitted note into "How should the treasurer pay them back?" or a name into "Add a person", switch to another application (e.g. to copy a phone number or check message history), and switch back. `visibilitychange` runs `route()`, reloading the trip and wiping the text.
- Evidence:
```javascript
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.draft && !document.querySelector(".sheet-back")) route(); });
```

### Focus stolen to family attendance button when toggling fencer or individual days
- Severity: medium
- Where: public/app.js:401, public/app.js:684-687
- What goes wrong: When a keyboard user toggles a fencer's day (`data-fence`) or a person's own day (`data-own`), `famSave()` uses `focusKey()` to persist focus across the re-render. Because `fence` and `own` are omitted from the attribute whitelist in `focusKey()`, it falls back to matching only `[data-day="YYYY-MM-DD"]`. `document.querySelector()` matches the first element in the DOM with that date—the family-level attendance button at the top—causing focus to jump to the family row and making subsequent keypresses toggle the entire family's days instead.
- How to trigger it: Open a family with a fencer. Using the keyboard (Tab), navigate down to one of the fencer's "Fences on" day buttons and press Space to toggle it. Once the save completes, keyboard focus jumps to the family attendance button for that same date at the top of the card.
- Evidence:
```javascript
function focusKey() {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const sel = ["act", "id", "day", "kind", "basis", "fam", "inc", "units"].filter(k => a.dataset?.[k] != null).map(k => `[data-${k}="${a.dataset[k]}"]`).join("");
  return sel || (a.id ? "#" + a.id : null);
}
```

### Accounting contradiction in Treasurer checklist when treasurer's family owes money
- Severity: medium
- Where: public/app.js:1097-1102
- What goes wrong: When the treasurer's family is on the trip and owes money (`mine < 0`), they settle by adding their balance to the pot rather than generating an incoming payment record in `payments`. Because `tabTreasurer` calculates `sum(ins, true)` strictly from the `payments` table, `sum(ins)` is permanently lower than `sum(outs)`. Even when every payment is completed and all money is accounted for, line 1100 displays "Paid out ahead of collecting" and line 1101 warns that the treasurer is waiting on remaining families to pay.
- How to trigger it: Finalize a trip where the treasurer's family has a negative balance (they owe money) and other families have paid. Tick off all incoming and outgoing payments. The Treasurer checklist continues to display a positive amount for "Paid out ahead of collecting" alongside a warning note stating that remaining families still need to pay.
- Evidence:
```javascript
    ${final() ? `<div class="card ledger"><h2>Progress</h2>
      <table class="t"><tr><td>Collected</td><td class="n"><b>${money(sum(ins, true))}</b> of ${money(sum(ins))}</td></tr>
        <tr><td>Paid out</td><td class="n"><b>${money(sum(outs, true))}</b> of ${money(sum(outs))}</td></tr>
        <tr><td>${sum(ins, true) >= sum(outs, true) ? "In hand right now" : "Paid out ahead of collecting"}</td><td class="n"><b>${money(Math.abs(sum(ins, true) - sum(outs, true)))}</b></td></tr></table>
      ${sum(ins, true) < sum(outs, true) ? `<p class="hint">You've sent out more than you've collected so far. That's fine if you fronted it; it evens out as the remaining families pay.</p>` : ""}
```

### Re-clicking active split basis wipes all customized unit allocations
- Severity: medium
- Where: public/app.js:811, public/app.js:837
- What goes wrong: The click handler for basis choice buttons in `#basis` does not check if the clicked basis matches `d.basis`. If a user has customized attendance shares or unticked specific families and taps or clicks the currently selected basis option again (e.g. while reviewing options), `resetSplit()` runs unconditionally and resets all family allocations back to defaults.
- How to trigger it: In the expense editor, select "Per person" and customize the split by unticking a family or modifying headcounts. Click or tap the "Per person" card again. All custom numbers and unticked states immediately reset to default values.
- Evidence:
```javascript
$("basis").onclick = ev => { const b = ev.target.closest("[data-basis]"); if (!b) return; d.basis = b.dataset.basis; d.basisTouched = true; resetSplit(); };
```
and [resetSplit](file:///home/frank/Dev/efc-expenses/public/app.js#L837):
```javascript
function resetSplit() { S.draft.split = defaultSplit(S.draft.basis, S.trip.families); drawSplit(); }
```

### Unrecognized tab query parameter renders a blank content pane
- Severity: low
- Where: public/app.js:196, public/app.js:427
- What goes wrong: `show()` extracts `q.get("tab") || "expenses"` and forwards it directly to `renderTrip(tab)`. In `renderTrip()`, the sub-renderer is dispatched using `({ expenses: ..., families: ..., settle: ..., treasurer: ... })[tab]?.(...)`. If a user opens a link with a typo or unsupported tab name (e.g. `?tab=expense` or `?tab=family`), the dispatch evaluates to `undefined` and produces no fallback or error, rendering an empty `#tab` container.
- How to trigger it: Navigate to any trip URL with a mistyped query parameter, such as `#/t/1?tab=expense`. The shell renders the tab navigation bar with no active section and a completely empty content area underneath.
- Evidence:
```javascript
      return renderTrip(q.get("tab") || "expenses");
```
and in [renderTrip](file:///home/frank/Dev/efc-expenses/public/app.js#L427):
```javascript
  ({ expenses: tabExpenses, families: tabFamilies, settle: tabSettle, treasurer: tabTreasurer })[tab]?.(document.getElementById("tab"));
```
