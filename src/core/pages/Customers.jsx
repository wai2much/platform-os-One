import { useState } from 'react';

/**
 * Customers — core screen (generic to any business). Faithful to the prototype's
 * searchable table + detail modal. Real search + modal state; sample data for now,
 * to be swapped for the engine's customer records.
 */
const STATUS = {
  Regular: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Overdue: { color: '#fff', bg: '#c67139' },
  'Credit hold': { color: '#fff', bg: '#201e1d' },
  'Store credit': { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const CUSTOMERS = [
  { id: 1, name: 'T. Nguyen', phone: '0412 663 921', initials: 'TN', avatarBg: '#201e1d', vehicle: 'Ford Ranger', lastVisit: '12 Jul', status: 'Credit hold', spend: '$4,820',
    jobHistory: [{ service: 'Major service + brakes', date: '12 Jul 2026', total: '$1,240' }, { service: '4× tyres 265/60R18', date: '3 Mar 2026', total: '$1,690' }] },
  { id: 2, name: 'A. Costa', phone: '0403 118 447', initials: 'AC', avatarBg: '#7a8a5e', vehicle: 'Audi A4', lastVisit: '18 Jul', status: 'Regular', spend: '$8,140',
    jobHistory: [{ service: 'Service B + alignment', date: '18 Jul 2026', total: '$690' }, { service: 'Front rotors + pads', date: '2 Jun 2026', total: '$980' }] },
  { id: 3, name: 'M. Petrakis', phone: '0439 552 108', initials: 'MP', avatarBg: '#8a4f24', vehicle: 'VW Golf GTI', lastVisit: '20 Jul', status: 'Overdue', spend: '$3,260',
    jobHistory: [{ service: 'Diagnostic + coil pack', date: '20 Jul 2026', total: '$540' }] },
  { id: 4, name: 'L. Farrow', phone: '0418 907 233', initials: 'LF', avatarBg: '#a8926f', vehicle: 'Toyota Hilux', lastVisit: '5 Jul', status: 'Store credit', spend: '$6,910',
    jobHistory: [{ service: 'Roadworthy + repairs', date: '5 Jul 2026', total: '$1,120' }, { service: '4× tyres + rotation', date: '10 Jan 2026', total: '$1,480' }] },
  { id: 5, name: 'S. Bianchi', phone: '0421 774 560', initials: 'SB', avatarBg: '#6b3a22', vehicle: 'Mini Cooper S', lastVisit: '22 Jul', status: 'Regular', spend: '$2,540',
    jobHistory: [{ service: 'Logbook service', date: '22 Jul 2026', total: '$420' }] },
];

const COLS = '1.3fr .9fr .9fr .8fr .9fr';

function StatusPill({ status, extra }) {
  const s = STATUS[status] ?? STATUS.Regular;
  return <span className="fg" style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 11px', fontWeight: 700, ...extra }}>{status}</span>;
}

export function Customers() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const term = q.trim().toLowerCase();
  const rows = CUSTOMERS.filter((c) =>
    !term || [c.name, c.phone, c.vehicle].some((v) => v.toLowerCase().includes(term))
  );

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{CUSTOMERS.length} total</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, vehicle…"
          style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: 220 }} />
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New customer</span>
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
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.avatarBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="fg" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{c.initials}</span>
              </div>
              <div>
                <div className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{c.name}</div>
                <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{c.phone}</div>
              </div>
            </div>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{c.vehicle}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{c.lastVisit}</span>
            <StatusPill status={c.status} extra={{ justifySelf: 'start' }} />
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{c.spend}</span>
          </div>
        ))}
        {!rows.length && <div className="fg" style={{ padding: 20, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No matches</div>}
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 26, width: 460, maxHeight: '78vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: open.avatarBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="fg" style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{open.initials}</span>
              </div>
              <div>
                <div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{open.name}</div>
                <div className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>{open.phone} · {open.vehicle}</div>
              </div>
              <span style={{ flex: 1 }} />
              <StatusPill status={open.status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: 13 }}><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 700 }}>LIFETIME SPEND</div><div className="cap" style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{open.spend}</div></div>
              <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: 13 }}><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 700 }}>LAST VISIT</div><div className="cap" style={{ fontSize: 16, color: 'var(--text)', marginTop: 4 }}>{open.lastVisit}</div></div>
            </div>
            <div className="cap" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Job history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {open.jobHistory.map((jh, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
                  <div><div className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{jh.service}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', marginTop: 2 }}>{jh.date}</div></div>
                  <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>{jh.total}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <span className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Call</span>
              <span className="fg" onClick={() => setOpen(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
