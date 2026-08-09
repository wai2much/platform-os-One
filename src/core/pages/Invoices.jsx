import { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useTerminal } from '@/lib/zeller';

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
  'On account': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const COLS = '1fr 1.2fr .8fr .8fr .8fr .8fr .8fr';

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
function ZellerCharge({ invoice, onPaid }) {
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
    const result = await terminal.purchase({ amount: Math.round(invoice.amount * 100), reference: invoice.id });
    if (result instanceof Error) {
      setState('ready');
      setNote(result.type === 'Cancelled' ? 'Cancelled on the Terminal.' : `${result.type} — try again.`);
      return;
    }
    onPaid({ paidVia: 'zeller', transactionUuid: result.transactionUuid, receiptLink: result.receiptLink, status: result.status });
  };

  return (
    <div>
      {state === 'checking' && <span style={btnDisabled}>Checking Zeller Terminal…</span>}
      {state === 'setup_required' && <span onClick={pair} className="fg" style={btn}>Pair Zeller Terminal</span>}
      {state === 'ready' && <span onClick={charge} className="fg" style={btn}>Charge {fmt(invoice.amount)} with Zeller</span>}
      {state === 'charging' && <span style={btnDisabled}>Waiting for tap on Terminal…</span>}
      {note && <div className="fg" style={{ fontSize: 11.5, color: '#c67139', marginTop: 6, textAlign: 'right' }}>{note}</div>}
    </div>
  );
}

function NewInvoiceModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ customer: '', terms: 'Due on receipt', dueBy: 'Today', amount: '' });
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

export function Invoices() {
  const { invoices, flash, markInvoicePaid, addInvoice } = useStore();
  const [openId, setOpenId] = useState(null);
  const [method, setMethod] = useState('Card');
  const [creating, setCreating] = useState(false);

  const open = invoices.find((i) => i.id === openId) || null;
  const outstanding = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0);

  const markPaid = () => {
    markInvoicePaid(openId);
    setOpenId(null);
  };

  const onZellerPaid = (meta) => {
    markInvoicePaid(openId, meta);
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
          {['INVOICE', 'CUSTOMER', 'TERMS', 'DUE BY', 'STATUS', 'AMOUNT', ''].map((h, i) => (
            <span key={i} className="fg" style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)', fontWeight: 700, textAlign: i === 5 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {invoices.map((inv) => (
          <div key={inv.id} onClick={() => { setMethod('Card'); setOpenId(inv.id); }}
            style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', cursor: 'pointer', minWidth: 720 }}>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{inv.id}</span>
            <span className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{inv.customer}</span>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{inv.terms}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{inv.dueBy}</span>
            <StatusPill status={inv.status} style={{ justifySelf: 'start' }} />
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{fmt(inv.amount)}</span>
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
                  <div className="fg" style={{ color: '#a49a8c', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{open.customer} · {open.job} · {open.terms}</div>
                </div>
              </div>
              <StatusPill status={open.status} style={{ flexShrink: 0 }} />
            </div>

            <div style={{ padding: '22px 30px 28px' }}>
              {/* GST breakdown */}
              <div style={{ background: 'var(--panel-bg)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>Subtotal (ex GST)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(open.amount / 1.1)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>GST (10%)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(open.amount - open.amount / 1.1)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-c)', paddingTop: 9, marginTop: 2 }}>
                  <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Total due (inc GST)</span><span className="cap" style={{ fontSize: 26, color: 'var(--text)' }}>{fmt(open.amount)}</span>
                </div>
              </div>

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

              <div className="fg" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 8 }}>PAYMENT METHOD</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['Card', 'Cash', 'Bank transfer'].map((m) => <MethodTab key={m} label={m} active={method === m} onClick={() => setMethod(m)} />)}
              </div>

              {method === 'Bank transfer' && (
                <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
                  {[['Bank', 'Zeller Australia'], ['BSB', '803-439'], ['Account number', '242373674'], ['Reference', open.id]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{k}</span><span className="fg" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{v}</span></div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                {['Notify · SMS', 'Notify · Email', 'Download PDF'].map((l) => (
                  <span key={l} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>{l}</span>
                ))}
                <span className="fg" onClick={() => setOpenId(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
                {open.status !== 'Paid' && method === 'Card' && <ZellerCharge invoice={open} onPaid={onZellerPaid} />}
                {open.status !== 'Paid' && method !== 'Card' && <span className="fg" onClick={markPaid} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Mark as paid</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {creating && <NewInvoiceModal onClose={() => setCreating(false)} onCreate={(form) => { addInvoice(form); setCreating(false); }} />}
    </div>
  );
}
