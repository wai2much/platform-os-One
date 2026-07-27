import { useState } from 'react';
import { useStore } from '@/core/store';

/**
 * Vehicles — workshop pack. Searchable register + detail modal, backed by
 * the store's real vehicles table (see supabase/schema.sql Phase 2).
 * "+ New vehicle" opens a real create form.
 */
const STATUS = {
  Serviced: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  'Due soon': { color: '#fff', bg: '#c67139' },
  Overdue: { color: '#fff', bg: '#201e1d' },
};

const COLS = '1.2fr 1fr 1fr .9fr .8fr';
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function StatusPill({ status }) {
  const s = STATUS[status] ?? STATUS.Serviced;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, justifySelf: 'start' }}>{status}</span>;
}

function NewVehicleModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ model: '', rego: '', owner: '', odo: '', status: 'Serviced' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New vehicle</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.model} onChange={set('model')} placeholder="Model (e.g. Ford Ranger)" style={inp} />
          <input value={form.rego} onChange={set('rego')} placeholder="Rego" style={inp} />
          <input value={form.owner} onChange={set('owner')} placeholder="Owner" style={inp} />
          <input value={form.odo} onChange={set('odo')} placeholder="Odometer (e.g. 42,000 km)" style={inp} />
          <select value={form.status} onChange={set('status')} style={inp}>
            {Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <span className="fg" onClick={() => form.model.trim() && onCreate(form)}
            style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.model.trim() ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 18px', cursor: form.model.trim() ? 'pointer' : 'not-allowed' }}>
            Add vehicle
          </span>
          <span className="fg" onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
        </div>
      </div>
    </div>
  );
}

export function Vehicles() {
  const { vehicles, addVehicle } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);

  const term = q.trim().toLowerCase();
  const rows = vehicles.filter((v) => !term || [v.model, v.rego, v.owner].some((x) => (x || '').toLowerCase().includes(term)));

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{vehicles.length} total</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rego, model, owner…" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: 220 }} />
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New vehicle</span>
      </div>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 640 }}>
          {['VEHICLE', 'OWNER', 'ODOMETER', 'LAST SERVICE', 'STATUS'].map((h) => <span key={h} className="fg" style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {rows.map((v) => (
          <div key={v.id} onClick={() => setOpen(v)} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', minWidth: 640, cursor: 'pointer' }}>
            <div><div className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{v.model}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{v.rego}</div></div>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{v.owner}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{v.odo || '—'}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{v.lastService || '—'}</span>
            <StatusPill status={v.status} />
          </div>
        ))}
        {!rows.length && <div className="fg" style={{ padding: 20, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No matches</div>}
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 460, maxHeight: '78vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <span className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{open.model}</span>
              <StatusPill status={open.status} />
            </div>
            <div className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600, marginBottom: 16 }}>{open.rego} · {open.owner}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: 13 }}><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 700 }}>ODOMETER</div><div className="cap" style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{open.odo || '—'}</div></div>
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: 13 }}><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 700 }}>NEXT SERVICE DUE</div><div className="cap" style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{open.nextDue || '—'}</div></div>
            </div>
            <div className="cap" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Service history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {open.history.length ? open.history.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
                  <div><div className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{h.service}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', marginTop: 2 }}>{h.date}</div></div>
                  <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>{h.total}</span>
                </div>
              )) : <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>No service history yet.</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <span onClick={() => setOpen(null)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <NewVehicleModal onClose={() => setCreating(false)} onCreate={(form) => { addVehicle(form); setCreating(false); }} />
      )}
    </div>
  );
}
