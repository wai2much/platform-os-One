import { useStore, fmt } from '@/core/store';

/**
 * Dashboard — faithful port of the Front-of-House prototype design, now real
 * React wired to the shared store instead of a static HTML string. KPIs,
 * today's diary, in-the-bays, parts stock, credits & follow-ups, and staff
 * attendance are all computed live from real data. Revenue-by-service,
 * cars-through-door, profit-margin trend, and customer NPS stay illustrative
 * — they need time-series/cost-tracking/NPS-survey data models that don't
 * exist yet (same as Accounts/Reports leaving cost tracking illustrative).
 */
export function Dashboard() {
  const { jobs, invoices, bookings, parts, tyreStock, team, customers, setActive, startJobCard } = useStore();

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

      <div style={{ background: '#201e1d', borderRadius: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ width: 78, height: 78, borderRadius: '50%', background: '#c67139', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f5ead8' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span className="fg" style={{ fontSize: 11, letterSpacing: '.14em', color: '#e2b48a', fontWeight: 700 }}>MERCEDES LEE · HYPER AGENT</span><span className="fg" style={{ fontSize: 10, color: '#a8b48e', fontWeight: 600 }}>● On the floor</span></div>
          {overdue[0] && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c67139', flexShrink: 0 }} /><span className="fg" style={{ fontSize: 12, color: '#f0c9a8', fontWeight: 600 }}>{overdue[0].creditHold ? 'Account on credit hold' : 'Overdue invoice'} — {overdue[0].customer}, invoice {overdue[0].id}</span></div>
          )}
          {lowParts[0] && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c67139', flexShrink: 0 }} /><span className="fg" style={{ fontSize: 12, color: '#f0c9a8', fontWeight: 600 }}>{lowParts.length} part{lowParts.length !== 1 ? 's' : ''} low on stock — starting with {lowParts[0].name}</span></div>
          )}
          <div className="cap" style={{ color: '#f5ead8', fontSize: 20, lineHeight: 1.3 }}>
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

      {/* Revenue by service, cars-through-door, and profit margin need a real
          time-series + cost-tracking data model that doesn't exist yet (same
          as Accounts/Reports) — kept illustrative rather than faked live. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Revenue by service</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', flex: 'none', background: 'conic-gradient(#c67139 0 42%, #7a8a5e 42% 68%, #dcc9a8 68% 86%, #efe0c8 86% 100%)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--card-bg)', margin: '22px 0 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="cap" style={{ fontSize: 13, color: 'var(--text)' }}>$8.4k</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['#c67139', 'Servicing · 42%'], ['#7a8a5e', 'Brakes & suspension · 26%'], ['#dcc9a8', 'Diagnostics · 18%'], ['var(--panel-bg)', 'Other · 14%']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flex: 'none' }} /><span className="fg" style={{ fontSize: 11.5, color: 'var(--text-soft)', fontWeight: 600 }}>{l}</span></div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, borderTop: '1px solid var(--border-c)', paddingTop: 12 }}>
            {[['7 DAYS', '$8,420'], ['MONTH TO DATE', '$31,860'], ['YEAR TO DATE', '$286,400']].map(([l, v]) => (
              <div key={l}><div className="fg" style={{ fontSize: 9.5, letterSpacing: '.08em', color: 'var(--text-mute2)', fontWeight: 700 }}>{l}</div><div className="cap" style={{ fontSize: 19, color: 'var(--text)', marginTop: 4 }}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Cars through door</span>
            <div style={{ display: 'flex', gap: 4, background: 'var(--panel-bg)', borderRadius: 999, padding: 3 }}>
              <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '4px 10px' }}>7D</span>
              <span className="fg" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-mute)', padding: '4px 10px' }}>14D</span>
              <span className="fg" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-mute)', padding: '4px 10px' }}>30D</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 70 }}>
            {[52, 68, 44, 76, 60, 82].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--panel-bg)', borderRadius: '5px 5px 0 0' }} />)}
            <div style={{ flex: 1, height: '90%', background: '#c67139', borderRadius: '5px 5px 0 0' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d} className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', fontWeight: 600 }}>{d}</span>)}
            <span className="fg" style={{ fontSize: 10, color: '#c67139', fontWeight: 700 }}>Today</span>
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Profit margin</span><span className="fg" style={{ fontSize: 10.5, color: '#7a8a5e', fontWeight: 700 }}>▲ 3pts</span></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span className="cap" style={{ fontSize: 34, color: 'var(--text)' }}>41%</span><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>last 8 weeks</span></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 34 }}>
            {[58, 64, 52, 70, 66, 78, 74].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--panel-bg)', borderRadius: '3px 3px 0 0' }} />)}
            <div style={{ flex: 1, height: '100%', background: '#c67139', borderRadius: '3px 3px 0 0' }} />
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
                  {inv.creditHold && <span className="fg" style={{ fontSize: 10.5, color: '#fff', background: '#201e1d', border: '1px solid #c67139', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>Credit hold</span>}
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
          {/* Customer NPS needs a real survey data model, not star reviews — illustrative for now. */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Customer NPS</span><span className="fg" style={{ fontSize: 10.5, color: '#7a8a5e', fontWeight: 700 }}>72 · Promoter zone</span></div>
            {[['T. Nguyen', 6, '#c67139', 'Follow up'], ['S. Okafor', 9, '#7a8a5e', 'Thank'], ['J. Bianchi', 8, '#7a8a5e', 'Thank']].map(([n, s, bg, label]) => (
              <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{n} · scored {s}/10</span><span className="fg" style={{ fontSize: 10.5, color: '#fff', background: bg, borderRadius: 999, padding: '3px 10px', fontWeight: 700 }}>{label}</span></div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Upcoming needs real dated bookings/quotes beyond today — illustrative for now. */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Upcoming</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>A. Costa · service recheck</span><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-soft)', fontWeight: 600 }}>Tomorrow 9:00</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>Fleet quote · Baxter Logistics</span><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-soft)', fontWeight: 600 }}>Due Mon</span></div>
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
