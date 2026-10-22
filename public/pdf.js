// Builds the record PDF in the browser (the free Cloudflare plan allows too
// little server CPU for this): a summary page, each family's statement, then
// every receipt on its own page.
import { BASES, CATEGORIES, balances, money } from "./split.js";

async function lib() {
  if (window.PDFLib) return window.PDFLib;
  await new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "/vendor/pdf-lib.min.js"; s.onload = ok; s.onerror = () => fail(new Error("PDF library didn't load"));
    document.head.appendChild(s);
  });
  return window.PDFLib;
}

// The built-in PDF fonts only cover Western European characters.
const clean = s => String(s ?? "").replace(/→/g, "->").replace(/[−–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF‘’“”•…]/g, "?");
const utc = iso => new Date(iso + "T12:00:00Z");
const day = iso => iso ? utc(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "Whole trip";
const fullDate = d => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const range = t => {
  const o = { month: "long", day: "numeric", timeZone: "UTC" };
  return t.start_date === t.end_date ? utc(t.start_date).toLocaleDateString("en-US", { ...o, year: "numeric" })
    : `${utc(t.start_date).toLocaleDateString("en-US", o)} - ${utc(t.end_date).toLocaleDateString("en-US", { ...o, year: "numeric" })}`;
};
const units = (n, basis) => `${n} ${n === 1 ? BASES[basis].unit : BASES[basis].units}`;

export async function exportPdf(trip) {
  const { PDFDocument, StandardFonts, rgb } = await lib();
  const { tournament: t, families, expenses, payments } = trip;
  const { rows, perExpense } = balances(expenses, families);
  const fam = id => families.find(f => f.id === Number(id))?.name || "?";
  const isFinal = t.status === "final";

  const doc = await PDFDocument.create();
  doc.setTitle(clean(`${t.name} - EFC trip expenses`));
  doc.setAuthor("EFC Trip Expenses");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const C = {
    navy: rgb(0.078, 0.165, 0.298), navy2: rgb(0.122, 0.239, 0.42), gold: rgb(0.941, 0.706, 0.161), goldWash: rgb(0.992, 0.957, 0.863),
    ink: rgb(0.086, 0.125, 0.18), ink2: rgb(0.29, 0.34, 0.41), grey: rgb(0.45, 0.49, 0.55), line: rgb(0.86, 0.88, 0.91),
    zebra: rgb(0.965, 0.972, 0.982), white: rgb(1, 1, 1), soft: rgb(0.85, 0.89, 0.95), get: rgb(0.11, 0.48, 0.27), owe: rgb(0.7, 0.21, 0.12),
  };
  const W = 612, H = 792, M = 48, CW = W - 2 * M, BOTTOM = M + 22;
  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const withReceipt = expenses.filter(e => e.receipt_key);
  const rnum = new Map(withReceipt.map((e, i) => [e.id, "R" + (i + 1)]));

  let page, y, runningTitle = "";
  const tw = (s, f, size) => f.widthOfTextAtSize(clean(s), size);
  const fit = (s, f, size, w) => {
    s = clean(s);
    if (f.widthOfTextAtSize(s, size) <= w) return s;
    while (s && f.widthOfTextAtSize(s + "...", size) > w) s = s.slice(0, -1);
    return s.trimEnd() + "...";
  };
  const text = (s, x, yy, { f = font, size = 9.5, color = C.ink, w, align = "left" } = {}) => {
    const str = w ? fit(s, f, size, w) : clean(s);
    const dx = align === "right" ? (w ?? 0) - f.widthOfTextAtSize(str, size) : align === "center" ? ((w ?? 0) - f.widthOfTextAtSize(str, size)) / 2 : 0;
    page.drawText(str, { x: x + dx, y: yy, size, font: f, color });
  };
  const wrap = (s, f, size, w) => {
    const out = []; let line = "";
    for (const word of clean(s).split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (f.widthOfTextAtSize(next, size) > w && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const rect = (x, yy, w, h, color, border) => page.drawRectangle({ x, y: yy, width: w, height: h, color, ...(border ? { borderColor: border, borderWidth: 0.6 } : {}) });
  const hline = (yy, color = C.line, thickness = 0.6) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness, color });

  // Pages after the first get a slim header carrying the trip and section.
  const newPage = title => {
    if (title != null) runningTitle = title;
    page = doc.addPage([W, H]);
    rect(0, H - 34, W, 34, C.navy); rect(0, H - 36, W, 2, C.gold);
    text("ELITE FC TRIP EXPENSES", M, H - 22, { f: bold, size: 7.5, color: C.gold });
    text(`${t.name}${runningTitle ? "   |   " + runningTitle : ""}`, M + 118, H - 22, { size: 8.5, color: C.white, w: CW - 118 });
    y = H - 62;
  };
  const need = h => { if (y - h < BOTTOM) newPage(); };
  const section = (title, note) => {
    need(64);
    text(title, M, y, { f: bold, size: 13, color: C.navy });
    rect(M, y - 7, 24, 2, C.gold);
    y -= 22;
    if (note) { for (const l of wrap(note, font, 8.5, CW)) { text(l, M, y, { size: 8.5, color: C.grey }); y -= 11.5; } y -= 12; }
  };
  // cols: { label, w, align, f(row), sub?(row), color?(row), bold? }
  const table = (cols, data, { totals, rowH = 20 } = {}) => {
    const head = () => {
      rect(M, y - 7, CW, 20, C.navy2);
      let x = M + 7;
      for (const c of cols) { text(c.label.toUpperCase(), x, y, { f: bold, size: 7, color: C.white, w: c.w - 12, align: c.align }); x += c.w; }
      y -= 20;
    };
    need(64); head();
    data.forEach((r, i) => {
      // Keep the last row with the totals line, never a total alone on a page.
      if (y - rowH - (totals && i === data.length - 1 ? 30 : 0) < BOTTOM) { newPage(); head(); }
      if (i % 2) rect(M, y - rowH + 10, CW, rowH, C.zebra);
      let x = M + 7;
      for (const c of cols) {
        text(c.f(r), x, y, { f: c.bold ? bold : font, size: 9, color: c.color ? c.color(r) : C.ink, w: c.w - 12, align: c.align });
        if (c.sub) text(c.sub(r), x, y - 10, { size: 7, color: C.grey, w: c.w - 12, align: c.align });
        x += c.w;
      }
      y -= rowH;
    });
    if (totals) {
      need(28);
      y -= 4;
      page.drawLine({ start: { x: M, y: y + 14 }, end: { x: W - M, y: y + 14 }, thickness: 1, color: C.navy });
      let x = M + 7;
      cols.forEach((c, i) => { if (totals[i]) text(totals[i], x, y, { f: bold, size: 9, w: c.w - 12, align: c.align }); x += c.w; });
      y -= 20;
    }
    y -= 10;
  };

  // ---------- page 1: summary ----------
  page = doc.addPage([W, H]);
  rect(0, H - 104, W, 104, C.navy); rect(0, H - 108, W, 4, C.gold);
  // Club logo on a white badge, since its navy outline would vanish on navy.
  let LX = M;
  try {
    const logo = await doc.embedPng(await fetch("/logo.png").then(r => r.arrayBuffer()));
    page.drawCircle({ x: M + 34, y: H - 54, size: 34, color: C.white, borderColor: C.gold, borderWidth: 2 });
    const lh = 50, lw = logo.width * lh / logo.height;
    page.drawImage(logo, { x: M + 34 - lw / 2, y: H - 54 - lh / 2, width: lw, height: lh });
    LX = M + 84;
  } catch {}
  text("ELITE FC TRIP EXPENSES  |  RECORD OF SHARED COSTS", LX, H - 34, { f: bold, size: 8, color: C.gold });
  text(t.name, LX, H - 64, { f: bold, size: tw(t.name, bold, 24) > CW - 130 - (LX - M) ? 18 : 24, color: C.white, w: CW - 130 - (LX - M) });
  text(`${range(t)}${t.location ? "   |   " + t.location : ""}`, LX, H - 86, { size: 10, color: C.soft, w: CW - 130 - (LX - M) });
  const stamp = isFinal ? "FINAL" : "DRAFT", sw = 78;
  rect(W - M - sw, H - 70, sw, 24, isFinal ? C.gold : C.navy, C.gold);
  text(stamp, W - M - sw, H - 62, { f: bold, size: 11, color: isFinal ? C.navy : C.gold, w: sw, align: "center" });
  text(isFinal ? `Finalized ${fullDate(new Date(t.finalized_at))}` : "Amounts may still change", W - M - 180, H - 86, { size: 8, color: C.soft, w: 180, align: "right" });
  y = H - 132;

  const figs = [
    ["Total shared costs", money(total), 16],
    ["Expenses", `${expenses.length}  (${withReceipt.length} with receipt${withReceipt.length === 1 ? "" : "s"})`, 11],
    ["Treasurer", t.treasurer_name ? `${t.treasurer_name}${t.treasurer_family_id ? ` (${fam(t.treasurer_family_id)})` : ""}` : "Not assigned", 11],
  ];
  const fw = (CW - 16) / 3;
  figs.forEach(([label, value, size], i) => {
    const x = M + i * (fw + 8);
    rect(x, y - 30, fw, 42, C.zebra, C.line); rect(x, y - 30, 3, 42, C.gold);
    text(label.toUpperCase(), x + 12, y, { f: bold, size: 7, color: C.grey, w: fw - 18 });
    text(value, x + 12, y - 19, { f: bold, size, color: C.navy, w: fw - 18 });
  });
  y -= 60;

  const due = new Map((isFinal ? payments : []).map(p => [p.family_id, p]));
  const isT = f => t.treasurer_name && f.id === t.treasurer_family_id;
  const settles = f => {
    const n = rows[f.id].net;
    if (isT(f)) return n > 0 ? `Treasurer's family: keeps ${money(n)}` : n < 0 ? `Treasurer's family: adds ${money(-n)}` : "Treasurer's family: even";
    return !n ? "All square" : n < 0 ? `Pays the treasurer ${money(-n)}` : `Paid ${money(n)} by the treasurer`;
  };
  const status = f => {
    if (!isFinal || isT(f)) return "";
    const p = due.get(f.id);
    if (!p) return "Nothing due";
    return p.paid_at ? `Done ${new Date(p.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Waiting";
  };
  section("Who pays what", `Each cost is split by what it was for, among the people it was for. Balance is what a family paid minus its share. Families that owe pay the treasurer; the treasurer pays families that are owed.${isFinal ? " Payment status is as of the print date below." : ""}`);
  table([
    { label: "Family", w: 88, f: f => f.name, bold: true, sub: f => `${f.people.length} going, ${f.people.filter(p => p.is_fencer).length} fencing` },
    { label: "Share", w: 66, align: "right", f: f => money(rows[f.id].owed) },
    { label: "Paid", w: 66, align: "right", f: f => money(rows[f.id].paid) },
    { label: "Balance", w: 70, align: "right", f: f => (rows[f.id].net > 0 ? "+" : "") + money(rows[f.id].net), color: f => rows[f.id].net > 0 ? C.get : rows[f.id].net < 0 ? C.owe : C.ink },
    { label: "Settles by", w: 150, f: settles },
    { label: "Status", w: CW - 440, f: status, color: f => due.get(f.id)?.paid_at ? C.get : C.ink2 },
  ], families, { totals: ["Total", money(total), money(total), money(0), "", ""], rowH: 22 });
  if (t.treasurer_name) {
    need(30);
    rect(M, y - 9, CW, 24, C.goldWash);
    const lbl = `Send money to ${t.treasurer_name}:`;
    text(lbl, M + 10, y - 1, { f: bold, size: 9 });
    text(t.treasurer_notes || "ask the treasurer", M + 16 + tw(lbl, bold, 9), y - 1, { size: 9, w: CW - 30 - tw(lbl, bold, 9) });
    y -= 34;
  }

  section("Shared expenses", "R1, R2 and so on are the receipt pages at the end. The family statements show each family's part of every expense.");
  table([
    { label: "Day", w: 66, f: e => day(e.date) },
    { label: "Expense", w: 156, f: e => e.description, sub: e => e.vendor || CATEGORIES[e.category]?.label || "" },
    { label: "Paid by", w: 66, f: e => fam(e.paid_by) },
    { label: "Split", w: 104, f: e => BASES[e.basis].label, sub: e => units(perExpense[e.id].total, e.basis) },
    { label: "Receipt", w: 50, f: e => rnum.get(e.id) || "none", color: e => rnum.has(e.id) ? C.ink : C.grey },
    { label: "Amount", w: CW - 442, align: "right", f: e => money(e.amount_cents), bold: true },
  ], expenses, { totals: ["", `${expenses.length} expenses`, "", "", "", money(total)], rowH: 22 });

  // ---------- family statements ----------
  runningTitle = "Family statements";
  if (y < 300) newPage(); else y -= 10;
  section("Family statements", "Every expense each family shares, how it was divided, and that family's part of it. An asterisk marks someone who fenced.");
  for (const f of families) {
    const lines = expenses.filter(e => perExpense[e.id].shares[f.id]);
    const r = rows[f.id];
    need(70);
    rect(M, y - 8, CW, 24, C.goldWash); rect(M, y - 8, 3, 24, C.gold);
    text(`${f.name} family`, M + 12, y, { f: bold, size: 11, color: C.navy, w: 140 });
    text(f.people.map(p => p.name + (p.is_fencer ? "*" : "")).join(", "), M + 160, y, { size: 8, color: C.ink2, w: CW - 170 });
    y -= 26;
    for (const e of lines) {
      need(16);
      const s = perExpense[e.id];
      text(e.description, M + 12, y, { size: 9, w: 210 });
      text(`${s.units[f.id]} of ${units(s.total, e.basis)}`, M + 230, y, { size: 8.5, color: C.grey, w: 140 });
      text(`of ${money(e.amount_cents)}`, M + 370, y, { size: 8.5, color: C.grey, w: 70, align: "right" });
      text(money(s.shares[f.id]), M + 440, y, { size: 9, w: CW - 446, align: "right" });
      y -= 14;
    }
    if (!lines.length) { text("Not included in any expense.", M + 12, y, { size: 9, color: C.grey }); y -= 14; }
    need(42);
    hline(y + 8);
    const word = r.net === 0 ? "Balance" : isT(f) ? (r.net > 0 ? "Keeps" : "Adds") : r.net < 0 ? "Owes" : "Is owed";
    const pairs = [["Share", money(r.owed), C.ink], ["Paid", money(r.paid), C.ink], [word, money(Math.abs(r.net)), r.net < 0 ? C.owe : r.net > 0 ? C.get : C.ink]];
    pairs.forEach(([l, v, col], i) => {
      const x = M + 230 + i * 100;
      text(l.toUpperCase(), x, y - 4, { f: bold, size: 7, color: C.grey, w: 94, align: i === 2 ? "right" : "left" });
      text(v, x, y - 17, { f: bold, size: 10.5, color: col, w: 94, align: i === 2 ? "right" : "left" });
    });
    y -= 44;
  }

  // Who was there and who fenced, by day: the basis for every count above.
  {
    const days = []; for (let d = utc(t.start_date); d <= utc(t.end_date); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
    const people = families.flatMap(f => f.people.map(p => ({ ...p, fam: f.name })));
    const dayW = Math.min(46, (CW - 170) / days.length);
    need(64 + 30 + 20 + 16 * Math.min(people.length, 4)); // title, note, header and a few rows stay together
    section("Who was there, by day", "The basis for every count in this record. x = there that day; F = there and fenced that day (one fencer-day). Per-person costs count the people there on the cost's day; per-fencer-day costs count the F marks.");
    const head = () => {
      rect(M, y - 7, CW, 20, C.navy2);
      text("FAMILY / PERSON", M + 7, y, { f: bold, size: 7, color: C.white });
      days.forEach((d, i) => text(`${utc(d).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${utc(d).getUTCDate()}`.toUpperCase(), M + 170 + i * dayW, y, { f: bold, size: 7, color: C.white, w: dayW, align: "center" }));
      y -= 20;
    };
    // Keep the header with at least a few rows, and repeat it after a page break.
    need(20 + 16 * Math.min(people.length, 4));
    head();
    people.forEach((p, i) => {
      if (y - 16 < BOTTOM) { newPage(); head(); }
      if (i % 2) rect(M, y - 5, CW, 16, C.zebra);
      text(`${p.fam}: ${p.name}${p.is_fencer ? " (fencer)" : ""}`, M + 7, y, { size: 8.5, w: 160 });
      days.forEach((d, j) => {
        const mark = p.fencing_days.includes(d) ? "F" : p.days.includes(d) ? "x" : "-";
        text(mark, M + 170 + j * dayW, y, { f: mark === "F" ? bold : font, size: 8.5, color: mark === "-" ? C.line : mark === "F" ? C.navy : C.ink2, w: dayW, align: "center" });
      });
      y -= 16;
    });
    y -= 8;
    need(30);
    for (const l of wrap("Rounding: each share is rounded to the cent, and any leftover cents go to the families with the largest fractions, so every expense adds up exactly. That's why two equal shares can differ by one cent.", font, 8, CW)) { text(l, M, y, { size: 8, color: C.grey }); y -= 10.5; }
  }

  // ---------- receipts: one per page, in the same frame ----------
  for (const e of withReceipt) {
    newPage(`Receipt ${rnum.get(e.id)}`);
    rect(M, y - 34, CW, 46, C.zebra, C.line); rect(M, y - 34, 46, 46, C.navy);
    text(rnum.get(e.id), M, y - 15, { f: bold, size: 13, color: C.gold, w: 46, align: "center" });
    text(e.description, M + 58, y - 4, { f: bold, size: 12, color: C.navy, w: CW - 190 });
    text(`${day(e.date)}   |   paid by ${fam(e.paid_by)}   |   ${BASES[e.basis].label.toLowerCase()}${e.vendor ? "   |   " + e.vendor : ""}`, M + 58, y - 22, { size: 8, color: C.grey, w: CW - 190 });
    text(money(e.amount_cents), W - M - 124, y - 13, { f: bold, size: 15, w: 114, align: "right" });
    const top = y - 52;
    const frame = (draw, w0, h0, avail) => {
      const s = Math.min(CW / w0, avail / h0, 1.5);
      const w = w0 * s, h = h0 * s, x = M + (CW - w) / 2, yy = top - h;
      rect(x - 1, yy - 1, w + 2, h + 2, undefined, C.line);
      draw({ x, y: yy, width: w, height: h });
    };
    let bytes;
    try { bytes = await fetch(`/api/receipts/${e.receipt_key}`, { credentials: "same-origin" }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); }); }
    catch { text("This receipt couldn't be loaded.", M, top - 16, { color: C.grey }); continue; }
    if (e.receipt_type === "application/pdf") {
      let src;
      try { src = await PDFDocument.load(bytes, { ignoreEncryption: true }); }
      catch { text("This PDF receipt couldn't be included. It's still stored in the app.", M, top - 16, { color: C.grey }); continue; }
      const pages = src.getPages();
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) newPage(`Receipt ${rnum.get(e.id)}, page ${i + 1} of ${pages.length}`);
        const emb = await doc.embedPage(pages[i]);
        const t0 = i > 0 ? y : top;
        const s = Math.min(CW / emb.width, (t0 - BOTTOM - 8) / emb.height, 1);
        const w = emb.width * s, h = emb.height * s, x = M + (CW - w) / 2;
        rect(x - 1, t0 - h - 1, w + 2, h + 2, undefined, C.line);
        page.drawPage(emb, { x, y: t0 - h, width: w, height: h });
      }
      if (pages.length > 1) runningTitle = "";
    } else {
      const img = e.receipt_type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      frame(box => page.drawImage(img, box), img.width, img.height, top - BOTTOM - 8);
    }
  }

  // ---------- footer on every page ----------
  const all = doc.getPages(), printed = fullDate(new Date());
  all.forEach((p, i) => {
    page = p;
    hline(M + 6, C.line, 0.5);
    text(`Elite FC Trip Expenses   |   ${t.name}   |   printed ${printed}`, M, M - 8, { size: 7.5, color: C.grey, w: CW - 90 });
    text(`Page ${i + 1} of ${all.length}`, W - M - 90, M - 8, { size: 7.5, color: C.grey, w: 90, align: "right" });
  });

  const out = await doc.save();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "application/pdf" }));
  a.download = `efc-expenses-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${t.start_date}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
