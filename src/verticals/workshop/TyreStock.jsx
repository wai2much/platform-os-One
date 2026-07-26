import { useState } from 'react';
import { fmt } from '@/core/store';

/**
 * Tyre Stock — workshop pack, dedicated to TyrePlus's actual core inventory.
 * Separate from generic Products/Parts: brand, size, load/speed rating,
 * qty on hand (editable inline, like a live stock count), cost/sell ex GST,
 * and a reorder-point-derived status. Real math: margin per tyre, low-stock
 * flag computed from qty vs reorder point (not just a hardcoded label).
 */
const SEED = [
  { brand: 'Bridgestone', model: 'Turanza T005', size: '225/45R17', rating: '94W', qty: 8, cost: 118, sell: 189, reorder: 4 },
  { brand: 'Michelin', model: 'Pilot Sport 4', size: '265/60R18', rating: '110V', qty: 2, cost: 205, sell: 310, reorder: 4 },
  { brand: 'ZMAX', model: 'X-Spider', size: '195/R14C', rating: '106/104Q', qty: 2, cost: 92, sell: 142, reorder: 4 },
  { brand: 'Continental', model: 'CrossContact', size: '225/65R17', rating: '102H', qty: 8, cost: 148, sell: 228, reorder: 4 },
  { brand: 'Bridgestone', model: 'Dueler A/T', size: '265/65R17', rating: '112S', qty: 6, cost: 172, sell: 265, reorder: 4 },
  { brand: 'Michelin', model: 'Primacy 4', size: '205/55R16', rating: '91V', qty: 12, cost: 96, sell: 158, reorder: 4 },
  { brand: 'Yokohama', model: 'BluEarth-GT', size: '215/45R17', rating: '87W', qty: 3, cost: 104, sell: 168, reorder: 4 },
  { brand: 'Continental', model: 'PremiumContact 6', size: '245/40R18', rating: '97Y', qty: 0, cost: 210, sell: 325, reorder: 2 },
];

const COLS = '1fr 1.1fr .9fr .8fr .8fr .8fr .8fr .9fr';

export function TyreStock() {
  const [rows, setRows] = useState(SEED);
  const [q, setQ] = useState('');

  const setQty = (i, v) => setRows((list) => list.map((r, j) => (j === i ? { ...r, qty: Math.max(0, parseInt(v, 10) || 0) } : r)));

  const term = q.trim().toLowerCase();
  const visible = rows
    .map((r, i) => ({ ...r, i }))
    .filter((r) => !term || [r.brand, r.model, r.size].some((x) => x.toLowerCase().includes(term)));

  const lowCount = rows.filter((r) => r.qty <= r.reorder).length;
  const stockValue = rows.reduce((s, r) => s + r.qty * r.cost, 0);

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{rows.reduce((s, r) => s + r.qty, 0)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Tyres on hand</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 24, lineHeight: 1 }}>{lowCount}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>At or below reorder point</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(stockValue)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Stock value (ex GST, at cost)</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{rows.length} tyre lines</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand, model, size…" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: 220 }} />
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New tyre line</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 760 }}>
          {['BRAND / MODEL', 'SIZE', 'LOAD/SPEED', 'QTY', 'COST', 'SELL', 'MARGIN', 'STATUS'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.05em', color: 'var(--text-mute)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {visible.map((r) => {
          const low = r.qty <= r.reorder;
          const margin = r.sell - r.cost;
          return (
            <div key={r.i} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', minWidth: 760 }}>
              <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{r.brand}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{r.model}</div></div>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{r.size}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{r.rating}</span>
              <input value={r.qty} onChange={(e) => setQty(r.i, e.target.value)} inputMode="numeric" style={{ width: 48, background: 'var(--panel-bg)', border: 'none', borderRadius: 8, padding: '6px 9px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{fmt(r.cost)}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{fmt(r.sell)}</span>
              <span className="fg" style={{ fontSize: 12.5, color: '#7a8a5e', fontWeight: 700 }}>{fmt(margin)}</span>
              <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: low ? '#fff' : '#7a8a5e', background: low ? '#c67139' : 'rgba(122,138,94,.16)', borderRadius: 999, padding: '3px 10px', justifySelf: 'start' }}>{r.qty === 0 ? 'Out of stock' : low ? 'Reorder' : 'OK'}</span>
            </div>
          );
        })}
        {!visible.length && <div className="fg" style={{ padding: 20, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No matches</div>}
      </div>
    </div>
  );
}
