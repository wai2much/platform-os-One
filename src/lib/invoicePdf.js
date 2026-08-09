import { jsPDF } from 'jspdf';

/**
 * Real invoice PDF generation — client-side, no backend call, no fake
 * "Download PDF" button. Pulls the actual org business profile (name,
 * address, bank details) from `organizations`, same data Settings.jsx
 * edits — never hardcoded, per the 2026-08-08 fix for business details
 * leaking across orgs (see git history: 72da085).
 *
 * Deliberately minimal: this app's invoice model doesn't carry line items
 * (only jobs do — see Jobs.jsx), so the PDF shows exactly what the
 * Invoices screen itself shows: the GST breakdown, not fabricated line
 * items that don't exist in the data.
 */
const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateInvoicePdf(invoice, org) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 48;
  let y = 56;

  const businessName = org?.trading_as || org?.business_name || 'Business name not set (see Settings)';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(businessName, left, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  [org?.address, org?.phone, org?.email].filter(Boolean).forEach((line) => {
    doc.text(line, left, y);
    y += 14;
  });

  y += 18;
  doc.setDrawColor(220);
  doc.line(left, y, 547, y);
  y += 28;

  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Invoice ${invoice.id}`, left, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const rows = [
    ['Customer', invoice.customer],
    invoice.job ? ['Job', invoice.job] : null,
    ['Terms', invoice.terms],
    ['Due by', invoice.dueBy],
    ['Status', invoice.status],
  ].filter(Boolean);
  rows.forEach(([label, value]) => {
    doc.setTextColor(120);
    doc.text(label, left, y);
    doc.setTextColor(20);
    doc.text(String(value), left + 110, y);
    y += 18;
  });

  y += 16;
  doc.setDrawColor(230);
  doc.setFillColor(247, 245, 240);
  doc.roundedRect(left, y, 499, 100, 8, 8, 'F');
  y += 28;
  const col2 = 500;
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text('Subtotal (ex GST)', left + 16, y);
  doc.setTextColor(20);
  doc.text(fmt(invoice.amount / 1.1), col2, y, { align: 'right' });
  y += 20;
  doc.setTextColor(90);
  doc.text('GST (10%)', left + 16, y);
  doc.setTextColor(20);
  doc.text(fmt(invoice.amount - invoice.amount / 1.1), col2, y, { align: 'right' });
  y += 22;
  doc.setDrawColor(210);
  doc.line(left + 16, y - 8, col2, y - 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Total due (inc GST)', left + 16, y + 8);
  doc.text(fmt(invoice.amount), col2, y + 8, { align: 'right' });
  y += 48;

  if (invoice.paidVia === 'zeller') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(120);
    doc.text(`Paid via Zeller Terminal${invoice.zellerTransactionUuid ? ' · ' + invoice.zellerTransactionUuid : ''}`, left, y);
    y += 20;
  } else if (org?.bank_name || org?.bank_bsb || org?.bank_account) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(20);
    doc.text('Bank transfer details', left, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    [
      org?.bank_name && ['Bank', org.bank_name],
      org?.bank_bsb && ['BSB', org.bank_bsb],
      org?.bank_account && ['Account number', org.bank_account],
      ['Reference', invoice.id],
    ].filter(Boolean).forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, left, y);
      y += 15;
    });
  }

  doc.save(`${invoice.id}.pdf`);
}
