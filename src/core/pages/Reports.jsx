import { useStore, fmt, liveInvoices, historicalInvoices } from '@/core/store';

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

  // Live invoices only. This screen used to sum EVERY row in the table, which
  // meant the headline number was really the imported back catalogue (about
  // $1.06m of pre-cutover history) rather than anything Platform OS had done.
  // Dashboard.jsx already filtered these out, so the two screens disagreed
  // about revenue, which is worse than either being wrong on its own.
  const live = liveInvoices(invoices);
  const history = historicalInvoices(invoices);

  // Deliberately labelled "inc GST" rather than divided by 1.1 and called
  // Revenue. Invoices store one tax-inclusive total and nothing else, so an
  // ex-GST figure would be a guess that every line on every invoice is
  // taxable. It isn't: the workshop raises GST-free lines too. Until GST is
  // stored per invoice, the honest move is to name the number for what it
  // actually is instead of inventing precision. Same reason avg job value
  // carries the label: job totals are tax-inclusive as well.
  const invoiced = live.reduce((s, i) => s + i.amount, 0);
  const completed = jobs.filter((j) => j.status === 'Completed');
  const avgJobValue = completed.length ? completed.reduce((s, j) => s + j.total, 0) / completed.length : 0;

  const kpi = [
    { v: fmt(invoiced), l: 'Invoiced (inc GST)', c: 'var(--text)' },
    { v: '—', l: 'Gross margin', c: 'var(--text-mute2)' },
    { v: completed.length, l: 'Jobs completed', c: 'var(--text)' },
    { v: fmt(avgJobValue), l: 'Avg job value (inc GST)', c: '#c67139' },
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

      {history.length > 0 && (
        <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', marginTop: -4 }}>
          Excludes {history.length} imported invoices ({fmt(history.reduce((s, i) => s + i.amount, 0))}) raised in the previous system before cutover. They stay browsable on the Invoices screen but are not counted as Platform OS trading.
        </div>
      )}

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
