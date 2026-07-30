import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Statements — core screen. KPIs and the per-account balance table are REAL —
 * grouped and summed live from the store's invoices (unpaid ones), same
 * pattern as Accounts/Reports. "View" opens a printable per-account statement
 * built from that customer's actual outstanding invoices.
 */
export function Statements() {
  const { invoices } = useStore();
  const [viewing, setViewing] = useState(null);

  const outstanding = invoices.filter((i) => i.status !== 'Paid');
  const byCustomer = {};
  for (const inv of outstanding) {
    if (!byCustomer[inv.customer]) byCustomer[inv.customer] = { customer: inv.customer, terms: inv.terms, balance: 0, lines: [], overdue: false };
    byCustomer[inv.customer].balance += inv.amount;
    byCustomer[inv.customer].lines.push(inv);
    if (inv.status === 'Overdue') byCustomer[inv.customer].overdue = true;
  }
  const rows = Object.values(byCustomer);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(totalBalance)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Total outstanding</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{rows.length}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Accounts with a balance</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 24, lineHeight: 1 }}>{overdueCount}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Past terms</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{rows.length} accounts with a balance</span>
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: 'var(--ink)', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>Send all statements</span>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr .8fr .8fr', gap: 12, padding: '14px 20px', minWidth: 600 }}>
          {['CUSTOMER', 'BALANCE', 'TERMS', '', ''].map((h, i) => <span key={i} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {rows.map((r) => (
          <div key={r.customer} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr .8fr .8fr', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-c)', alignItems: 'center', minWidth: 600 }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{r.customer}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{fmt(r.balance)}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{r.terms}</span>
            <span onClick={() => setViewing(r)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#3c3936', cursor: 'pointer', justifySelf: 'end' }}>View</span>
            <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer', justifySelf: 'end' }}>Send</span>
          </div>
        ))}
        {!rows.length && <div className="fg" style={{ padding: 20, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No outstanding balances</div>}
      </div>

      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: '#fbf5e8', zIndex: 100, padding: 48, overflow: 'auto' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ position: 'relative', background: '#a8b58a', color: '#2e3a1e', padding: '26px 32px', margin: '-48px -48px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="cap" style={{ fontSize: 24 }}>Haus Of Technik Pty. Ltd.</div>
                <div className="fg" style={{ fontSize: 12.5, color: '#3f4d2a', marginTop: 4, lineHeight: 1.6 }}>Trading as TyrePlus Thomastown<br />218 Mahoneys Rd, Thomastown VIC<br />03 9462 4400 · info@hausoftechnik.com.au</div>
              </div>
              <div style={{ textAlign: 'right' }}><div className="cap" style={{ fontSize: 22 }}>ACCOUNT STATEMENT</div></div>
            </div>
            <div style={{ marginBottom: 24 }}><div className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: '#8a857c', fontWeight: 700, marginBottom: 5 }}>ACCOUNT</div><div className="fg" style={{ fontSize: 14, fontWeight: 700 }}>{viewing.customer} · {viewing.terms}</div></div>
            <div style={{ borderTop: '1px solid #e0dccf', borderBottom: '1px solid #e0dccf' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '10px 0', fontWeight: 700, fontSize: 11, letterSpacing: '.06em', color: '#8a857c' }}><span>INVOICE</span><span>STATUS</span><span style={{ textAlign: 'right' }}>AMOUNT</span></div>
              {viewing.lines.map((ln) => (
                <div key={ln.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid #f0ece0', fontSize: 13 }}><span>{ln.id}</span><span>{ln.status}</span><span style={{ textAlign: 'right' }}>{fmt(ln.amount)}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 220, borderTop: '1px solid #201e1d', paddingTop: 8 }}><span className="fg" style={{ fontWeight: 700 }}>Total balance</span><span className="cap" style={{ fontSize: 18 }}>{fmt(viewing.balance)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
              <span onClick={() => window.print()} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}>Print / Save as PDF</span>
              <span onClick={() => setViewing(null)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: '#3c3936', border: '1.5px solid rgba(32,30,29,.2)', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Back</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
