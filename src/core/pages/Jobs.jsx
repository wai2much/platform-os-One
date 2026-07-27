import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Jobs — core screen. Reads from the shared store, so jobs created via
 * Bookings → "Start job card" (and completed via "Generate invoice") show up
 * here too — one job list, not a separate sample set. Detail modal is a real
 * line-item editor (add/remove rows), faithful to the prototype's job modal.
 */
const STATUS = {
  'In progress': { color: '#c67139', bg: 'rgba(198,113,57,.15)' },
  Ready: { color: '#fff', bg: '#7a8a5e' },
  'Awaiting approval': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
  Completed: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Booked: { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const COLS = '80px 1.3fr 1.1fr .8fr .9fr .7fr';

function StatusPill({ status, style }) {
  const s = STATUS[status] ?? STATUS.Booked;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, ...style }}>{status}</span>;
}

export function Jobs() {
  const { jobs, saveJobLines, startJobCard } = useStore();
  const [openId, setOpenId] = useState(null);
  const [lines, setLines] = useState([]); // editable draft: [desc, qty, price]

  const open = jobs.find((j) => j.id === openId) || null;
  const total = lines.reduce((s, [, qty, price]) => s + (parseFloat(qty) || 0) * (parseFloat(price) || 0), 0);

  const openJob = (j) => { setOpenId(j.id); setLines(j.lines.length ? j.lines.map(([d, q, amt]) => [d, q, q ? amt / q : amt]) : []); };
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? (k === 0 ? [v, l[1], l[2]] : k === 1 ? [l[0], v, l[2]] : [l[0], l[1], v]) : l)));
  const removeLine = (i) => setLines((ls) => ls.filter((_, j) => j !== i));
  const addLine = () => setLines((ls) => [...ls, ['', 1, 0]]);

  const save = () => {
    const cleanLines = lines.filter(([d]) => d.trim()).map(([d, q, p]) => [d, parseFloat(q) || 1, (parseFloat(q) || 1) * (parseFloat(p) || 0)]);
    const newTotal = cleanLines.reduce((s, [, , amt]) => s + amt, 0);
    saveJobLines(openId, cleanLines, newTotal);
    setOpenId(null);
  };

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{jobs.length} total</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => startJobCard({})} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New job</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 640 }}>
          {['JOB', 'CUSTOMER', 'VEHICLE', 'TECH', 'STATUS', 'TOTAL'].map((h, i) => (
            <span key={h} className="fg" style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)', fontWeight: 700, textAlign: i === 5 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {jobs.map((j) => (
          <div key={j.id} onClick={() => openJob(j)} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', cursor: 'pointer', minWidth: 640 }}>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>{j.id}</span>
            <span className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{j.customer}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{j.vehicle}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{j.tech || '—'}</span>
            <StatusPill status={j.status} style={{ justifySelf: 'start' }} />
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{j.total ? fmt(j.total) : '—'}</span>
          </div>
        ))}
      </div>

      {open && (
        <div onClick={() => setOpenId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 26, width: 460, padding: '28px 30px', boxShadow: '0 24px 60px rgba(32,30,29,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div className="cap" style={{ color: 'var(--text)', fontSize: 22 }}>{open.vehicle}</div>
                <div className="fg" style={{ color: 'var(--text-mute)', fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{open.id} · {open.customer}</div>
              </div>
              <StatusPill status={open.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Technician</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{open.tech || '—'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span className="fg" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>LINE ITEMS</span>
              <span className="fg" onClick={addLine} style={{ fontSize: 12, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>+ Add item</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflow: 'auto' }}>
              {lines.map((li, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr .6fr .8fr .8fr 20px', gap: 8, alignItems: 'center', background: 'var(--panel-bg)', borderRadius: 10, padding: '8px 10px' }}>
                  <input value={li[0]} onChange={(e) => setLine(i, 0, e.target.value)} placeholder="Description" style={{ background: 'transparent', border: 'none', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', padding: 2 }} />
                  <input value={li[1]} onChange={(e) => setLine(i, 1, e.target.value)} inputMode="decimal" style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-c)', fontSize: 12, fontFamily: 'Figtree, sans-serif', color: 'var(--text-soft)', outline: 'none', padding: 2 }} />
                  <input value={li[2]} onChange={(e) => setLine(i, 2, e.target.value)} inputMode="decimal" style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-c)', fontSize: 12, fontFamily: 'Figtree, sans-serif', color: 'var(--text-soft)', outline: 'none', padding: 2 }} />
                  <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{fmt((parseFloat(li[1]) || 0) * (parseFloat(li[2]) || 0))}</span>
                  <span onClick={() => removeLine(i)} className="fg" style={{ fontSize: 14, color: 'var(--text-mute2)', cursor: 'pointer', textAlign: 'center' }}>×</span>
                </div>
              ))}
              {!lines.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)', padding: '8px 0' }}>No line items yet.</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(32,30,29,.12)', marginTop: 12, paddingTop: 12 }}>
              <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>Total</span>
              <span className="cap" style={{ fontSize: 19, color: 'var(--text)' }}>{fmt(total)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <span className="fg" onClick={() => setOpenId(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
              <span className="fg" onClick={save} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Save &amp; open job</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
