/**
 * Invoice money — one place that decides what an invoice is actually worth
 * and how much of it is still owed.
 *
 * Modelled on Workshop Software, which a workshop can genuinely run its money
 * on. The thing Slim was missing is that an invoice is not a boolean. WSS puts
 * "Balance Due" at the top of every invoice, keeps a ledger of payments against
 * it, and treats a deposit and an applied account credit as just two more rows
 * in that ledger. Everything below is that idea and nothing more.
 *
 * A payment row:
 *   { id, date: 'YYYY-MM-DD', amount, method, ref, note }
 * method is one of PAYMENT_METHODS. 'Credit' means account credit applied
 * rather than money that moved — it still reduces the balance, which is what
 * WSS's "Unapplied Credit" does when you apply it.
 */

export const PAYMENT_METHODS = ['Card', 'Cash', 'Bank transfer', 'Credit'];

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export const paymentsOf = (inv) => (Array.isArray(inv?.payments) ? inv.payments : []);

/** Everything received against this invoice, deposits and applied credit included. */
export const paidTotal = (inv) => round2(paymentsOf(inv).reduce((s, p) => s + (Number(p.amount) || 0), 0));

/**
 * What's still owed. Invoices that predate the payments ledger carry no rows,
 * so a legacy 'Paid' invoice is owed nothing and everything else is owed in
 * full — that keeps old data honest instead of resurrecting settled debt.
 */
export function balanceDue(inv) {
  const amount = Number(inv?.amount) || 0;
  // An invoice with no ledger at all predates this: a legacy 'Paid' owes
  // nothing, anything else owes the lot. Once there is even one row — including
  // a payment fully refunded back out — the ledger is the truth.
  if (paymentsOf(inv).length === 0) return inv?.status === 'Paid' ? 0 : round2(amount);
  return round2(amount - paidTotal(inv));
}

/** True once the balance is settled (or overpaid — a refund is a later problem). */
export const isSettled = (inv) => balanceDue(inv) <= 0.005;

/**
 * The status to *show*. The stored status still records intent (Sent, Overdue,
 * On account); the ledger decides whether it's been paid, partly or fully. That
 * ordering matters: it means recording a payment never has to rewrite history.
 */
export function displayStatus(inv) {
  const rows = paymentsOf(inv);
  if (rows.length === 0) return inv?.status || 'Sent';
  if (isSettled(inv)) return 'Paid';
  // Refunded right back to nothing: the invoice is open again, and must not
  // keep wearing a 'Paid' label it no longer earns.
  if (paidTotal(inv) <= 0) return inv?.status === 'Paid' ? 'Sent' : (inv?.status || 'Sent');
  return 'Part paid';
}

/** GST split for an inc-GST total, AU 10%. Kept here so nothing re-derives it. */
export function gstSplit(totalIncGst) {
  const total = round2(totalIncGst);
  const exGst = round2(total / 1.1);
  return { total, exGst, gst: round2(total - exGst) };
}

export const fmtMoney = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * A refund is a negative row in the same ledger, not a separate concept. That
 * keeps one arithmetic — balance = total - sum(ledger) — true in every case,
 * and means a refunded invoice reopens on its own without anyone remembering
 * to flip a status.
 */
export function makeRefund({ amount, method, ref, note, date }) {
  return makePayment({ amount: -Math.abs(round2(amount)), method, ref, note: note || 'Refund', date });
}

/** What could still be handed back — never more than what came in. */
export const refundableTotal = (inv) => Math.max(0, paidTotal(inv));

export const isRefund = (pmt) => (Number(pmt?.amount) || 0) < 0;

export function makePayment({ amount, method, ref, note, date }) {
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    date: date || todayIso(),
    amount: round2(amount),
    method: PAYMENT_METHODS.includes(method) ? method : 'Card',
    ref: ref || '',
    note: note || '',
  };
}

/* -------------------------------------------------------------------------
 * Line items
 *
 * Two shapes exist in the wild and both have to keep working:
 *   [desc, qty, total]                       — what a job card produces
 *   { code, desc, qty, price, total }        — what the Workshop Software
 *                                              import carries
 * Normalising in one place means the screen and the PDF can never disagree
 * about what a line says, which they quietly did before.
 * ------------------------------------------------------------------------- */

/** Qty x unit price, less any percentage discount. Rounded once, at the end. */
export function lineTotal({ qty, price, discount }) {
  const gross = (Number(qty) || 0) * (Number(price) || 0);
  return round2(gross * (1 - (Number(discount) || 0) / 100));
}

export function normalizeLines(invoice) {
  const raw = Array.isArray(invoice?.lines) ? invoice.lines : [];
  return raw
    .map((l) => {
      const o = Array.isArray(l)
        ? { code: '', desc: String(l[0] ?? ''), qty: Number(l[1]) || 0, price: null, discount: 0, total: Number(l[2]) || 0, taxFree: false }
        : {
            code: String(l.code || ''),
            desc: String(l.desc || l.code || ''),
            qty: Number(l.qty) || 0,
            price: l.price == null ? null : Number(l.price) || 0,
            discount: Number(l.discount) || 0,
            total: Number(l.total ?? lineTotal(l)) || 0,
            taxFree: !!l.taxFree,
          };
      // Unit price is derived where it wasn't sent, so the grid never shows a
      // blank column just because the source only gave a line total.
      if (o.price == null) o.price = o.qty > 0 ? round2(o.total / o.qty) : o.total;
      return o;
    })
    .filter((l) => l.desc || l.total);
}

/**
 * The money on an invoice, reconciled against its lines.
 *
 * Workshop Software carries GST per line and totals ex-GST, so the split is
 * exact when the lines add up. Where they don't — or where there are no lines
 * at all — this falls back to 1/11 of the invoice total, which is all the data
 * supports and is only strictly right when every line is taxable. That fallback
 * is stated rather than hidden: `exact` tells the caller which one it got.
 */
export function invoiceTotals(invoice) {
  const items = normalizeLines(invoice);
  const total = round2(invoice?.amount || 0);
  const lineSum = round2(items.reduce((a, i) => a + i.total, 0));

  // Lines that sum to the total are inc-GST; lines that sum to total/1.1 are
  // ex-GST. Anything else and the lines simply don't reconcile.
  const incGst = items.length > 0 && Math.abs(lineSum - total) < 0.02;
  const linesAreExGst = items.length > 0 && Math.abs(round2(lineSum * 1.1) - total) < 0.02;
  const exact = incGst || linesAreExGst;

  const withGst = items.map((i) => {
    const incGstTotal = incGst ? i.total : round2(i.total * 1.1);
    return { ...i, incGstTotal, gst: i.taxFree ? 0 : round2(incGstTotal - incGstTotal / 1.1) };
  });

  // Where the lines reconcile, GST is the sum of the lines — which is the only
  // way a tax-free line (a government charge, a rego fee) can be honest. Where
  // they don't, fall back to 1/11 of the total, right only if everything is
  // taxable. `exact` tells the caller which of the two it got.
  const gst = exact ? round2(withGst.reduce((a, i) => a + i.gst, 0)) : round2(total - total / 1.1);
  const exGst = round2(total - gst);

  return { items: withGst, total, exGst, gst, exact, linesAreExGst, hasTaxFree: withGst.some((i) => i.taxFree) };
}
