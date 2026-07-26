import { useStore, fmt } from '@/core/store';

/**
 * Reports — core screen. Faithful layout, but the top KPI row (Revenue,
 * Jobs completed, Avg job value) is REAL — derived from the store's jobs
 * and invoices, same as Accounts. Gross margin and the charts/tables below
 * (no cost or time-series tracking yet) stay illustrative sample data.
 */
export function Reports() {
  const { jobs, invoices } = useStore();

  const revenue = invoices.reduce((s, i) => s + i.amount, 0);
  const completed = jobs.filter((j) => j.status === 'Completed');
  const avgJobValue = completed.length ? completed.reduce((s, j) => s + j.total, 0) / completed.length : 0;

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>Export report →</span></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 26, lineHeight: 1 }}>{fmt(revenue)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8, fontWeight: 600 }}>Revenue (invoiced)</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#7a8a5e', fontSize: 26, lineHeight: 1 }}>41%</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8, fontWeight: 600 }}>Gross margin</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 26, lineHeight: 1 }}>{completed.length}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8, fontWeight: 600 }}>Jobs completed</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 26, lineHeight: 1 }}>{fmt(avgJobValue)}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8, fontWeight: 600 }}>Avg job value</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Revenue · last 8 weeks</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, minHeight: 120 }}>
            {[52, 60, 48, 70, 64, 80, 74].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--panel-bg)', borderRadius: '6px 6px 0 0' }} />)}
            <div style={{ flex: 1, height: '92%', background: '#c67139', borderRadius: '6px 6px 0 0' }} />
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Service mix</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', flex: 'none', background: 'conic-gradient(#c67139 0 42%, #7a8a5e 42% 68%, #dcc9a8 68% 86%, #efe0c8 86% 100%)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['#c67139', 'Servicing · 42%'], ['#7a8a5e', 'Brakes & suspension · 26%'], ['#dcc9a8', 'Diagnostics · 18%'], ['var(--panel-bg)', 'Other · 14%']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} /><span className="fg" style={{ fontSize: 11.5, color: 'var(--text-soft)', fontWeight: 600 }}>{label}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ padding: '17px 20px 12px' }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Staff performance · this month</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, padding: '0 20px 10px' }}>
          {['TECHNICIAN', 'JOBS DONE', 'REVENUE', 'AVG TIME'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {[['Dean', 58, '$12,980', '48 min'], ['Sam', 51, '$11,240', '52 min'], ['Wai', 33, '$7,640', '44 min']].map(([name, done, rev, time]) => (
          <div key={name} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-c)', alignItems: 'center' }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{name}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{done}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{rev}</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)' }}>{time}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Top customers · this month</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[['Baxter Logistics', '$4,860'], ['M. Petrakis', '$2,340'], ['T. Nguyen', '$1,890']].map(([name, amt]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{name}</span><span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{amt}</span></div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Booking source</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[['Phone (London)', '54%'], ['Online (Public Booking)', '31%'], ['Walk-in', '15%']].map(([name, pct]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 13, color: 'var(--text-soft)', fontWeight: 600 }}>{name}</span><span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{pct}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
