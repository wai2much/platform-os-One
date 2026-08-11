import { useStore, fmt, liveInvoices } from '@/core/store';
import { RegoCheck } from '@/components/RegoCheck';

/**
 * Dashboard — faithful port of the Front-of-House prototype design, now real
 * React wired to the shared store instead of a static HTML string. KPIs,
 * today's diary, in-the-bays, parts stock, credits & follow-ups, and staff
 * attendance are all computed live from real data.
 *
 * Revenue totals are derived from LIVE invoices only — migrated MechanicDesk
 * rows carry the old system's unreliable payment state (see store.jsx).
 *
 * Anything that needs a data model Platform OS doesn't have — service-mix
 * breakdown (no line-item categorisation), cars-through-door (no job
 * time-series), profit margin (no cost tracking), NPS (no survey) — now says
 * so instead of rendering invented numbers. Those cards previously showed
 * $286,400 year-to-date, a 41% margin and an NPS of 72 with no on-screen
 * indication they were placeholders, on the first screen anyone opens.
 */
export function Dashboard() {
  const { jobs, invoices, bookings, parts, tyreStock, team, customers, setActive, startJobCard } = useStore();

  // Real revenue by period, from invoices raised in Platform OS. Rows without
  // a createdAt (nothing writes one client-side yet) are counted in the
  // all-time figure only, never attributed to a period they can't be dated to.
  const live = liveInvoices(invoices);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(startOfDay.getTime() - 6 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sumSince = (from) => live.reduce((s, i) => {
    if (!i.createdAt) return s;
    const d = new Date(i.createdAt);
    return Number.isNaN(d.getTime()) || d < from ? s : s + i.amount;
  }, 0);
  const rev7 = sumSince(sevenDaysAgo);
  const revMtd = sumSince(startOfMonth);
  const revYtd = sumSince(startOfYear);

  const inProgress = jobs.filter((j) => j.status === 'In progress');
  const booked = jobs.filter((j) => j.status === 'Booked').length;
  const awaitingApproval = jobs.filter((j) => j.status === 'Awaiting approval').length;
  const ready = jobs.filter((j) => j.status === 'Ready').length;
  const lowParts = parts.filter((p) => p.status === 'Low' || p.status === 'Ordered');
  const lowTyres = tyreStock.filter((t) => t.qty <= t.reorder);
  const partsLowCount = lowParts.length + lowTyres.length;
  const todayStr = new Date().toDateString();
  const invoicedToday = invoices.filter((i) => i.createdAt && new Date(i.createdAt).toDateString() === todayStr).reduce((s, i) => s + i.amount, 0);

  const diary = [...bookings].sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 3);
  const partsStockRows = [...lowParts.map((p) => ({ name: p.name, tag: p.stock === 0 ? p.stock : `${p.stock} left`, ordered: p.status === 'Ordered' })), ...lowTyres.map((t) => ({ name: `${t.brand} ${t.model}`, tag: `${t.qty} left`, ordered: false }))].slice(0, 3);

  const overdue = invoices.filter((i) => i.status === 'Overdue' || i.creditHold);
  const storeCredit = customers.filter((c) => c.status === 'Store credit' || c.status === 'Overdue').filter((c) => !overdue.some((i) => i.customer === c.name));

  const KPI = [
    { value: inProgress.length, label: 'In progress', color: '#c67139', onClick: () => setActive('jobs') },
    { value: booked, label: 'Booked', color: 'var(--text)', onClick: () => setActive('jobs') },
    { value: awaitingApproval, label: 'Awaiting approval', color: 'var(--text)', onClick: () => setActive('jobs') },
    { value: ready, label: 'Ready', color: '#7a8a5e', onClick: () => setActive('jobs') },
    { value: partsLowCount, label: 'Parts low', color: '#c67139', onClick: () => setActive('parts') },
    { value: fmt(invoicedToday), label: 'Invoiced today', color: 'var(--text)', onClick: () => setActive('invoices') },
  ];

  const QUICK_ACTIONS = [
    { label: 'New job', onClick: () => startJobCard({}) },
    { label: 'New booking', onClick: () => setActive('bookings') },
    { label: 'New invoice', onClick: () => setActive('invoices') },
    { label: 'New customer', onClick: () => setActive('customers') },
  ];

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 15, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {QUICK_ACTIONS.map((a) => (
          <span key={a.label} onClick={a.onClick} className="fg" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', background: 'var(--card-bg)', boxShadow: '0 1px 3px rgba(32,30,29,.06)', borderRadius: 999, padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: '#c67139' }}>+</span>{a.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {KPI.map((k) => (
          <div key={k.label} onClick={k.onClick} style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)', cursor: 'pointer' }}>
            <div className="cap" style={{ color: k.color, fontSize: 28, lineHeight: 1 }}>{k.value}</div>
            <div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#0ABAB5', borderRadius: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ width: 78, height: 78, borderRadius: '50%', background: '#c67139', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f5ead8' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span className="fg" style={{ fontSize: 11, letterSpacing: '.14em', color: '#0d3b39', fontWeight: 700 }}>MERCEDES LEE · HYPER AGENT</span><span className="fg" style={{ fontSize: 10, color: '#0d3b39', fontWeight: 600 }}>● On the floor</span></div>
          {overdue[0] && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c67139', flexShrink: 0 }} /><span className="fg" style={{ fontSize: 12, color: '#0d3b39', fontWeight: 600 }}>{overdue[0].creditHold ? 'Account on credit hold' : 'Overdue invoice'} — {overdue[0].customer}, invoice {overdue[0].id}</span></div>
          )}
          {lowParts[0] && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c67139', flexShrink: 0 }} /><span className="fg" style={{ fontSize: 12, color: '#0d3b39', fontWeight: 600 }}>{lowParts.length} part{lowParts.length !== 1 ? 's' : ''} low on stock — starting with {lowParts[0].name}</span></div>
          )}
          <div className="cap" style={{ color: '#0d3b39', fontSize: 20, lineHeight: 1.3 }}>
            {inProgress.length} car{inProgress.length !== 1 ? 's' : ''} in progress{lowParts[0] ? `, waiting on ${lowParts[0].name}` : ''}. Shall I chase it?
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span onClick={() => setActive('parts')} className="fg" style={{ fontSize: 11.5, fontWeight: 600, background: '#c67139', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>Chase part</span>
            <span onClick={() => setActive('bookings')} className="fg" style={{ fontSize: 11.5, fontWeight: 600, border: '1px solid rgba(245,234,216,.3)', color: '#f5ead8', borderRadius: 999, padding: '5px 13px', cursor: 'pointer' }}>Today's diary</span>
            <span onClick={() => setActive('customers')} className="fg" style={{ fontSize: 11.5, fontWeight: 600, border: '1px solid rgba(245,234,216,.3)', color: '#f5ead8', borderRadius: 999, padding: '5px 13px', cursor: 'pointer' }}>Call customer</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Today's diary</span><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{bookings.length} booked</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {diary.map((b, i) => (
              <div key={b.id} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 11.5, color: i === 0 ? '#fff' : 'var(--text-soft)', background: i === 0 ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>{b.time}</span>
                <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flex: 1 }}>{b.vehicle}</span>
                <span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{b.bay || '—'}</span>
              </div>
            ))}
            {!diary.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>Nothing booked.</div>}
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>In the bays</span><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{inProgress.length} active</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inProgress.slice(0, 3).map((j) => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{j.vehicle}</span>
                <span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{j.tech || '—'}</span>
              </div>
            ))}
            {!inProgress.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>Nothing in the bays.</div>}
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Parts stock</span><span className="fg" style={{ fontSize: 10.5, color: '#c67139', fontWeight: 700 }}>{partsLowCount} low</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {partsStockRows.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: p.tag === 0 ? 'var(--text-mute)' : 'var(--text)', fontWeight: 600 }}>{p.name}</span>
                {p.tag === 0 ? (
                  <span className="fg" style={{ fontSize: 10, color: 'var(--text-soft)', border: '1px solid var(--border-c)', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>Ordered</span>
                ) : (
                  <span className="fg" style={{ fontSize: 10, color: '#fff', background: '#c67139', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>{p.tag}</span>
                )}
              </div>
            ))}
            {!partsStockRows.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>All stocked up.</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Revenue</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[['LAST 7 DAYS', rev7], ['MONTH TO DATE', revMtd], ['YEAR TO DATE', revYtd]].map(([l, v]) => (
              <div key={l}><div className="fg" style={{ fontSize: 9.5, letterSpacing: '.08em', color: 'var(--text-mute2)', fontWeight: 700 }}>{l}</div><div className="cap" style={{ fontSize: 19, color: 'var(--text)', marginTop: 4 }}>{fmt(v)}</div></div>
            ))}
          </div>
          <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', lineHeight: 1.55, borderTop: '1px solid var(--border-c)', paddingTop: 12 }}>
            Invoices raised in Platform OS. Imported history is excluded — its payment state came from the old system.
            A breakdown by service type needs invoice line items to be categorised, which isn&apos;t set up yet.
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Cars through door</span>
          <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 }}>Not tracked yet.</div>
          <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', lineHeight: 1.55 }}>
            Needs a dated history of completed jobs. Jobs don&apos;t carry a completion date yet, so there&apos;s nothing to chart.
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Profit margin</span>
          <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 }}>Needs expense data.</div>
          <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', lineHeight: 1.55 }}>
            Revenue is known, costs aren&apos;t. Connecting the Zeller&nbsp;&rarr;&nbsp;Xero feed is what makes a margin calculable.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Credits &amp; follow-ups</span>
            {overdue.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{inv.customer} · invoice {inv.id}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {inv.creditHold && <span className="fg" style={{ fontSize: 10.5, color: '#fff', background: 'var(--ink)', border: '1px solid #c67139', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>Credit hold</span>}
                  <span className="fg" style={{ fontSize: 10.5, color: '#fff', background: '#c67139', borderRadius: 999, padding: '3px 10px', fontWeight: 700 }}>{inv.status}</span>
                </span>
              </div>
            ))}
            {storeCredit.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{c.name} · {c.status.toLowerCase()}</span>
                <span className="fg" style={{ fontSize: 10.5, color: 'var(--text-soft)', border: '1.4px solid var(--border-c)', borderRadius: 999, padding: '2px 9px', fontWeight: 700 }}>Needs follow-up</span>
              </div>
            ))}
            {!overdue.length && !storeCredit.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>Nothing outstanding.</div>}
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Customer NPS</span>
            <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 }}>No survey running.</div>
            <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', lineHeight: 1.55 }}>
              NPS needs customers to be asked the 0&ndash;10 question directly. Star reviews aren&apos;t the same measure, so this stays empty rather than approximating one from them.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Upcoming</span>
            <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)', lineHeight: 1.6 }}>
              Nothing scheduled beyond today. Bookings with a future date will show here.
            </div>
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Staff attendance</span>
            {team.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{p.name}</span>
                <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: p.status === 'On shift' ? '#fff' : 'var(--text-soft)', background: p.status === 'On shift' ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '3px 10px' }}>{p.status}</span>
              </div>
            ))}
            {!team.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>No team members yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
