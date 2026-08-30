import { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useAuth } from '@/core/auth';
import { useTerminal } from '@/lib/zeller';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import { balanceDue, paidTotal, displayStatus, paymentsOf, fmtDate, invoiceTotals, lineTotal, PAYMENT_METHODS } from '@/lib/invoiceMoney';

/**
 * Invoices — core screen. Faithful to the prototype: table with credit-hold /
 * synced-from-job / on-account tags + a payment modal with the AU GST breakdown.
 * GST is 10% inclusive: ex-GST = total / 1.1, GST = total - ex-GST. Sample data
 * for now; "Mark as paid" mutates local state.
 */
const fmt = (n) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS = {
  Overdue: { color: '#fff', bg: '#c67139' },
  Sent: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Paid: { color: '#fff', bg: '#7a8a5e' },
  'Part paid': { color: '#fff', bg: '#c67139' },
  'On account': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const COLS = '1fr 1.2fr .8fr .8fr .9fr .8fr .8fr .8fr';

function StatusPill({ status, style }) {
  const s = STATUS[status] ?? STATUS.Sent;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, ...style }}>{status}</span>;
}

function Tag({ children, tone = 'sage' }) {
  const map = { sage: { color: '#fff', bg: '#7a8a5e' }, hold: { color: '#fff', bg: '#201e1d', border: '1px solid #c67139' }, panel: { color: '#201e1d', bg: 'var(--panel-bg)' } };
  const t = map[tone];
  return <span className="fg" style={{ fontSize: 9.5, fontWeight: 700, color: t.color, background: t.bg, border: t.border, borderRadius: 999, padding: '3px 8px', justifySelf: 'end' }}>{children}</span>;
}

function MethodTab({ label, active, onClick }) {
  return (
    <span className="fg" onClick={onClick}
      style={{ fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderRadius: 999, padding: '8px 16px',
        color: active ? '#fff' : 'var(--text-soft)', background: active ? '#c67139' : 'var(--panel-bg)' }}>{label}</span>
  );
}

const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

const btn = { fontSize: 13, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '9px 20px', cursor: 'pointer', border: 'none', fontFamily: 'Figtree, sans-serif' };
const btnDisabled = { ...btn, background: 'var(--panel-bg)', color: 'var(--text-mute)', cursor: 'not-allowed' };

/**
 * Real Zeller Terminal charge — see src/lib/zeller.jsx for why this is a
 * pure client-side SDK call, no backend involved. `initialise()` runs on
 * mount to non-interactively check pairing status without popping any UI;
 * `setup()` only fires when the merchant explicitly taps "Pair Terminal".
 * Requires a physical Zeller Terminal paired to this browser to actually
 * complete a tap — can't be exercised headlessly, only by Wai on the floor.
 */
function ZellerCharge({ invoice, amount, onPaid }) {
  const due = amount > 0 ? amount : balanceDue(invoice);
  const terminal = useTerminal();
  const [state, setState] = useState('checking'); // checking | setup_required | ready | charging
  const [note, setNote] = useState('');

  useEffect(() => {
    let live = true;
    terminal.initialise().then((result) => {
      if (!live) return;
      if (result === true) setState('ready');
      else {
        setState('setup_required');
        setNote(result?.type === 'Setup Required' ? '' : (result?.type || 'Not connected to a Zeller Terminal yet.'));
      }
    });
    return () => { live = false; };
  }, [terminal]);

  const pair = async () => {
    setState('checking');
    setNote('');
    const result = await terminal.setup();
    if (result === true) setState('ready');
    else { setState('setup_required'); setNote(result?.type === 'Cancelled' ? '' : result?.type || 'Pairing failed.'); }
  };

  const charge = async () => {
    setState('charging');
    setNote('');
    const result = await terminal.purchase({ amount: Math.round(due * 100), reference: invoice.id });
    if (result instanceof Error) {
      setState('ready');
      setNote(result.type === 'Cancelled' ? 'Cancelled on the Terminal.' : `${result.type} — try again.`);
      return;
    }
    onPaid({ paidVia: 'zeller', method: 'Card', amount: due, transactionUuid: result.transactionUuid, receiptLink: result.receiptLink, status: result.status });
  };

  return (
    <div>
      {state === 'checking' && <span style={btnDisabled}>Checking Zeller Terminal…</span>}
      {state === 'setup_required' && <span onClick={pair} className="fg" style={btn}>Pair Zeller Terminal</span>}
      {state === 'ready' && <span onClick={charge} className="fg" style={btn}>Charge {fmt(due)} with Zeller</span>}
      {state === 'charging' && <span style={btnDisabled}>Waiting for tap on Terminal…</span>}
      {note && <div className="fg" style={{ fontSize: 11.5, color: '#c67139', marginTop: 6, textAlign: 'right' }}>{note}</div>}
    </div>
  );
}

function NewInvoiceModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ customer: '', terms: 'Due on receipt', dueBy: 'Today', amount: '', orderNumber: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New invoice</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.customer} onChange={set('customer')} placeholder="Customer name" style={inp} />
          <select value={form.terms} onChange={set('terms')} style={inp}>
            <option>Due on receipt</option><option>Net 7</option><option>Net 14</option><option>Net 30</option><option>On account</option>
          </select>
          <input value={form.dueBy} onChange={set('dueBy')} placeholder="Due by (e.g. 12 Aug)" style={inp} />
          <input value={form.amount} onChange={set('amount')} inputMode="decimal" placeholder="Amount inc GST ($)" style={inp} />
          {/* The customer's own PO. Fleet and trade accounts won't pay an
              invoice that doesn't quote their order number back at them. */}
          <input value={form.orderNumber} onChange={set('orderNumber')} placeholder="Customer order / PO number (optional)" style={inp} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <span onClick={onClose} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
          <span onClick={() => form.customer.trim() && parseFloat(form.amount) > 0 && onCreate(form)}
            className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.customer.trim() && parseFloat(form.amount) > 0 ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 20px', cursor: form.customer.trim() && parseFloat(form.amount) > 0 ? 'pointer' : 'not-allowed' }}>
            Create invoice
          </span>
        </div>
      </div>
    </div>
  );
}



/**
 * Vehicle & job panel — the context Workshop Software puts above every invoice.
 *
 * Theirs is split across a vehicle card (rego, VIN, make/model) and the invoice
 * header (Odometer, Next Service Kilometers, Job Status, Job Status Comment,
 * Order Number). Collapsed into one block here because Slim's invoice is a
 * single modal, not a full page — but the fields a workshop actually fills are
 * the same ones, in the same order they'd fill them.
 *
 * Everything is free text. Rego formats vary by state, odometers get written as
 * "150,000 km" or "150000", and next service is "6 months or 10,000km" as often
 * as it's a number. A picker would fight the person using it.
 */
const JOB_STATUSES = ['Booked in', 'In progress', 'Awaiting parts', 'Awaiting approval', 'Ready for pickup', 'Completed'];

function VehicleJobPanel({ invoice, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const start = () => {
    setForm({
      vehicle: invoice.vehicle || '', rego: invoice.rego || '', odometer: invoice.odometer || '',
      nextServiceKm: invoice.nextServiceKm || '', jobStatus: invoice.jobStatus || '',
      jobStatusComment: invoice.jobStatusComment || '', orderNumber: invoice.orderNumber || '',
      notes: invoice.notes || '',
    });
    setEditing(true);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const shown = [
    ['Vehicle', invoice.vehicle], ['Rego', invoice.rego], ['Odometer', invoice.odometer],
    ['Next service', invoice.nextServiceKm], ['Job status', invoice.jobStatus],
    ['Customer PO', invoice.orderNumber],
  ].filter(([, v]) => v);

  const cell = { ...inp, padding: '8px 10px', fontSize: 12, borderRadius: 8 };

  if (!editing) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: shown.length ? 8 : 0 }}>
          <span className="fg" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>VEHICLE &amp; JOB</span>
          <span style={{ flex: 1 }} />
          <span onClick={start} className="fg" style={{ fontSize: 12, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>
            {shown.length ? 'Edit' : '+ Add vehicle details'}
          </span>
        </div>
        {shown.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
            {shown.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{k}</span>
                <span className="fg" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        {invoice.jobStatusComment && (
          <div className="fg" style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 8, fontStyle: 'italic' }}>{invoice.jobStatusComment}</div>
        )}
        {invoice.notes && (
          <div style={{ background: 'var(--panel-bg)', borderRadius: 12, padding: '10px 12px', marginTop: 10 }}>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>{invoice.notes}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="fg" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 8 }}>VEHICLE &amp; JOB</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <input value={form.vehicle} onChange={set('vehicle')} placeholder="Make / model" style={cell} />
        <input value={form.rego} onChange={set('rego')} placeholder="Rego" style={cell} />
        <input value={form.odometer} onChange={set('odometer')} placeholder="Odometer" style={cell} />
        <input value={form.nextServiceKm} onChange={set('nextServiceKm')} placeholder="Next service" style={cell} />
        <select value={form.jobStatus} onChange={set('jobStatus')} style={cell}>
          <option value="">Job status</option>
          {JOB_STATUSES.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <input value={form.orderNumber} onChange={set('orderNumber')} placeholder="Customer PO" style={cell} />
      </div>
      <input value={form.jobStatusComment} onChange={set('jobStatusComment')} placeholder="Status comment — what the customer needs to hear" style={{ ...cell, marginTop: 7 }} />
      <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Invoice notes — printed on the invoice" style={{ ...cell, marginTop: 7, resize: 'vertical', fontFamily: 'Figtree, sans-serif' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
        <span onClick={() => setEditing(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}>Cancel</span>
        <span onClick={() => { onSave(form); setEditing(false); }} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>Save details</span>
      </div>
    </div>
  );
}

/**
 * Line editor — the working half of Workshop Software's invoice screen.
 *
 * Their grid is Product · Description · Hours · Unit Price · Qty · Unit Cost ·
 * GST · Line Total. This keeps the columns a workshop actually prices with and
 * drops the ones only their back office uses. Unit price is entered INC GST,
 * because that is the number quoted over the counter; GST per line is shown,
 * not typed, so it can never be entered wrong.
 *
 * Nothing is written until Save, so a half-finished edit can be walked away
 * from without touching the invoice.
 */
const GRID = '1fr 46px 84px 58px 52px 62px 26px';

function LineEditor({ invoice, onSave, onCancel }) {
  const [rows, setRows] = useState(() => {
    const start = invoiceTotals(invoice).items.map((l) => ({
      code: l.code, desc: l.desc, qty: l.qty || 1, price: l.price, discount: l.discount || 0, taxFree: l.taxFree,
    }));
    return start.length ? start : [{ code: '', desc: '', qty: 1, price: 0, discount: 0, taxFree: false }];
  });
  const [error, setError] = useState('');

  const set = (n, k) => (e) => {
    const v = k === 'taxFree' ? !rows[n].taxFree : e.target.value;
    setRows((r) => r.map((row, i) => (i === n ? { ...row, [k]: v } : row)));
    setError('');
  };
  const addRow = () => setRows((r) => [...r, { code: '', desc: '', qty: 1, price: 0, discount: 0, taxFree: false }]);
  const dropRow = (n) => setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== n) : r));

  const totals = rows.map((r) => lineTotal(r));
  const newAmount = totals.reduce((a, t) => a + t, 0);
  const received = paidTotal(invoice);

  const save = () => {
    const result = onSave(rows);
    if (result && result.ok === false) setError(result.error);
  };

  const cell = { ...inp, padding: '7px 9px', fontSize: 12, borderRadius: 8 };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 6, paddingBottom: 6 }}>
        {['ITEM', 'QTY', 'UNIT INC', 'DISC %', 'GST', 'TOTAL', ''].map((h, i) => (
          <span key={h + i} className="fg" style={{ fontSize: 9, letterSpacing: '.05em', color: 'var(--text-mute2)', fontWeight: 700, textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
        ))}
      </div>
      {rows.map((r, n) => {
        const t = totals[n];
        return (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input value={r.desc} onChange={set(n, 'desc')} placeholder="Description" style={cell} />
            <input value={r.qty} onChange={set(n, 'qty')} inputMode="decimal" style={{ ...cell, textAlign: 'right' }} />
            <input value={r.price} onChange={set(n, 'price')} inputMode="decimal" style={{ ...cell, textAlign: 'right' }} />
            <input value={r.discount} onChange={set(n, 'discount')} inputMode="decimal" style={{ ...cell, textAlign: 'right' }} />
            {/* Tap the GST cell to make the line tax free — a rego transfer or
                a government charge carries no GST and must not be taxed. */}
            <span onClick={set(n, 'taxFree')} className="fg" title="Tap to toggle tax free"
              style={{ fontSize: 11, fontWeight: 700, textAlign: 'right', cursor: 'pointer', color: r.taxFree ? 'var(--text-mute2)' : 'var(--text-soft)' }}>
              {r.taxFree ? 'FREE' : fmt(t - t / 1.1).replace('$', '')}
            </span>
            <span className="fg" style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--text)' }}>{fmt(t)}</span>
            <span onClick={() => dropRow(n)} className="fg" style={{ fontSize: 15, color: 'var(--text-mute2)', cursor: 'pointer', textAlign: 'center' }}>&times;</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <span onClick={addRow} className="fg" style={{ fontSize: 12, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>+ Add line</span>
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>New total</span>
        <span className="cap" style={{ fontSize: 20, color: 'var(--text)' }}>{fmt(newAmount)}</span>
      </div>
      {received > 0 && (
        <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', marginTop: 6, textAlign: 'right' }}>
          {fmt(received)} already received &middot; balance would be {fmt(Math.max(0, newAmount - received))}
        </div>
      )}
      {error && <div className="fg" style={{ fontSize: 11.5, color: '#c67139', marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <span onClick={onCancel} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}>Cancel</span>
        <span onClick={save} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>Save lines</span>
      </div>
    </div>
  );
}

export function Invoices() {
  const { invoices, flash, recordPayment, updateInvoiceLines, updateInvoiceDetails, addInvoice } = useStore();
  const { org } = useAuth();
  const [openId, setOpenId] = useState(null);
  const [method, setMethod] = useState('Card');
  const [creating, setCreating] = useState(false);
  const [notifyNote, setNotifyNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [editingLines, setEditingLines] = useState(false);

  const open = invoices.find((i) => i.id === openId) || null;
  const due = open ? balanceDue(open) : 0;
  const received = open ? paidTotal(open) : 0;
  const money = open ? invoiceTotals(open) : { items: [], exact: true, exGst: 0, gst: 0, total: 0 };
  const isSettledInvoice = !!open && due <= 0.005;
  // Receivables, not a count of unpaid invoices: an invoice with a deposit
  // against it is only outstanding for what's still owed on it.
  const outstanding = invoices.reduce((s, i) => s + balanceDue(i), 0);
  const downloadPdf = () => open && generateInvoicePdf(open, org);

  const openInvoice = (inv) => {
    setMethod('Card');
    setNotifyNote('');
    setPayAmount('');
    setEditingLines(false);
    setOpenId(inv.id);
  };

  // Blank amount means "settle it" — the common case at the counter. Anything
  // less is a part payment or a deposit and the invoice stays open for the rest.
  const takePayment = () => {
    const typed = parseFloat(payAmount);
    const amount = Number.isFinite(typed) && typed > 0 ? Math.min(typed, due) : due;
    if (amount <= 0) return;
    const saved = recordPayment(openId, { amount, method });
    setPayAmount('');
    if (saved && balanceDue(saved) <= 0.005) setOpenId(null);
  };

  // One write, not two: the Zeller charge lands as a ledger row carrying its
  // own transaction id, and the receipt link rides along on the invoice.
  const onZellerPaid = (meta) => {
    recordPayment(openId, { amount: meta.amount ?? due, method: 'Card', ref: meta.transactionUuid, note: 'Zeller Terminal' }, meta);
    setOpenId(null);
  };

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{invoices.length} total</span>
        <span className="fg" style={{ color: '#c67139', fontSize: 13, fontWeight: 700 }}>{fmt(outstanding)} outstanding</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New invoice</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 720 }}>
          {['INVOICE', 'CUSTOMER', 'TERMS', 'DUE BY', 'STATUS', 'AMOUNT', 'BALANCE', ''].map((h, i) => (
            <span key={i} className="fg" style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)', fontWeight: 700, textAlign: i === 5 || i === 6 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {invoices.map((inv) => (
          <div key={inv.id} onClick={() => openInvoice(inv)}
            style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', cursor: 'pointer', minWidth: 720 }}>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{inv.id}</span>
            <span className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{inv.customer}</span>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{inv.terms}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{inv.dueBy}</span>
            <StatusPill status={displayStatus(inv)} style={{ justifySelf: 'start' }} />
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{fmt(inv.amount)}</span>
            <span className="fg" style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: balanceDue(inv) > 0.005 ? '#c67139' : 'var(--text-mute2)' }}>{fmt(balanceDue(inv))}</span>
            {inv.id === flash ? <Tag>NEW</Tag> : inv.creditHold ? <Tag tone="hold">CREDIT HOLD</Tag> : inv.fromJob ? <Tag>SYNCED FROM JOB</Tag> : inv.onAccount ? <Tag>ON ACCOUNT</Tag> : <span />}
          </div>
        ))}
      </div>

      {open && (
        <div onClick={() => setOpenId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 26, width: 440, overflow: 'hidden', boxShadow: '0 24px 60px rgba(32,30,29,.3)' }}>
            {/* Dark header band */}
            <div style={{ background: 'var(--ink)', padding: '22px 30px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#c67139', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="cap" style={{ color: '#fff', fontSize: 16 }}>$</span></div>
                <div>
                  <div className="cap" style={{ color: '#f5ead8', fontSize: 20 }}>{open.id}</div>
                  <div className="fg" style={{ color: '#a49a8c', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{open.customer} · {open.job} · {open.terms}{open.orderNumber ? ` · PO ${open.orderNumber}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
                <StatusPill status={displayStatus(open)} />
                {/* Balance Due sits at the top of the invoice, the way Workshop
                    Software does it — the number the person at the counter
                    actually needs is never buried below a total. */}
                <div style={{ textAlign: 'right' }}>
                  <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: '#a49a8c', fontWeight: 700 }}>BALANCE DUE</div>
                  <div className="cap" style={{ fontSize: 20, color: due > 0.005 ? '#e08a4a' : '#9fb07a', lineHeight: 1.2 }}>{fmt(due)}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '22px 30px 28px' }}>
              {!editingLines && <VehicleJobPanel invoice={open} onSave={(patch) => updateInvoiceDetails(openId, patch)} />}

              {/* What the money was actually for. Invoices raised from a job
                  card carry the parts and labour; imported ones carry whatever
                  line detail came across with them. Older invoices have none,
                  so this section simply doesn't render for them. */}
              {editingLines ? (
                <LineEditor
                  invoice={open}
                  onCancel={() => setEditingLines(false)}
                  onSave={(rows) => {
                    const result = updateInvoiceLines(openId, rows);
                    if (result.ok) setEditingLines(false);
                    return result;
                  }}
                />
              ) : (
                <>
              {money.items.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 74px 66px 78px', gap: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-c)' }}>
                    {['ITEM', 'QTY', 'UNIT', 'GST', 'TOTAL'].map((h, i) => (
                      <span key={h} className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
                    ))}
                  </div>
                  {money.items.map((l, n) => (
                    <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 42px 74px 66px 78px', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border-c)', alignItems: 'baseline' }}>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{l.desc}</span>
                      <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600, textAlign: 'right' }}>{l.qty || ''}</span>
                      <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600, textAlign: 'right' }}>{fmt(l.price)}</span>
                      <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600, textAlign: 'right' }}>{l.taxFree ? '—' : fmt(l.gst)}</span>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{fmt(l.total)}</span>
                    </div>
                  ))}
                  {/* Said out loud rather than hidden: if the lines don't add
                      up to the invoice, the GST column is an estimate. */}
                  {!money.exact && (
                    <div className="fg" style={{ fontSize: 11, color: '#c67139', marginTop: 8 }}>
                      Lines don&rsquo;t reconcile to the invoice total — GST shown per line is estimated at 1/11.
                    </div>
                  )}
                </div>
              )}
              {/* Work the invoice, don't just look at it. Settled invoices stay
                  locked — changing what a customer has already paid for is a
                  credit note, not an edit. */}
              {!isSettledInvoice && (
                <div style={{ marginBottom: 18 }}>
                  <span onClick={() => setEditingLines(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>
                    {money.items.length > 0 ? 'Edit lines' : '+ Add line items'}
                  </span>
                </div>
              )}
                </>
              )}

              {/* GST breakdown */}
              <div style={{ background: 'var(--panel-bg)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>Subtotal (ex GST)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(money.exGst)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>GST (10%)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(money.gst)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-c)', paddingTop: 9, marginTop: 2 }}>
                  <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Invoice total (inc GST)</span><span className="cap" style={{ fontSize: 26, color: 'var(--text)' }}>{fmt(open.amount)}</span>
                </div>
                {received > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>Received</span><span className="fg" style={{ fontSize: 12.5, color: '#7a8a5e', fontWeight: 700 }}>&minus;{fmt(received)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-c)', paddingTop: 9 }}>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Balance due</span><span className="cap" style={{ fontSize: 22, color: due > 0.005 ? '#c67139' : '#7a8a5e' }}>{fmt(due)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* The payments ledger. A deposit is the first row, an applied
                  account credit is a row with no money attached, and the
                  balance above is always just the total minus this list. */}
              {paymentsOf(open).length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="fg" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 8 }}>PAYMENTS</div>
                  {paymentsOf(open).map((pmt) => (
                    <div key={pmt.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border-c)' }}>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', flex: 1 }}>{fmtDate(pmt.date)} &middot; {pmt.method}{pmt.note ? ` · ${pmt.note}` : ''}</span>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, minWidth: 76, textAlign: 'right' }}>{fmt(pmt.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {open.paidVia === 'zeller' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>Paid via Zeller Terminal {open.zellerTransactionUuid ? `· ${open.zellerTransactionUuid.slice(0, 8)}` : ''}</span>
                  {open.zellerReceiptLink && <a href={open.zellerReceiptLink} target="_blank" rel="noreferrer" className="fg" style={{ fontSize: 12, fontWeight: 700, color: '#c67139' }}>Receipt</a>}
                </div>
              )}

              {open.creditHold && (
                <div style={{ background: 'var(--ink)', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c67139', flexShrink: 0 }} />
                  <span className="fg" style={{ fontSize: 12, color: '#f5ead8', fontWeight: 600, flex: 1 }}>Account on credit hold — past {open.terms} terms. New work needs approval before booking.</span>
                </div>
              )}

              {due > 0.005 && (
                <>
                  <div className="fg" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 8 }}>TAKE PAYMENT</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {PAYMENT_METHODS.map((m) => <MethodTab key={m} label={m === 'Credit' ? 'Account credit' : m} active={method === m} onClick={() => setMethod(m)} />)}
                  </div>
                  {/* Leave it blank to settle the invoice; type less to take a
                      deposit or a part payment and leave the rest open. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal"
                      placeholder={`Amount — blank pays the full ${fmt(due)}`} style={{ ...inp, flex: 1 }} />
                  </div>
                </>
              )}

              {method === 'Bank transfer' && (
                <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
                  {[['Bank', 'Zeller Australia'], ['BSB', '803-439'], ['Account number', '242373674'], ['Reference', open.id]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{k}</span><span className="fg" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{v}</span></div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {notifyNote && <span className="fg" style={{ fontSize: 11.5, color: '#c67139', flexBasis: '100%', textAlign: 'right' }}>{notifyNote}</span>}
                {['Notify · SMS', 'Notify · Email'].map((l) => (
                  <span key={l} className="fg" onClick={() => setNotifyNote(`${l.split(' · ')[1]} sending isn't wired up yet — needs a provider set up first.`)}
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mute)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'not-allowed', opacity: 0.6 }}>{l}</span>
                ))}
                <span className="fg" onClick={downloadPdf} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Download PDF</span>
                <span className="fg" onClick={() => setOpenId(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
                {due > 0.005 && method === 'Card' && !parseFloat(payAmount) && <ZellerCharge invoice={open} amount={due} onPaid={onZellerPaid} />}
                {due > 0.005 && (method !== 'Card' || parseFloat(payAmount) > 0) && (
                  <span className="fg" onClick={takePayment} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>
                    {parseFloat(payAmount) > 0 && parseFloat(payAmount) < due ? `Record ${fmt(Math.min(parseFloat(payAmount), due))}` : 'Mark as paid'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {creating && <NewInvoiceModal onClose={() => setCreating(false)} onCreate={(form) => { addInvoice(form); setCreating(false); }} />}
    </div>
  );
}
