import { jsPDF } from 'jspdf';
import { CaprasimoRegular, FigtreeRegular, FigtreeBold, FigtreeExtraBold } from './fonts/invoiceFonts';

/**
 * Real invoice PDF generation — client-side, no backend call, no fake
 * "Download PDF" button. Pulls the actual org business profile (name,
 * address, bank details) from `organizations`, same data Settings.jsx
 * edits — never hardcoded, per the 2026-08-08 fix for business details
 * leaking across orgs (see git history: 72da085).
 *
 * Deliberately minimal on data: this app's invoice model doesn't carry
 * line items (only jobs do — see Jobs.jsx), so the PDF shows exactly what
 * the Invoices screen itself shows (the GST breakdown), not fabricated
 * line items that don't exist.
 *
 * Deliberately NOT minimal on look: this mirrors the actual Invoices
 * payment-modal design — same palette (src/index.css light-theme tokens),
 * same two fonts the app uses (Figtree + Caprasimo, embedded from Google
 * Fonts as base64 in ./fonts/invoiceFonts.js), same dark "ink" header
 * band + status pill + tan GST panel — so it reads as the same product,
 * not a generic PDF-library default. First version of this (helvetica,
 * grey-on-white) looked nothing like the app — this is the fix for that.
 */
const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Same hex values as src/index.css's :root (light theme) tokens — kept in
// sync by hand since a PDF can't read CSS custom properties.
const INK = [32, 30, 29]; // --ink / --text
const INK_TEXT = [245, 234, 216]; // --ink-text (cream text on the dark band)
const CARD_BG = [255, 250, 240]; // --card-bg
const PANEL_BG = [239, 224, 200]; // --panel-bg
const TEXT_SOFT = [60, 57, 54]; // --text-soft
const TEXT_MUTE = [111, 106, 99]; // --text-mute
const BORDER = [224, 220, 207]; // --border-c
const VERMILLION = [198, 113, 57]; // #c67139 — accent throughout the app
const SAGE = [122, 138, 94]; // #7a8a5e — "paid"/success across the app
const SAGE_TINT = [234, 232, 217]; // sage at ~16% over card-bg, same math as the modal's rgba(122,138,94,.16)
const WHITE = [255, 255, 255];

// STATUS pill colors — copied 1:1 from Invoices.jsx's STATUS map so the PDF
// badge matches the on-screen one exactly rather than approximating it.
const STATUS_STYLE = {
  Overdue: { fg: WHITE, bg: VERMILLION },
  Sent: { fg: SAGE, bg: SAGE_TINT },
  Paid: { fg: WHITE, bg: SAGE },
  'On account': { fg: TEXT_SOFT, bg: PANEL_BG },
};

function registerFonts(doc) {
  doc.addFileToVFS('Figtree-Regular.ttf', FigtreeRegular);
  doc.addFont('Figtree-Regular.ttf', 'Figtree', 'normal');
  doc.addFileToVFS('Figtree-Bold.ttf', FigtreeBold);
  doc.addFont('Figtree-Bold.ttf', 'Figtree', 'bold');
  doc.addFileToVFS('Figtree-ExtraBold.ttf', FigtreeExtraBold);
  doc.addFont('Figtree-ExtraBold.ttf', 'Figtree', 'extrabold');
  doc.addFileToVFS('Caprasimo-Regular.ttf', CaprasimoRegular);
  doc.addFont('Caprasimo-Regular.ttf', 'Caprasimo', 'normal');
}

export function generateInvoicePdf(invoice, org) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  registerFonts(doc);

  const pageW = 595.28;
  const left = 48;
  const right = 547;
  const businessName = org?.trading_as || org?.business_name || 'Business name not set (see Settings)';

  // --- Dark "ink" header band, same as the modal's header ---
  const headerH = 118;
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Vermillion circular badge with a $ mark, same accent circle as the modal
  doc.setFillColor(...VERMILLION);
  doc.circle(left + 20, 46, 20, 'F');
  doc.setFont('Figtree', 'extrabold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text('$', left + 20, 51.5, { align: 'center' });

  doc.setFont('Caprasimo', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...INK_TEXT);
  doc.text(businessName, left + 54, 42);

  doc.setFont('Figtree', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(164, 154, 140); // --ink-soft
  const contactLine = [org?.address, org?.phone, org?.email].filter(Boolean).join('  ·  ');
  if (contactLine) doc.text(contactLine, left + 54, 58);

  doc.setFont('Caprasimo', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(...INK_TEXT);
  doc.text(invoice.id, right, 42, { align: 'right' });

  // Status pill, top right of the header
  const status = invoice.status || 'Sent';
  const s = STATUS_STYLE[status] || STATUS_STYLE.Sent;
  doc.setFont('Figtree', 'bold');
  doc.setFontSize(9);
  const pillW = doc.getTextWidth(status.toUpperCase()) + 20;
  doc.setFillColor(...s.bg);
  doc.roundedRect(right - pillW, 52, pillW, 18, 9, 9, 'F');
  doc.setTextColor(...s.fg);
  doc.text(status.toUpperCase(), right - pillW / 2, 64, { align: 'center' });

  let y = headerH + 34;

  // --- Customer / job meta rows ---
  doc.setFont('Figtree', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text(invoice.customer, left, y);
  y += 22;

  doc.setFontSize(10);
  const rows = [
    invoice.job ? ['Job', invoice.job] : null,
    ['Terms', invoice.terms],
    ['Due by', invoice.dueBy],
  ].filter(Boolean);
  rows.forEach(([label, value]) => {
    doc.setFont('Figtree', 'bold');
    doc.setTextColor(...TEXT_MUTE);
    doc.text(label.toUpperCase(), left, y);
    doc.setFont('Figtree', 'normal');
    doc.setTextColor(...TEXT_SOFT);
    doc.text(String(value), left + 90, y);
    y += 16;
  });

  y += 20;

  // --- Tan GST breakdown panel, same panel-bg + rounded corners as the modal ---
  const panelH = 108;
  doc.setFillColor(...PANEL_BG);
  doc.roundedRect(left, y, right - left, panelH, 10, 10, 'F');
  let py = y + 28;
  const col2 = right - 18;

  doc.setFont('Figtree', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT_MUTE);
  doc.text('Subtotal (ex GST)', left + 18, py);
  doc.setFont('Figtree', 'bold');
  doc.setTextColor(...TEXT_SOFT);
  doc.text(fmt(invoice.amount / 1.1), col2, py, { align: 'right' });
  py += 20;

  doc.setFont('Figtree', 'normal');
  doc.setTextColor(...TEXT_MUTE);
  doc.text('GST (10%)', left + 18, py);
  doc.setFont('Figtree', 'bold');
  doc.setTextColor(...TEXT_SOFT);
  doc.text(fmt(invoice.amount - invoice.amount / 1.1), col2, py, { align: 'right' });
  py += 18;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(1);
  doc.line(left + 18, py, col2, py);
  py += 26;

  doc.setFont('Figtree', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text('Total due (inc GST)', left + 18, py);
  doc.setFont('Caprasimo', 'normal');
  doc.setFontSize(21);
  doc.setTextColor(...INK);
  doc.text(fmt(invoice.amount), col2, py + 2, { align: 'right' });

  y += panelH + 34;

  // --- Footer: how it was/can be paid ---
  if (invoice.paidVia === 'zeller') {
    doc.setFillColor(...SAGE_TINT);
    doc.roundedRect(left, y, right - left, 34, 8, 8, 'F');
    doc.setFont('Figtree', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...SAGE);
    doc.text('PAID VIA ZELLER TERMINAL', left + 16, y + 21);
    if (invoice.zellerTransactionUuid) {
      doc.setFont('Figtree', 'normal');
      doc.setTextColor(...TEXT_MUTE);
      doc.text(invoice.zellerTransactionUuid, right - 16, y + 21, { align: 'right' });
    }
  } else if (org?.bank_name || org?.bank_bsb || org?.bank_account) {
    doc.setFont('Figtree', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('BANK TRANSFER DETAILS', left, y);
    y += 18;
    doc.setFont('Figtree', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_MUTE);
    const details = [
      org?.bank_name && `Bank: ${org.bank_name}`,
      org?.bank_bsb && `BSB: ${org.bank_bsb}`,
      org?.bank_account && `Account: ${org.bank_account}`,
      `Reference: ${invoice.id}`,
    ].filter(Boolean);
    doc.text(details.join('   ·   '), left, y);
  }

  doc.save(`${invoice.id}.pdf`);
}
