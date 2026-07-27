import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Customers — core screen (generic to any business). Searchable table +
 * detail modal, backed by the store's real customers table (see
 * supabase/schema.sql Phase 2). "+ New customer" opens a real create form.
 */
const STATUS = {
  Regular: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Overdue: { color: '#fff', bg: '#c67139' },
  'Credit hold': { color: '#fff', bg: '#201e1d' },
  'Store credit': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const AVATAR_COLORS = ['#201e1d', '#7a8a5e', '#8a4f24', '#a8926f', '#6b3a22', '#c67139'];
const initialsOf = (name) => (name || '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const colorFor = (id) => AVATAR_COLORS[[...String(id)].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const COLS = '1.3fr .9fr .9fr .8fr .9fr';
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function StatusPill({ status, extra }) {
  const s = STATUS[status] ?? STATUS.Regular;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, ...extra }}>{status}</span>;
}

function NewCustomerModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicle: '', status: 'Regular' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
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
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <span className="fg" onClick={() => form.name.trim() && onCreate(form)}
            style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.name.trim() ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 18px', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>
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
          style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: 220 }} />
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New customer</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
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
                <span className="fg" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{initialsOf(c.name)}</span>
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
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 460, maxHeight: '78vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: colorFor(open.id), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="fg" style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{initialsOf(open.name)}</span>
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
              <span className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Call</span>
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
