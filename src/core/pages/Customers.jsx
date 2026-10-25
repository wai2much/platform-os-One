import { useState } from 'react';
import { useStore, fmt } from '@/core/store';
import { TERMS, DEFAULT_TERMS, termsLabel } from '@/lib/terms';

/**
 * Customers — core screen (generic to any business). Searchable table +
 * detail modal, backed by the store's real customers table (see
 * supabase/schema.sql Phase 2). "+ New customer" opens a real create form.
 */
const STATUS = {
  Regular: { color: 'var(--ink-2)', bg: 'rgba(72,72,74,.16)' },
  Overdue: { color: 'var(--ink-text)', bg: 'var(--ink)' },
  'Credit hold': { color: 'var(--ink-text)', bg: 'var(--text)' },
  'Store credit': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const AVATAR_COLORS = ['#111111', '#3a3a3c', '#6e6e73', '#48484a', '#86868b', '#1d1d1f'];
const initialsOf = (name) => (name || '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const colorFor = (id) => AVATAR_COLORS[[...String(id)].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const COLS = '1.3fr .9fr .9fr .8fr .9fr';
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function StatusPill({ status, extra }) {
  const s = STATUS[status] ?? STATUS.Regular;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, ...extra }}>{status}</span>;
}

function NewCustomerModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicle: '', status: 'Regular', accountType: 'cash', defaultTerms: DEFAULT_TERMS, creditLimit: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New customer</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="Name" style={inp} />
          <input value={form.phone} onChange={set('phone')} placeholder="Phone" style={inp} />
          <input value={form.email} onChange={set('email')} placeholder="Email" type="email" style={inp} />
          <input value={form.vehicle} onChange={set('vehicle')} placeholder="Vehicle" style={inp} />
          <select value={form.status} onChange={set('status')} style={inp}>
            {Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Billing. An account customer's invoices inherit these terms and
              go out "on account" rather than due on the spot. */}
          <select value={form.accountType}
            onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value, defaultTerms: e.target.value === 'account' && f.defaultTerms === 'DUE_ON_RECEIPT' ? 'NET_30' : f.defaultTerms }))}
            style={inp}>
            <option value="cash">Cash customer</option>
            <option value="account">Account customer</option>
          </select>
          {form.accountType === 'account' && (
            <>
              <select value={form.defaultTerms} onChange={set('defaultTerms')} style={inp}>
                {TERMS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
              <input value={form.creditLimit} onChange={set('creditLimit')} inputMode="decimal" placeholder="Credit limit ($, optional)" style={inp} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <span className="fg" onClick={() => form.name.trim() && onCreate(form)}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-text)', background: form.name.trim() ? 'var(--ink)' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 18px', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>
            Add customer
          </span>
          <span className="fg" onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
        </div>
      </div>
    </div>
  );
}

export function Customers() {
  const { customers, addCustomer } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);

  const term = q.trim().toLowerCase();
  const rows = customers.filter((c) =>
    !term || [c.name, c.phone, c.email, c.vehicle].some((v) => (v || '').toLowerCase().includes(term))
  );

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{customers.length} total</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, vehicle…"
          style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontFamily: 'Inter, sans-serif', color: 'var(--text)', outline: 'none', width: 220 }} />
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: 'var(--ink)', color: 'var(--ink-text)', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New customer</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(17,17,17,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 640 }}>
          {['CUSTOMER', 'VEHICLE', 'LAST VISIT', 'STATUS', 'LIFETIME SPEND'].map((h, i) => (
            <span key={h} className="fg" style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)', fontWeight: 700, textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {rows.map((c) => (
          <div key={c.id} onClick={() => setOpen(c)}
            style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', minWidth: 640, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(c.id), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="fg" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-text)' }}>{initialsOf(c.name)}</span>
              </div>
              <div>
                <div className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{c.name}</div>
                <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{c.phone}</div>
              </div>
            </div>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{c.vehicle}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{c.lastVisit || '—'}</span>
            <StatusPill status={c.status} extra={{ justifySelf: 'start' }} />
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{fmt(c.spend)}</span>
          </div>
        ))}
        {!rows.length && <div className="fg" style={{ padding: 20, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No matches</div>}
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 460, maxHeight: '78vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: colorFor(open.id), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="fg" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-text)' }}>{initialsOf(open.name)}</span>
              </div>
              <div>
                <div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{open.name}</div>
                <div className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>{open.phone}{open.email ? ` · ${open.email}` : ''} · {open.vehicle}</div>
              </div>
              <span style={{ flex: 1 }} />
              <StatusPill status={open.status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: 13 }}><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 700 }}>LIFETIME SPEND</div><div className="cap" style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{fmt(open.spend)}</div></div>
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: 13 }}><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 700 }}>LAST VISIT</div><div className="cap" style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{open.lastVisit || '—'}</div></div>
            </div>
            {open.accountType === 'account' && (
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: '11px 13px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 700 }}>ACCOUNT</span>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>On account · {termsLabel(open.defaultTerms)}{open.creditLimit ? ` · limit ${fmt(Number(open.creditLimit))}` : ''}</span>
              </div>
            )}
            <div className="cap" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Job history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {open.jobHistory.length ? open.jobHistory.map((jh, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
                  <div><div className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{jh.service}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', marginTop: 2 }}>{jh.date}</div></div>
                  <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>{jh.total}</span>
                </div>
              )) : <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>No jobs yet.</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {/* A real tel: link — hands off to whatever the machine uses to
                  dial. Was a button that did nothing at all. */}
              {open.phone ? (
                <a href={`tel:${String(open.phone).replace(/\s/g, '')}`} className="fg" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-text)', background: 'var(--ink)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer', textDecoration: 'none' }}>Call {open.phone}</a>
              ) : (
                <span className="fg" title="No phone number on this customer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mute2)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'not-allowed', opacity: .55 }}>No phone number</span>
              )}
              <span className="fg" onClick={() => setOpen(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <NewCustomerModal onClose={() => setCreating(false)} onCreate={(form) => { addCustomer(form); setCreating(false); }} />
      )}
    </div>
  );
}
