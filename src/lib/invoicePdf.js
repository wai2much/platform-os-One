import { jsPDF } from 'jspdf';
import { FigtreeRegular, FigtreeBold } from './fonts/invoiceFonts';
import { ShipporiMinchoRegular, ShipporiMinchoBold } from './fonts/shipporiFonts';
import { POS_ONE_MARK_PNG } from './assets/posOneMark';
import { balanceDue, paidTotal, displayStatus, paymentsOf, fmtDate, invoiceTotals } from './invoiceMoney';

/**
 * Invoice PDF generation — client-side, no backend call.
 *
 * Look ported 2026-08-29 from the "Origami paper Japanese style" design:
 * washi-paper ground, sumi ink, a single vermillion accent, and Shippori
 * Mincho (a Japanese serif) for display type against Figtree for body.
 * Restrained, lots of air, hairline rules instead of boxes.
 *
 * TWO DELIBERATE DEPARTURES FROM THAT DESIGN:
 *
 *  - It is the WORKSHOP's invoice, not Platform OS's. The original was
 *    Platform OS invoicing its own customers, so it led with the Platform OS
 *    One lockup and Platform OS's ABN. Here the masthead is the org's own
 *    business name and ABN, pulled from `organizations` (the same data
 *    Settings.jsx edits). Platform OS appears only as the faint watermark.
 *    Shipping the original as-is would have put the wrong entity's ABN on a
 *    customer's tax invoice.
 *  - A4, not US Letter. The original was letter-sized, which is wrong for
 *    every business this product is sold to.
 *
 * Data is still deliberately minimal: this app's invoice model carries no
 * line items (only jobs do), so the PDF shows exactly what the Invoices
 * screen shows rather than inventing detail that does not exist.
 */
const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Palette lifted from the origami design.
const WASHI = [243, 236, 221];        // #F3ECDD — paper
const SUMI = [32, 28, 22];            // #201C16 — ink
const VERMILLION = [191, 51, 36];     // #BF3324 — the one accent
const MUTED = [138, 127, 110];        // #8a7f6e
const GOLD = [138, 107, 63];          // #8a6b3f
const RULE = [196, 184, 163];         // hairline, ink at ~25% over washi
const WHITE = [255, 255, 255];
const JADE_TINT = [214, 231, 216];    // paid pill ground

const STATUS_STYLE = {
  Paid: { fg: [22, 90, 61], bg: JADE_TINT },
  Sent: { fg: GOLD, bg: [235, 226, 208] },
  Overdue: { fg: WHITE, bg: VERMILLION },
  'On account': { fg: MUTED, bg: [235, 226, 208] },
};

const MARK_W = 195;
const MARK_H = 151;

function registerFonts(doc) {
  doc.addFileToVFS('Figtree-Regular.ttf', FigtreeRegular);
  doc.addFont('Figtree-Regular.ttf', 'Figtree', 'normal');
  doc.addFileToVFS('Figtree-Bold.ttf', FigtreeBold);
  doc.addFont('Figtree-Bold.ttf', 'Figtree', 'bold');
  doc.addFileToVFS('ShipporiMincho-Regular.ttf', ShipporiMinchoRegular);
  doc.addFont('ShipporiMincho-Regular.ttf', 'Shippori', 'normal');
  doc.addFileToVFS('ShipporiMincho-Bold.ttf', ShipporiMinchoBold);
  doc.addFont('ShipporiMincho-Bold.ttf', 'Shippori', 'bold');
}

// Faint Platform OS mark, right of centre. Drawn before everything else so
// body content sits over it, the way a print watermark should.
function drawWatermark(doc, pageW, pageH) {
  const w = 74;
  const h = (w / MARK_W) * MARK_H;
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.10 }));
  doc.addImage(POS_ONE_MARK_PNG, 'PNG', pageW - 56 - w, pageH - 150, w, h);
  doc.restoreGraphicsState();
}

// Letterspacing by hand — jsPDF has no tracking control, and the small
// uppercase labels in this design lean on it heavily.
function tracked(doc, text, x, y, spacing, opts = {}) {
  const chars = String(text).split('');
  let cx = x;
  if (opts.align === 'right') {
    const total = chars.reduce((w, c) => w + doc.getTextWidth(c) + spacing, 0) - spacing;
    cx = x - total;
  }
  for (const c of chars) {
    doc.text(c, cx, y);
    cx += doc.getTextWidth(c) + spacing;
  }
}

export function generateInvoicePdf(invoice, org) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  registerFonts(doc);

  const pageW = 595.28;
  const pageH = 841.89;
  const left = 56;
  const right = 539;

  doc.setFillColor(...WASHI);
  doc.rect(0, 0, pageW, pageH, 'F');
  drawWatermark(doc, pageW, pageH);

  const businessName = org?.trading_as || org?.business_name || 'Business name not set (see Settings)';

  // Only a GST-registered business may issue a "tax invoice" or charge GST.
  // Default true because that is the common case, but a sole trader or a
  // young company under the threshold gets a plain invoice with no GST line,
  // which is what the law requires rather than a cosmetic preference.
  const gstRegistered = org?.gst_registered !== false;

  // --- Masthead -------------------------------------------------------------
  doc.setFont('Shippori', 'bold');
  doc.setTextColor(...SUMI);
  // Fit the name to the room left of the title rather than letting a long
  // legal entity name run through "Tax Invoice".
  let nameSize = 19;
  doc.setFontSize(nameSize);
  while (nameSize > 10.5 && doc.getTextWidth(businessName) > 250) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  doc.text(businessName, left, 74);

  doc.setFont('Figtree', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  let cy = 90;
  for (const line of [org?.address, [org?.phone, org?.email].filter(Boolean).join('   ·   ')].filter(Boolean)) {
    doc.text(String(line), left, cy);
    cy += 12;
  }

  doc.setFont('Shippori', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...SUMI);
  doc.text(gstRegistered ? 'Tax Invoice' : 'Invoice', right, 76, { align: 'right' });

  doc.setFont('Figtree', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  tracked(doc, `NO. ${invoice.id}`, right, 94, 1.4, { align: 'right' });

  // The customer's own order number, quoted back at them. Fleet and trade
  // accounts match on this, not on our invoice number.
  if (invoice.orderNumber) {
    doc.setFont('Figtree', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Your order ${invoice.orderNumber}`, right, 106, { align: 'right' });
  }

  doc.setDrawColor(...SUMI);
  doc.setLineWidth(1.5);
  doc.line(left, 116, right, 116);

  // --- Meta: who it is for, and the terms ----------------------------------
  let y = 150;
  const colR = left + 250;

  doc.setFont('Figtree', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  tracked(doc, 'BILL TO', left, y, 1.2);
  tracked(doc, 'DETAILS', colR, y, 1.2);
  y += 18;

  doc.setFont('Shippori', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...SUMI);
  doc.text(String(invoice.customer || ''), left, y);

  // The vehicle, printed directly under the customer. A workshop invoice
  // without the car on it is a receipt — this is the line the customer scans
  // for first, and the line a fleet manager files by.
  const vehicleLine = [invoice.vehicle, invoice.rego].filter(Boolean).join('  ·  ');
  if (vehicleLine) {
    doc.setFont('Figtree', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(vehicleLine, left, y + 16);
  }

  const meta = [
    invoice.job ? ['Job', invoice.job] : null,
    invoice.orderNumber ? ['Your order', invoice.orderNumber] : null,
    invoice.odometer ? ['Odometer', invoice.odometer] : null,
    invoice.nextServiceKm ? ['Next service', invoice.nextServiceKm] : null,
    ['Terms', invoice.terms || 'Due on receipt'],
    invoice.dueBy ? ['Due', invoice.dueBy] : null,
  ].filter(Boolean);
  let my = y;
  for (const [label, value] of meta) {
    doc.setFont('Figtree', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(label, colR, my);
    doc.setFont('Figtree', 'bold');
    doc.setTextColor(...SUMI);
    doc.text(String(value), right, my, { align: 'right' });
    my += 15;
  }

  // Status, as a small pill under the customer name.
  const status = displayStatus(invoice);
  const received = paidTotal(invoice);
  const owing = balanceDue(invoice);
  const s = STATUS_STYLE[status] || STATUS_STYLE.Sent;
  doc.setFont('Figtree', 'bold');
  doc.setFontSize(8);
  const pillW = doc.getTextWidth(status.toUpperCase()) + 8 * 2 + 6;
  doc.setFillColor(...s.bg);
  const pillY = vehicleLine ? y + 26 : y + 10;
  doc.roundedRect(left, pillY, pillW, 16, 8, 8, 'F');
  doc.setTextColor(...s.fg);
  tracked(doc, status.toUpperCase(), left + 11, pillY + 11, 1);

  y = Math.max(my, pillY + 24) + 30;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.8);
  doc.line(left, y, right, y);
  y += 34;

  // --- Items ----------------------------------------------------------------
  // Accepts both shapes: the [desc, qty, total] tuples the job card produces,
  // and the {code, desc, qty, price, total} objects the Workshop Software
  // import carries. Invoices with no line detail simply skip this block.
  const money = invoiceTotals(invoice);
  const items = money.items;

  if (items.length) {
    doc.setFont('Figtree', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    tracked(doc, 'ITEMS', left, y, 1.2);
    y += 16;

    // Keep it to one page. Better to say plainly that lines were omitted than
    // to silently spill off the bottom of the sheet.
    const maxY = pageH - 300;
    let shown = 0;
    for (const it of items) {
      if (y > maxY) break;
      doc.setFont('Figtree', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...SUMI);
      doc.text(doc.splitTextToSize(it.desc, 300)[0], left, y);
      // Qty x unit price, the way a workshop reads a line: what it was and
      // what one of them cost. Only where it adds information — a single item
      // priced at its line total needs no arithmetic spelled out.
      if (it.qty > 1) {
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(`${it.qty} × ${fmt(it.price)}`, right - 90, y, { align: 'right' });
        doc.setFontSize(9.5);
        doc.setTextColor(...SUMI);
      }
      doc.setFont('Figtree', 'bold');
      doc.text(fmt(it.total), right, y, { align: 'right' });
      y += 14;
      shown++;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.4);
      doc.line(left, y - 9, right, y - 9);
    }
    if (shown < items.length) {
      doc.setFont('Figtree', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(`+ ${items.length - shown} more items not shown`, left, y);
      y += 14;
    }
    y += 18;
  }

  // --- Amounts --------------------------------------------------------------
  // Where line items exist and reconcile with the invoice total, the GST split
  // is exact. Where they don't, it falls back to 1/11 of the total, which is
  // all the data supports and is only right when every line is taxable. The
  // "Total price includes GST" line is the ATO-permitted wording and stays
  // true either way.
  const { total, exGst, gst } = money;

  const amountRow = (label, value, opts = {}) => {
    doc.setFont('Figtree', opts.strong ? 'bold' : 'normal');
    doc.setFontSize(opts.strong ? 10.5 : 10);
    doc.setTextColor(...(opts.strong ? SUMI : MUTED));
    doc.text(label, colR, y);
    doc.setFont('Figtree', 'bold');
    doc.setTextColor(...SUMI);
    doc.text(fmt(value), right, y, { align: 'right' });
    y += 19;
  };

  if (gstRegistered) {
    amountRow('Subtotal (ex GST)', exGst);
    amountRow('GST (10%)', gst);
  } else {
    amountRow('Subtotal', Number(invoice.amount || 0));
  }

  y += 4;
  doc.setDrawColor(...SUMI);
  doc.setLineWidth(1.5);
  doc.line(colR, y, right, y);
  y += 26;

  doc.setFont('Shippori', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...SUMI);
  doc.text('Total', colR, y);
  doc.setFontSize(25);
  doc.setTextColor(...VERMILLION);
  doc.text(fmt(invoice.amount), right, y + 2, { align: 'right' });
  y += 18;

  doc.setFont('Figtree', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(gstRegistered ? 'Total price includes GST' : 'No GST has been charged', right, y, { align: 'right' });

  // Payments taken, then what's actually still owed. A customer holding a
  // part-paid invoice needs to see their deposit acknowledged and the balance
  // stated plainly — a total alone reads as though nothing was ever paid.
  if (received > 0) {
    y += 22;
    paymentsOf(invoice).forEach((pmt) => {
      doc.setFont('Figtree', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(`${fmtDate(pmt.date)} · ${pmt.method === 'Credit' ? 'Account credit' : pmt.method}`, colR, y);
      doc.setFont('Figtree', 'bold');
      doc.setTextColor(...SUMI);
      doc.text('-' + fmt(pmt.amount), right, y, { align: 'right' });
      y += 15;
    });
    y += 6;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(colR, y, right, y);
    y += 20;
    doc.setFont('Shippori', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...SUMI);
    doc.text(owing > 0.005 ? 'Balance due' : 'Balance', colR, y);
    doc.setFontSize(20);
    doc.setTextColor(...(owing > 0.005 ? VERMILLION : SUMI));
    doc.text(fmt(owing), right, y + 1, { align: 'right' });
  }

  // Paid stamp, angled across the amount block.
  if (status === 'Paid') {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.16 }));
    doc.setFont('Shippori', 'bold');
    doc.setFontSize(52);
    doc.setTextColor(...VERMILLION);
    doc.text('PAID', colR - 26, y - 6, { angle: 12 });
    doc.restoreGraphicsState();
  }

  y += 46;

  // --- How it was, or can be, paid -----------------------------------------
  if (invoice.paidVia === 'zeller') {
    doc.setFont('Figtree', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    tracked(doc, 'PAID VIA ZELLER TERMINAL', left, y, 1.2);
    if (invoice.zellerTransactionUuid) {
      doc.setFont('Figtree', 'normal');
      doc.setFontSize(9);
      doc.text(invoice.zellerTransactionUuid, right, y, { align: 'right' });
    }
    y += 22;
  } else if (org?.bank_name || org?.bank_bsb || org?.bank_account) {
    doc.setFont('Figtree', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    tracked(doc, 'BANK TRANSFER', left, y, 1.2);
    y += 16;
    doc.setFont('Figtree', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SUMI);
    const details = [
      org?.bank_name && `Bank ${org.bank_name}`,
      org?.bank_bsb && `BSB ${org.bank_bsb}`,
      org?.bank_account && `Account ${org.bank_account}`,
      `Reference ${invoice.id}`,
    ].filter(Boolean);
    doc.text(details.join('   ·   '), left, y);
    y += 20;
  }

  // --- Invoice notes --------------------------------------------------------
  // What the workshop wants the customer to read: what was found, what's due
  // next, what wasn't done and why. Wrapped and clipped to the space left above
  // the footer rather than allowed to run off the page.
  if (invoice.notes) {
    const noteLines = doc.splitTextToSize(String(invoice.notes), right - left);
    const room = Math.floor((pageH - 96 - y) / 12);
    if (room >= 2) {
      doc.setFont('Figtree', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      tracked(doc, 'NOTES', left, y, 1.2);
      y += 15;
      doc.setFont('Figtree', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...SUMI);
      for (const line of noteLines.slice(0, room - 1)) {
        doc.text(line, left, y);
        y += 12;
      }
    }
  }

  // --- Footer ---------------------------------------------------------------
  const footY = pageH - 58;
  doc.setDrawColor(...SUMI);
  doc.setLineWidth(1.5);
  doc.line(left, footY - 18, right, footY - 18);

  doc.setFont('Figtree', 'normal');
  doc.setFontSize(8.5);
  // An Australian tax invoice over $82.50 must carry the supplier's ABN. If it
  // is not set we say so loudly on the document rather than printing nothing
  // and letting an invalid invoice go out looking finished.
  if (org?.abn) {
    doc.setTextColor(...MUTED);
    doc.text(`${org?.business_name || businessName}  ·  ABN ${org.abn}`, left, footY);
  } else {
    doc.setTextColor(...VERMILLION);
    doc.text(`${org?.business_name || businessName}  ·  ABN NOT SET — add it in Settings`, left, footY);
  }

  doc.setFont('Figtree', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Generated by Platform OS One', right, footY, { align: 'right' });

  doc.save(`${invoice.id}.pdf`);
}
