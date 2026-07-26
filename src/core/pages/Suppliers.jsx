/**
 * Suppliers — workshop pack. Simple directory table + Call action.
 * Faithful to the prototype; sourced from its real seed suppliers.
 */
const SUPPLIERS = [
  { name: 'Burson Auto Parts', suburb: 'Thomastown', phone: '(03) 9462 1100', website: 'burson.com.au' },
  { name: 'Repco', suburb: 'Preston', phone: '(03) 9478 2200', website: 'repco.com.au' },
  { name: 'BMW Genuine Parts', suburb: 'Docklands', phone: '(03) 8560 5000', website: 'bmw.com.au' },
  { name: 'Penrite Oil', suburb: 'Bayswater', phone: '(03) 9720 0500', website: 'penriteoil.com.au' },
  { name: 'NGK Spark Plugs', suburb: 'Rydalmere', phone: '(02) 9684 6688', website: 'ngk.com.au' },
  { name: 'Ryco Filters', suburb: 'Somerton', phone: '(03) 9305 8900', website: 'ryco.com.au' },
];

const COLS = '2fr 1.2fr 1.2fr 1.4fr 1fr';

export function Suppliers() {
  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{SUPPLIERS.length} suppliers</span>
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New supplier</span>
      </div>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', minWidth: 640 }}>
          {['SUPPLIER', 'SUBURB', 'PHONE', 'WEBSITE', ''].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {SUPPLIERS.map((sp) => (
          <div key={sp.name} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', borderTop: '1px solid var(--border-c)', alignItems: 'center', minWidth: 640 }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{sp.name}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{sp.suburb}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{sp.phone}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{sp.website}</span>
            <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer', justifySelf: 'end' }}>Call</span>
          </div>
        ))}
      </div>
    </div>
  );
}
