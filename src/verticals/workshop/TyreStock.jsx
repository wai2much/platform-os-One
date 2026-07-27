import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Tyre Stock — workshop pack, dedicated to TyrePlus's actual core inventory.
 * Backed by the store's real tyre_stock table (see supabase/schema.sql
 * Phase 6) — qty edits and new lines persist instead of resetting on
 * refresh. Real math: margin per tyre, low-stock flag from qty vs reorder.
 */
const COLS = '1fr 1.1fr .9fr .8fr .8fr .8fr .8fr .9fr';
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function NewTyreModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ brand: '', model: '', size: '', rating: '', cost: '', sell: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New tyre line</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.brand} onChange={set('brand')} placeholder="Brand" style={inp} />
          <input value={form.model} onChange={set('model')} placeholder="Model" style={inp} />
          <input value={form.size} onChange={set('size')} placeholder="Size (e.g. 225/45R17)" style={inp} />
          <input value={form.rating} onChange={set('rating')} placeholder="Load/speed rating (e.g. 94W)" style={inp} />
          <input value={form.cost} onChange={set('cost')} inputMode="decimal" placeholder="Cost ex GST ($)" style={inp} />
          <input value={form.sell} onChange={set('sell')} inputMode="decimal" placeholder="Sell ex GST ($)" style={inp} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <span onClick={onClose} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
          <span onClick={() => form.brand.trim() && onCreate(form)} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.brand.trim() ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 20px', cursor: form.brand.trim() ? 'pointer' : 'not-allowed' }}>Add line</span>
        </div>
      </div>
    </div>
  );
}

export function TyreStock() {
  const { tyreStock, setTyreQty, addTyreLine } = useStore();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const term = q.trim().toLowerCase();
  const visible = tyreStock.filter((r) => !term || [r.brand, r.model, r.size].some((x) => (x || '').toLowerCase().includes(term)));

  const lowCount = tyreStock.filter((r) => r.qty <= r.reorder).length;
  const stockValue = tyreStock.reduce((s, r) => s + r.qty * r.cost, 0);

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{tyreStock.reduce((s, r) => s + r.qty, 0)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Tyres on hand</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 24, lineHeight: 1 }}>{lowCount}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>At or below reorder point</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(stockValue)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Stock value (ex GST, at cost)</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{tyreStock.length} tyre lines</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand, model, size…" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: 220 }} />
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New tyre line</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 760 }}>
          {['BRAND / MODEL', 'SIZE', 'LOAD/SPEED', 'QTY', 'COST', 'SELL', 'MARGIN', 'STATUS'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.05em', color: 'var(--text-mute)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {visible.map((r) => {
          const low = r.qty <= r.reorder;
          const margin = r.sell - r.cost;
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', minWidth: 760 }}>
              <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{r.brand}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{r.model}</div></div>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{r.size}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{r.rating}</span>
              <input value={r.qty} onChange={(e) => setTyreQty(r.id, e.target.value)} inputMode="numeric" style={{ width: 48, background: 'var(--panel-bg)', border: 'none', borderRadius: 8, padding: '6px 9px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{fmt(r.cost)}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{fmt(r.sell)}</span>
              <span className="fg" style={{ fontSize: 12.5, color: '#7a8a5e', fontWeight: 700 }}>{fmt(margin)}</span>
              <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: low ? '#fff' : '#7a8a5e', background: low ? '#c67139' : 'rgba(122,138,94,.16)', borderRadius: 999, padding: '3px 10px', justifySelf: 'start' }}>{r.qty === 0 ? 'Out of stock' : low ? 'Reorder' : 'OK'}</span>
            </div>
          );
        })}
        {!visible.length && <div className="fg" style={{ padding: 20, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No matches</div>}
      </div>

      {creating && <NewTyreModal onClose={() => setCreating(false)} onCreate={(form) => { addTyreLine(form); setCreating(false); }} />}
    </div>
  );
}
