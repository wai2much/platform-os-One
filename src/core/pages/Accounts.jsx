import { useState } from 'react';
import { useStore, fmt, liveInvoices, historicalInvoices } from '@/core/store';

/**
 * Accounts — core screen. Revenue, GST collected, accounts receivable and the
 * invoice breakdown are REAL, derived live from the invoices in the shared
 * store.
 *
 * Expenses are NOT tracked anywhere in Platform OS yet, so anything that
 * depends on them (cost of goods, wages, net profit, GST on purchases, net
 * GST payable) cannot be computed and is shown as unavailable rather than
 * estimated. This used to render hardcoded figures — $8,420 parts, $14,860
 * wages, $842 GST on purchases — which flowed into the printable BAS summary
 * below. Fabricated numbers on a document someone might lodge with the ATO is
 * not a risk worth carrying for a nicer-looking screen, so they're gone until
 * real expense data exists (Xero pull, or Zeller via the Xero bank feed).
 *
 * All money on this screen comes from LIVE invoices only — those raised in
 * Platform OS. The 1,830 invoices imported from MechanicDesk are excluded:
 * 446 of them read as 90+ days unpaid (~$293k), which almost certainly
 * reflects invoices settled in person and never closed off in the old system
 * rather than real debt. Reporting that as accounts receivable would put a
 * six-figure error on the dashboard on day one. The backlog is surfaced
 * separately, labelled for what it is.
 */
export function Accounts() {
  const { invoices } = useStore();
  const [showBas, setShowBas] = useState(false);

  const live = liveInvoices(invoices);
  const historical = historicalInvoices(invoices);

  const totalIncGst = live.reduce((s, i) => s + i.amount, 0);
  const gstCollected = totalIncGst - totalIncGst / 1.1;
  const revenueExGst = totalIncGst / 1.1;
  const receivable = live.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0);

  const histUnpaid = historical.filter((i) => i.status !== 'Paid');
  const histUnpaidValue = histUnpaid.reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(totalIncGst)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Revenue this period (inc GST)</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 24, lineHeight: 1 }}>{fmt(gstCollected)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>GST collected</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>{fmt(receivable)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Accounts receivable</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 24, lineHeight: 1 }}>28 Oct</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Next BAS due</div></div>
      </div>

      <div style={{ background: 'var(--ink)', borderRadius: 20, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Cost of goods (parts)</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Not tracked</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Wages &amp; super</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Not tracked</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-c)', paddingTop: 8, marginTop: 2 }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Net profit</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Needs expense data</span></div>
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Expenses this period</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
            <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              Platform OS doesn&apos;t track expenses yet, so there&apos;s nothing real to show here.
            </div>
            <div className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', lineHeight: 1.55 }}>
              Your spend lives in Zeller and flows to Xero. Connecting that feed is what will fill this in — until then it stays empty rather than estimated.
            </div>
          </div>
        </div>
      </div>

      {histUnpaid.length > 0 && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid #ddd0ae', borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Imported backlog · needs review</span>
            <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>Excluded from the figures above</span>
          </div>
          <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 }}>
            <strong>{histUnpaid.length} invoices ({fmt(histUnpaidValue)})</strong> came across from the old system still marked unpaid.
            Most are likely settled-in-person jobs that were never closed off there, not money owed — so they&apos;re kept out of
            revenue, GST and receivables until someone works through them. Reconcile against the bank, then mark them off.
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ padding: '17px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Invoice GST breakdown</span>
          <span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Live invoices only</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '0 20px 10px', minWidth: 560 }}>
          {['INVOICE', 'EX GST', 'GST', 'TOTAL'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {live.length === 0 && (
          <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', padding: '14px 20px', borderTop: '1px solid var(--border-c)' }}>
            No invoices raised in Platform OS yet — this fills in as jobs are invoiced from here.
          </div>
        )}
        {live.map((inv) => (
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid #f0ece0', fontSize: 13 }}><span>1B · GST on purchases</span><span style={{ textAlign: 'right', color: '#8a857c' }}>Not tracked — see below</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 300, borderTop: '1px solid #201e1d', paddingTop: 8 }}><span className="fg" style={{ fontWeight: 700 }}>GST on sales (1A)</span><span className="cap" style={{ fontSize: 18 }}>{fmt(gstCollected)}</span></div>
            </div>
            <div style={{ background: '#f3ecd9', border: '1px solid #ddd0ae', borderRadius: 10, padding: '13px 16px', marginTop: 20 }}>
              <div className="fg" style={{ fontSize: 12.5, color: '#5c5346', lineHeight: 1.6 }}>
                <strong>This is a sales-side summary, not a complete BAS.</strong> G1 and 1A above are real,
                calculated from invoices in Platform OS. Platform OS does not track purchases or expenses,
                so 1B cannot be calculated here and no net GST figure is shown — that has to come from your
                accounting records in Xero, and be confirmed with your accountant before you lodge.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
              <span onClick={() => window.print()} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}>Print / Save as PDF</span>
              <span onClick={() => setShowBas(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: '#3c3936', border: '1.5px solid rgba(32,30,29,.2)', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Back</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
