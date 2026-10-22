// Builds the record PDF in the browser (the free Cloudflare plan allows too
// little server CPU for this): summary page(s) first, then every receipt.
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
const day = iso => iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "Whole trip";

export async function exportPdf(trip) {
  const { PDFDocument, StandardFonts, rgb } = await lib();
  const { tournament: t, families, expenses, payments } = trip;
  const { rows } = balances(expenses, families);
  const fam = id => families.find(f => f.id === Number(id))?.name || "?";
  const doc = await PDFDocument.create();
  doc.setTitle(`EFC trip expenses - ${t.name}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.14), grey = rgb(0.42, 0.46, 0.5), line = rgb(0.85, 0.87, 0.9);
  const W = 612, H = 792, M = 40;

  // Receipts are numbered R1, R2… in expense order; the summary points at them.
  const withReceipt = expenses.filter(e => e.receipt_key);
  const rnum = new Map(withReceipt.map((e, i) => [e.id, "R" + (i + 1)]));

  let page, y;
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };
  const fit = (s, f, size, w) => {
    s = clean(s);
    if (f.widthOfTextAtSize(s, size) <= w) return s;
    while (s && f.widthOfTextAtSize(s + "…", size) > w) s = s.slice(0, -1);
    return s + "…";
  };
  const text = (s, x, yy, { f = font, size = 9.5, color = ink, w, align = "left" } = {}) => {
    const str = w ? fit(s, f, size, w) : clean(s);
    const dx = align === "right" ? (w ?? 0) - f.widthOfTextAtSize(str, size) : 0;
    page.drawText(str, { x: x + dx, y: yy, size, font: f, color });
  };
  const need = h => { if (y - h < M) newPage(); };
  const heading = s => { need(48); y -= 26; text(s, M, y, { f: bold, size: 12 }); y -= 4; };
  // cols: [label, width, align]
  const table = (cols, data, totals) => {
    const draw = (cells, f, color) => {
      let x = M;
      cells.forEach((c, i) => { text(c, x, y, { f, color, w: cols[i][1] - 6, align: cols[i][2] || "left", size: f === bold && color === grey ? 7.5 : 9.5 }); x += cols[i][1]; });
    };
    const header = () => { y -= 14; draw(cols.map(c => c[0].toUpperCase()), bold, grey); y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: line }); };
    need(40); header();
    for (const r of data) {
      if (y - 16 < M) { newPage(); header(); }
      y -= 13; draw(r, font, ink);
      y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: line });
    }
    if (totals) { need(16); y -= 13; draw(totals, bold, ink); y -= 4; }
  };

  newPage();
  const navy = rgb(0.078, 0.165, 0.298), gold = rgb(0.941, 0.706, 0.161);
  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: navy });
  page.drawRectangle({ x: 0, y: H - 67, width: W, height: 3, color: gold });
  page.drawText("EFC TRIP EXPENSES", { x: M, y: H - 30, size: 9, font: bold, color: gold });
  page.drawText(clean(t.name), { x: M, y: H - 52, size: 18, font: bold, color: rgb(1, 1, 1) });
  y = H - 90;
  text(`${t.location ? t.location + " · " : ""}${day(t.start_date)} - ${day(t.end_date)}, ${t.end_date.slice(0, 4)}`, M, y, { color: grey, size: 10 }); y -= 13;
  text(t.status === "final" ? `Finalized ${new Date(t.finalized_at).toLocaleDateString()} by ${t.finalized_by}` : `DRAFT - not finalized (printed ${new Date().toLocaleDateString()})`, M, y, { color: grey, size: 10 });
  y -= 6;

  const total = expenses.reduce((s, e) => s + e.amount_cents, 0);
  heading("Shared expenses");
  table([["Day", 70], ["What", 168], ["Paid by", 82], ["Split", 90], ["Receipt", 52], ["Amount", 70, "right"]],
    expenses.map(e => [day(e.date), e.description, fam(e.paid_by), BASES[e.basis].label, rnum.get(e.id) || "none", money(e.amount_cents)]),
    ["", `${expenses.length} expenses`, "", "", "", money(total)]);

  heading("Who pays what");
  table([["Family", 150], ["Going", 50, "right"], ["Fencers", 56, "right"], ["Share", 88, "right"], ["Paid", 88, "right"], ["Balance", 100, "right"]],
    families.map(f => {
      const r = rows[f.id];
      return [f.name, String(f.people.length), String(f.people.filter(p => p.is_fencer).length), money(r.owed), money(r.paid), (r.net > 0 ? "+" : "") + money(r.net)];
    }));
  y -= 4; need(12); y -= 10;
  text("Balance: + is owed money, - owes. Shares follow the club's rule: each cost is split by what it was for, among those it was for.", M, y, { size: 8, color: grey });

  heading("Settling up");
  need(14); y -= 13;
  text(t.treasurer_name ? `Treasurer: ${t.treasurer_name}${t.treasurer_family_id ? ` (${fam(t.treasurer_family_id)} family)` : ""}${t.treasurer_notes ? ` · send to: ${t.treasurer_notes}` : ""}` : "No treasurer assigned.",
    M, y, { w: W - 2 * M });
  const pay = t.status === "final" ? payments : [];
  if (pay.length) {
    table([["Family", 150], ["", 140], ["Amount", 80, "right"], ["", 12], ["Status", 150]],
      pay.map(x => [fam(x.family_id), x.direction === "in" ? "pays the treasurer" : "is paid by the treasurer", money(x.amount_cents), "",
        x.paid_at ? `Done ${new Date(x.paid_at).toLocaleDateString()} · ${x.paid_marked_by}` : "Waiting"]));
  } else { need(14); y -= 13; text(t.status === "final" ? "Nobody owes anybody." : "Payments are fixed when the trip is finalized.", M, y, { color: grey }); }

  heading("How costs were split");
  for (const [k, b] of Object.entries(BASES)) {
    const cats = Object.values(CATEGORIES).filter(c => c.basis === k).map(c => c.label);
    const rule = { person: "everyone who was there counts as one", fencer: "one share per fencer at the tournament", fencer_day: "one share per day each fencer competed",
      family: "one equal share per family that used it", custom: "shares set by hand" }[k];
    need(13); y -= 12;
    text(`${b.label}: ${rule}${cats.length ? ` (default for ${cats.join("; ")})` : ""}`, M, y, { size: 8.5, color: grey, w: W - 2 * M });
  }

  // Receipts
  for (const e of withReceipt) {
    const label = `${rnum.get(e.id)} · ${e.description} · ${money(e.amount_cents)} · paid by ${fam(e.paid_by)} · ${day(e.date)}`;
    const bytes = await fetch(`/api/receipts/${e.receipt_key}`, { credentials: "same-origin" }).then(r => { if (!r.ok) throw new Error(`receipt ${rnum.get(e.id)} is missing`); return r.arrayBuffer(); });
    if (e.receipt_type === "application/pdf") {
      let src;
      try { src = await PDFDocument.load(bytes, { ignoreEncryption: true }); }
      catch { newPage(); text(label, M, y, { f: bold, size: 10 }); y -= 16; text("This PDF receipt couldn't be copied in. It's still stored in the app.", M, y, { color: grey }); continue; }
      const pages = await doc.copyPages(src, src.getPageIndices());
      for (const p of pages) {
        doc.addPage(p);
        const { width, height } = p.getSize();
        p.drawRectangle({ x: 0, y: height - 20, width, height: 20, color: rgb(1, 1, 1), opacity: 0.9 });
        page = p; text(label, 12, height - 14, { f: bold, size: 8.5, w: width - 24 });
      }
    } else {
      newPage();
      text(label, M, y, { f: bold, size: 10, w: W - 2 * M });
      const img = e.receipt_type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const maxW = W - 2 * M, maxH = H - 2 * M - 24;
      const s = Math.min(maxW / img.width, maxH / img.height, 1.5);
      page.drawImage(img, { x: M + (maxW - img.width * s) / 2, y: H - M - 24 - img.height * s, width: img.width * s, height: img.height * s });
    }
  }

  const out = await doc.save();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "application/pdf" }));
  a.download = `efc-expenses-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${t.start_date}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
