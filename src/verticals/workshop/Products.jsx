import { useStore } from '@/core/store';

/**
 * Products — workshop pack. 4-up inventory cards + a Suppliers preview panel
 * ("View all →" jumps to the Suppliers screen). Faithful to the prototype;
 * sample stock/price data.
 */
const STATUS = {
  'In stock': { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' },
  Low: { color: '#fff', bg: '#c67139' },
  Ordered: { color: 'var(--text-soft)', bg: 'var(--panel-bg)' },
};

const PRODUCTS = [
  { name: 'Bridgestone Turanza 225/45R17', size: '225/45R17', stock: 8, price: '$189', status: 'In stock', iconBg: '#c67139' },
  { name: 'Michelin Pilot Sport 265/60R18', size: '265/60R18', stock: 2, price: '$310', status: 'Low', iconBg: '#7a8a5e' },
  { name: 'Penrite 5W-30 Full Synthetic', size: '5L', stock: 2, price: '$62', status: 'Low', iconBg: '#8a4f24' },
  { name: 'Ryco Oil Filter Z516', size: 'Each', stock: 1, price: '$14', status: 'Low', iconBg: '#a8926f' },
  { name: 'NGK Spark Plug BKR6E', size: '4-pack', stock: 0, price: '$38', status: 'Ordered', iconBg: '#dcc9a8' },
  { name: 'Bosch Brake Pads (Front)', size: 'Set', stock: 12, price: '$95', status: 'In stock', iconBg: '#c67139' },
  { name: 'ZMAX 195/R14C', size: '195/R14C', stock: 2, price: '$142', status: 'Low', iconBg: '#7a8a5e' },
  { name: 'Continental 225/65/R17', size: '225/65/R17', stock: 8, price: '$228', status: 'In stock', iconBg: '#8a4f24' },
];

export function Products() {
  const { setActive } = useStore();

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{PRODUCTS.length} total</span>
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New product</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {PRODUCTS.map((p) => {
          const s = STATUS[p.status];
          return (
            <div key={p.name} style={{ background: 'var(--card-bg)', borderRadius: 18, padding: 16, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: p.iconBg, flexShrink: 0 }} />
                <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 9px' }}>{p.status}</span>
              </div>
              <div><div className="fg" style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>{p.size}</div></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-c)', paddingTop: 10 }}>
                <div><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 600 }}>STOCK</div><div className="cap" style={{ fontSize: 17, color: 'var(--text)', marginTop: 2 }}>{p.stock}</div></div>
                <div><div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)', fontWeight: 600, textAlign: 'right' }}>PRICE</div><div className="cap" style={{ fontSize: 17, color: 'var(--text)', marginTop: 2 }}>{p.price}</div></div>
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
          {[['Burson Auto Parts', 'Thomastown'], ['Repco', 'Preston'], ['Penrite Oil', 'Bayswater']].map(([name, suburb]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
              <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{name}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>{suburb}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
