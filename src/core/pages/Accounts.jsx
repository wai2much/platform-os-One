import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Accounts — core screen. Faithful to the prototype's layout, but the GST/AR
 * numbers and the invoice breakdown table are REAL — derived live from the
 * invoices already flowing through the shared store, not sample data. P&L
 * cost lines (parts/wages/rent) aren't tracked yet, so those stay illustrative
 * until expense tracking exists; they're clearly a smaller, separate build.
 */
const EXPENSES = [
  ['Parts & supplies', 8420],
  ['Wages & super', 14860],
  ['Rent & utilities', 4200],
  ['Insurance', 980],
];

export function Accounts() {
  const { invoices } = useStore();
  const [showBas, setShowBas] = useState(false);

  const totalIncGst = invoices.reduce((s, i) => s + i.amount, 0);
  const gstCollected = totalIncGst - totalIncGst / 1.1;
  const revenueExGst = totalIncGst / 1.1;
  const receivable = invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0);

  const cogs = 8420;
  const wages = 14860;
  const netProfit = revenueExGst - cogs - wages;
  const gstOnPurchases = 842; // estimate — no purchase/expense tracking yet
  const netGstPayable = gstCollected - gstOnPurchases;

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(totalIncGst)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Revenue this period (inc GST)</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 24, lineHeight: 1 }}>{fmt(gstCollected)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>GST collected</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(receivable)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Accounts receivable</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>28 Oct</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Next BAS due</div></div>
      </div>

      <div style={{ background: '#201e1d', borderRadius: 20, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div className="fg" style={{ fontSize: 10.5, letterSpacing: '.14em', color: '#c9a15e', fontWeight: 700, marginBottom: 8 }}>GST · CURRENT PERIOD</div>
          <div className="cap" style={{ color: '#f5ead8', fontSize: 19, lineHeight: 1.3 }}>{fmt(gstCollected)} in GST collected on {fmt(totalIncGst)} of invoiced revenue — set this aside for your BAS.</div>
        </div>
        <span onClick={() => setShowBas(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '9px 18px', cursor: 'pointer', flexShrink: 0 }}>Export BAS summary</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Profit &amp; loss · this period</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>Revenue (ex GST)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>{fmt(revenueExGst)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>Cost of goods (parts)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>-{fmt(cogs)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>Wages &amp; super</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>-{fmt(wages)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-c)', paddingTop: 8, marginTop: 2 }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Net profit</span><span className="cap" style={{ fontSize: 17, color: netProfit >= 0 ? '#7a8a5e' : '#c67139' }}>{fmt(netProfit)}</span></div>
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Expenses this period</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXPENSES.map(([label, amt]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>{label}</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>{fmt(amt)}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ padding: '17px 20px 12px' }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Invoice GST breakdown</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '0 20px 10px', minWidth: 560 }}>
          {['INVOICE', 'EX GST', 'GST', 'TOTAL'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {invoices.map((inv) => (
          <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '11px 20px', borderTop: '1px solid var(--border-c)', alignItems: 'center', minWidth: 560 }}>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{inv.id}</span>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{fmt(inv.amount / 1.1)}</span>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{fmt(inv.amount - inv.amount / 1.1)}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>{fmt(inv.amount)}</span>
          </div>
        ))}
      </div>

      {showBas && (
        <div style={{ position: 'fixed', inset: 0, background: '#fbf5e8', zIndex: 100, padding: 48, overflow: 'auto' }}>
          <div id="bas-print" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ position: 'relative', background: '#a8b58a', color: '#2e3a1e', padding: '26px 32px', margin: '-48px -48px 28px', clipPath: 'polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,0 100%)' }}>
              <div className="cap" style={{ fontSize: 24 }}>BAS Summary</div>
              <div className="fg" style={{ fontSize: 12.5, color: '#3f4d2a', marginTop: 4 }}>Quarter ending · Next due 28 Oct</div>
            </div>
            <div style={{ borderTop: '1px solid #e0dccf', borderBottom: '1px solid #e0dccf' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 0', fontWeight: 700, fontSize: 11, letterSpacing: '.06em', color: '#8a857c' }}><span>FIELD</span><span style={{ textAlign: 'right' }}>AMOUNT</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid #f0ece0', fontSize: 13 }}><span>G1 · Total sales (inc GST)</span><span style={{ textAlign: 'right' }}>{fmt(totalIncGst)}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid #f0ece0', fontSize: 13 }}><span>1A · GST on sales</span><span style={{ textAlign: 'right' }}>{fmt(gstCollected)}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid #f0ece0', fontSize: 13 }}><span>1B · GST on purchases (est.)</span><span style={{ textAlign: 'right' }}>{fmt(gstOnPurchases)}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 260, borderTop: '1px solid #201e1d', paddingTop: 8 }}><span className="fg" style={{ fontWeight: 700 }}>Net GST payable</span><span className="cap" style={{ fontSize: 18 }}>{fmt(netGstPayable)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
              <span onClick={() => window.print()} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}>Print / Save as PDF</span>
              <span onClick={() => setShowBas(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: '#3c3936', border: '1.5px solid rgba(32,30,29,.2)', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Back</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
