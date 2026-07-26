import { useState } from 'react';

/**
 * Jobs — core screen. Faithful to the prototype's jobs table, plus a detail
 * modal (line items + GST). Sample data; a job's total is GST-inclusive
 * (ex-GST = total / 1.1), matching the Invoices/engine convention.
 */
const fmt = (n) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS = {
  'In progress': { color: '#c67139', bg: 'rgba(198,113,57,.15)' },
  Ready: { color: '#fff', bg: '#7a8a5e' },
  'Awaiting approval': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
  Completed: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Booked: { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const JOBS = [
  { id: 'J-0412', customer: 'T. Nguyen', vehicle: 'Ford Ranger', tech: 'Sam', status: 'In progress', total: 1364,
    lines: [['Major service', 1, 420], ['Front brake pads + rotors', 1, 690], ['Wheel alignment', 1, 130]] },
  { id: 'J-0418', customer: 'A. Costa', vehicle: 'Audi A4', tech: 'Dean', status: 'Ready', total: 759,
    lines: [['Service B', 1, 560], ['Cabin filter', 1, 79]] },
  { id: 'J-0409', customer: 'M. Petrakis', vehicle: 'VW Golf GTI', tech: 'Sam', status: 'Awaiting approval', total: 594,
    lines: [['Diagnostic scan', 1, 150], ['Ignition coil pack', 1, 390]] },
  { id: 'J-0421', customer: 'S. Bianchi', vehicle: 'Mini Cooper S', tech: 'Anthony', status: 'Completed', total: 462,
    lines: [['Logbook service', 1, 420]] },
  { id: 'J-0424', customer: 'L. Farrow', vehicle: 'Toyota Hilux', tech: 'Dean', status: 'Booked', total: 0, lines: [] },
];

const COLS = '80px 1.3fr 1.1fr .8fr .9fr .7fr';

function StatusPill({ status, style }) {
  const s = STATUS[status] ?? STATUS.Booked;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, ...style }}>{status}</span>;
}

export function Jobs() {
  const [open, setOpen] = useState(null);

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{JOBS.length} total</span>
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New job</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', background: 'var(--panel-bg)', minWidth: 640 }}>
          {['JOB', 'CUSTOMER', 'VEHICLE', 'TECH', 'STATUS', 'TOTAL'].map((h, i) => (
            <span key={h} className="fg" style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--text-mute)', fontWeight: 700, textAlign: i === 5 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {JOBS.map((j) => (
          <div key={j.id} onClick={() => setOpen(j)} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-c)', alignItems: 'center', cursor: 'pointer', minWidth: 640 }}>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>{j.id}</span>
            <span className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{j.customer}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{j.vehicle}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{j.tech}</span>
            <StatusPill status={j.status} style={{ justifySelf: 'start' }} />
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{j.total ? fmt(j.total) : '—'}</span>
          </div>
        ))}
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div>
                <div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{open.id} · {open.customer}</div>
                <div className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>{open.vehicle} · Tech {open.tech}</div>
              </div>
              <span style={{ flex: 1 }} />
              <StatusPill status={open.status} />
            </div>

            {open.lines.length ? (
              <>
                <div style={{ background: 'var(--panel-bg)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 90px', gap: 8, padding: '9px 14px' }}>
                    {['ITEM', 'QTY', 'AMOUNT'].map((h, i) => <span key={h} className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, textAlign: i === 2 ? 'right' : 'left' }}>{h}</span>)}
                  </div>
                  {open.lines.map(([desc, qty, amt], i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 90px', gap: 8, padding: '9px 14px', borderTop: '1px solid var(--border-c)' }}>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{desc}</span>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{qty}</span>
                      <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>Subtotal (ex GST)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(open.total / 1.1)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>GST (10%)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(open.total - open.total / 1.1)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-c)', paddingTop: 7, marginTop: 2 }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Total (inc GST)</span><span className="cap" style={{ fontSize: 22, color: 'var(--text)' }}>{fmt(open.total)}</span></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="fg" style={{ fontSize: 13, color: 'var(--text-mute)', padding: '10px 0 6px' }}>No line items yet — job is booked, not started.</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <span className="fg" onClick={() => setOpen(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
              <span className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Generate invoice</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
