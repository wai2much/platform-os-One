// Pushes an invoice to Xero on creation or "Mark as paid" — see
// XERO_INTEGRATION.md: "Invoices screen -> Xero invoices/contacts, pushed on
// invoice creation or Mark as paid." Called best-effort (fire-and-forget)
// from store.jsx; never blocks or breaks the local invoice flow if Xero
// isn't connected or the push fails.
import { getXeroConnection, xeroApiFetch } from '../_xeroClient.js';

async function findOrCreateContact(conn, name) {
  const safeName = name.replace(/"/g, '\\"');
  const searchRes = await xeroApiFetch(conn, `Contacts?where=${encodeURIComponent(`Name=="${safeName}"`)}`);
  if (searchRes.ok) {
    const { Contacts } = await searchRes.json();
    if (Contacts?.length) return Contacts[0].ContactID;
  }
  const createRes = await xeroApiFetch(conn, 'Contacts', {
    method: 'POST',
    body: JSON.stringify({ Contacts: [{ Name: name }] }),
  });
  if (!createRes.ok) throw new Error(`Xero contact create failed: ${createRes.status}`);
  const { Contacts } = await createRes.json();
  return Contacts[0].ContactID;
}

async function findInvoiceByNumber(conn, invoiceNumber) {
  const res = await xeroApiFetch(conn, `Invoices?where=${encodeURIComponent(`InvoiceNumber=="${invoiceNumber}"`)}`);
  if (!res.ok) return null;
  const { Invoices } = await res.json();
  return Invoices?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'POST only' });

  const conn = await getXeroConnection();
  if (!conn) return res.status(200).json({ ok: false, configured: false });

  const { invoice, event } = req.body || {};
  if (!invoice?.id || !invoice?.customer) return res.status(400).json({ ok: false, message: 'invoice.id and invoice.customer are required' });

  try {
    const existing = await findInvoiceByNumber(conn, invoice.id);
    if (existing) {
      // Already pushed (e.g. created-event ran before). "Paid" event lands
      // here too — recording the actual Xero Payment needs a bank account id,
      // which isn't wired up yet (see note below), so we just confirm the
      // invoice exists rather than fake a payment record.
      return res.status(200).json({ ok: true, configured: true, xeroInvoiceId: existing.InvoiceID, paymentRecorded: false });
    }

    const contactId = await findOrCreateContact(conn, invoice.customer);
    const exGst = Math.round((invoice.amount / 1.1) * 100) / 100;
    const lineItems = (invoice.lines && invoice.lines.length)
      ? invoice.lines.map(([desc, qty, amount]) => ({ Description: desc, Quantity: qty || 1, UnitAmount: amount, TaxType: 'OUTPUT' }))
      : [{ Description: invoice.job || 'Workshop invoice', Quantity: 1, UnitAmount: exGst, TaxType: 'OUTPUT' }];

    const createRes = await xeroApiFetch(conn, 'Invoices', {
      method: 'POST',
      body: JSON.stringify({
        Invoices: [{
          Type: 'ACCREC',
          Contact: { ContactID: contactId },
          LineItems: lineItems,
          InvoiceNumber: invoice.id,
          Reference: invoice.job || '',
          Status: 'AUTHORISED',
        }],
      }),
    });
    if (!createRes.ok) return res.status(200).json({ ok: false, configured: true, message: `Xero invoice create failed: ${createRes.status}` });
    const { Invoices } = await createRes.json();

    // Payment recording (event === 'paid' with no prior Xero invoice) needs a
    // Xero bank account id, which we don't have yet — flagged, not faked.
    return res.status(200).json({ ok: true, configured: true, xeroInvoiceId: Invoices[0].InvoiceID, paymentRecorded: false });
  } catch (err) {
    console.error('Xero invoice sync failed', err);
    return res.status(200).json({ ok: false, configured: true, message: err.message });
  }
}
