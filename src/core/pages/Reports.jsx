import { useStore, fmt } from '@/core/store';

/**
 * Reports — core screen. The KPI row (Revenue, Jobs completed, Avg job value)
 * is REAL, derived from the store's jobs and invoices. Everything that would
 * need cost tracking or time-series history we don't collect yet (gross margin,
 * weekly revenue, service mix, per-tech performance, top customers, booking
 * source) shows an honest empty state rather than illustrative sample data —
 * it fills in as real activity accrues.
 */
const Empty = ({ children }) => (
  <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', lineHeight: 1.6 }}>{children}</div>
);
const Card = ({ title, children }) => (
  <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
    <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);

export function Reports() {
  const { jobs, invoices } = useStore();

  const revenue = invoices.reduce((s, i) => s + i.amount, 0);
  const completed = jobs.filter((j) => j.status === 'Completed');
  const avgJobValue = completed.length ? completed.reduce((s, j) => s + j.total, 0) / completed.length : 0;

  const kpi = [
    { v: fmt(revenue), l: 'Revenue (invoiced)', c: 'var(--text)' },
    { v: '—', l: 'Gross margin', c: 'var(--text-mute2)' },
    { v: completed.length, l: 'Jobs completed', c: 'var(--text)' },
    { v: fmt(avgJobValue), l: 'Avg job value', c: '#c67139' },
  ];

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>Export report →</span></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpi.map((k) => (
          <div key={k.l} style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
            <div className="cap" style={{ color: k.c, fontSize: 26, lineHeight: 1 }}>{k.v}</div>
            <div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8, fontWeight: 600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <Card title="Revenue · trend"><Empty>Weekly revenue charts here once there's a few weeks of invoicing history.</Empty></Card>
        <Card title="Service mix"><Empty>Breaks down by service type once jobs are being completed.</Empty></Card>
      </div>

      <Card title="Staff performance · this month"><Empty>Per-technician jobs, revenue and average time appear here once jobs are assigned and completed.</Empty></Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Top customers · this month"><Empty>Ranks your customers by spend once invoices start flowing.</Empty></Card>
        <Card title="Booking source"><Empty>Shows where bookings come from (phone, online, walk-in) once bookings are logged.</Empty></Card>
      </div>
    </div>
  );
}
