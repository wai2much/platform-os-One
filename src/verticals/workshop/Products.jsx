import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Products — workshop pack. Non-tyre parts & consumables only — tyres have
 * their own dedicated Tyre Stock screen. Backed by the store's real parts
 * table (see supabase/schema.sql Phase 6).
 */
const STATUS = {
  'In stock': { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Low: { color: '#fff', bg: '#c67139' },
  Ordered: { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function NewPartModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', size: '', stock: '', price: '', status: 'In stock' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New product</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="Name" style={inp} />
          <input value={form.size} onChange={set('size')} placeholder="Size (e.g. 5L, Each, Set)" style={inp} />
          <input value={form.stock} onChange={set('stock')} inputMode="numeric" placeholder="Stock qty" style={inp} />
          <input value={form.price} onChange={set('price')} inputMode="decimal" placeholder="Price ($)" style={inp} />
          <select value={form.status} onChange={set('status')} style={inp}>
            {Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <span onClick={onClose} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
          <span onClick={() => form.name.trim() && onCreate(form)} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.name.trim() ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 20px', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>Add product</span>
        </div>
      </div>
    </div>
  );
}

export function Products() {
  const { setActive, parts, addPart, suppliers } = useStore();
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{parts.length} total</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New product</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {parts.map((p) => {
          const s = STATUS[p.status] ?? STATUS['In stock'];
          return (
            <div key={p.id} style={{ background: 'var(--card-bg)', borderRadius: 18, padding: 16, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--panel-bg)', flexShrink: 0 }} />
                <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 9px' }}>{p.status}</span>
              </div>
              <div><div className="fg" style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>{p.size}</div></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-c)', paddingTop: 10 }}>
                <div><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 600 }}>STOCK</div><div className="cap" style={{ fontSize: 17, color: 'var(--text)', marginTop: 2 }}>{p.stock}</div></div>
                <div><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 600, textAlign: 'right' }}>PRICE</div><div className="cap" style={{ fontSize: 17, color: 'var(--text)', marginTop: 2 }}>{fmt(p.price)}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 }}>
          <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Suppliers</span>
          <span onClick={() => setActive('suppliers')} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>View all →</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {suppliers.slice(0, 5).map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
              <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{s.name}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>{s.suburb}</div></div>
            </div>
          ))}
          {!suppliers.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)' }}>No suppliers yet.</div>}
        </div>
      </div>

      {creating && <NewPartModal onClose={() => setCreating(false)} onCreate={(form) => { addPart(form); setCreating(false); }} />}
    </div>
  );
}
