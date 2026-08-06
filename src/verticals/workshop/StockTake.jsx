import { useState } from 'react';
import { useStore } from '@/core/store';

/**
 * Stock Take — workshop pack. System-vs-counted reconciliation, backed by
 * the store's real stock_take_items table (see supabase/schema.sql Phase
 * 6) — counts persist instead of resetting on refresh. "Finalize count"
 * stays a local-only toggle (a session action, not data).
 */
export function StockTake() {
  const { stockTakeItems, setStockCount, stockTakeFinalized, setStockTakeFinalized } = useStore();
  const [showReport, setShowReport] = useState(false);

  const counted = stockTakeItems.filter((r) => r.counted !== '');
  const variances = stockTakeItems.map((r) => (r.counted === '' ? null : parseInt(r.counted, 10) - r.systemQty));
  const shortages = variances.filter((v) => v !== null && v < 0).length;
  const overages = variances.filter((v) => v !== null && v > 0).length;
  const netVarianceValue = variances.reduce((s, v) => s + (v || 0), 0);

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{counted.length}/{stockTakeItems.length} counted</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setStockTakeFinalized(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: 'var(--ink)', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>{stockTakeFinalized ? '✓ Finalized' : 'Finalize count'}</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .8fr .8fr .8fr', gap: 12, padding: '14px 20px', minWidth: 600 }}>
          {['ITEM', 'SYSTEM', 'COUNTED', 'VARIANCE', ''].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {stockTakeItems.map((r, i) => {
          const v = variances[i];
          const varColor = v === null ? 'var(--text-mute2)' : v < 0 ? '#c67139' : v > 0 ? '#7a8a5e' : 'var(--text-soft)';
          const varLabel = v === null ? '—' : v > 0 ? `+${v}` : `${v}`;
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .8fr .8fr .8fr', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-c)', alignItems: 'center', minWidth: 600 }}>
              <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{r.name}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{r.systemQty}</span>
              <input value={r.counted} onChange={(e) => setStockCount(r.id, e.target.value.replace(/[^0-9]/g, ''))} disabled={stockTakeFinalized} placeholder="—" style={{ width: 60, background: 'var(--panel-bg)', border: 'none', borderRadius: 8, padding: '6px 9px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
              <span className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: varColor }}>{varLabel}</span>
              <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: v === null ? 'var(--text-mute2)' : '#7a8a5e' }}>{v === null ? 'Pending' : 'Done'}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{shortages}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Items short</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{overages}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Items over</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 24, lineHeight: 1 }}>{netVarianceValue > 0 ? `+${netVarianceValue}` : netVarianceValue}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Net variance (units)</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <span onClick={() => setShowReport(true)} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>Download reconciliation report →</span>
      </div>

      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: '#fbf5e8', zIndex: 100, padding: 48, overflow: 'auto' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ position: 'relative', background: '#a8b58a', color: '#2e3a1e', padding: '26px 32px', margin: '-48px -48px 24px' }}>
              <div className="cap" style={{ fontSize: 24 }}>Stock Take Reconciliation</div>
              <div className="fg" style={{ fontSize: 12.5, color: '#3f4d2a', marginTop: 4 }}>Haus Of Technik Pty. Ltd. · Trading as TyrePlus Thomastown</div>
            </div>
            <div style={{ borderTop: '1px solid #e0dccf', borderBottom: '1px solid #e0dccf' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .8fr .8fr', gap: 12, padding: '10px 0', fontWeight: 700, fontSize: 11, letterSpacing: '.06em', color: '#8a857c' }}><span>ITEM</span><span>SYSTEM</span><span>COUNTED</span><span>VARIANCE</span></div>
              {stockTakeItems.map((r, i) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .8fr .8fr', gap: 12, padding: '9px 0', borderTop: '1px solid #f0ece0', fontSize: 13 }}>
                  <span>{r.name}</span><span>{r.systemQty}</span><span>{r.counted || '—'}</span><span>{variances[i] === null ? '—' : variances[i] > 0 ? `+${variances[i]}` : variances[i]}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 40 }}>
              <div><div className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: '#8a857c', fontWeight: 700, marginBottom: 5 }}>ITEMS SHORT</div><div className="fg" style={{ fontSize: 14, fontWeight: 700 }}>{shortages}</div></div>
              <div><div className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: '#8a857c', fontWeight: 700, marginBottom: 5 }}>ITEMS OVER</div><div className="fg" style={{ fontSize: 14, fontWeight: 700 }}>{overages}</div></div>
              <div><div className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: '#8a857c', fontWeight: 700, marginBottom: 5 }}>NET VARIANCE</div><div className="fg" style={{ fontSize: 14, fontWeight: 700 }}>{netVarianceValue > 0 ? `+${netVarianceValue}` : netVarianceValue} units</div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
              <span onClick={() => window.print()} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}>Print / Save as PDF</span>
              <span onClick={() => setShowReport(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: '#3c3936', border: '1.5px solid rgba(32,30,29,.2)', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Back</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
