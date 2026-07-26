import { useState } from 'react';
import { useStore } from '@/core/store';

/**
 * Job Card — TyrePlus "Inspection, Parts & Sign-off" (workshop pack).
 * Faithful to the printed form, made functional: inspection status toggles,
 * live line totals, and auto GST (10%) + Total Due. Sample-free (blank form).
 */
const fmt = (n) => '$' + (n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const OLIVE = '#5a6a3c';
const TERRA = '#8a4f24';
const INK = '#201e1d';
const LINE = '#d3c19a';

const INSPECTION_ITEMS = [
  'Front brake pads (mm)', 'Rear brake pads / shoes (mm)', 'Discs / drums condition', 'Brake fluid level / condition',
  'Shocks / struts & springs', 'Steering, ball joints & tie rods', 'Bushes, CV boots & wheel bearings', 'Battery test (V / CCA)',
  'Lights, horn & wipers', 'Fluids, belts & filters', 'Exhaust & leaks under body',
];
const STATUS_COLOR = { ok: '#5a6a3c', monitor: '#c9a15e', action: '#b4531f' };

const inp = { border: `1px solid ${LINE}`, borderRadius: 999, padding: '8px 12px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: INK, background: '#fffdf8', outline: 'none', width: '100%', boxSizing: 'border-box' };

function Card({ children, style }) {
  return <div style={{ background: 'var(--card-bg)', borderRadius: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', padding: 20, ...style }}>{children}</div>;
}
function SectionTitle({ children }) {
  return <div className="cap" style={{ color: TERRA, fontSize: 17, letterSpacing: '.01em', marginBottom: 12 }}>{children}</div>;
}
function CheckSquare({ on, onClick, color = OLIVE }) {
  return (
    <span onClick={onClick} style={{ width: 18, height: 18, borderRadius: 5, border: `1.6px solid ${on ? color : LINE}`, background: on ? color : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-11" /></svg>}
    </span>
  );
}

function BackPage() {
  const { jobCard, updateJobCard, generateInvoice } = useStore();
  const [status, setStatus] = useState({});
  const [notes, setNotes] = useState({});
  const [align, setAlign] = useState({ camber: '', toeF: '', toeR: '', caster: '' });
  const [flags, setFlags] = useState({});
  const parts = jobCard.parts;
  const setParts = (fn) => updateJobCard({ parts: typeof fn === 'function' ? fn(jobCard.parts) : fn });
  const labour = jobCard.labour;
  const setLabour = (v) => updateJobCard({ labour: v });
  const sundries = jobCard.sundries;
  const setSundries = (v) => updateJobCard({ sundries: v });
  const [method, setMethod] = useState('');

  const setPart = (i, k, v) => setParts((p) => p.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const lineTotal = (r) => (parseFloat(r.qty) || 0) * (parseFloat(r.unit) || 0);
  const partsTotal = parts.reduce((s, r) => s + lineTotal(r), 0);
  const net = partsTotal + (parseFloat(labour) || 0) + (parseFloat(sundries) || 0);
  const gst = net * 0.1;
  const totalDue = net + gst;

  const flag = (k) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  return (
    <div style={{ padding: '6px 30px 30px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div className="cap" style={{ color: TERRA, fontSize: 30 }}>Inspection, Parts &amp; Sign-off</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: 'var(--text-mute)', fontWeight: 700 }}>JOB NO.</span>
          <input placeholder="TPT-" style={{ ...inp, width: 130 }} />
          <span className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: 'var(--text-mute)', fontWeight: 700 }}>REGO</span>
          <input style={{ ...inp, width: 130 }} />
        </div>
      </div>

      {/* Safety inspection */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <SectionTitle>Safety Inspection</SectionTitle>
          <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute)' }}><b style={{ color: STATUS_COLOR.ok }}>OK</b> serviceable · <b style={{ color: STATUS_COLOR.monitor }}>MONITOR</b> advise · <b style={{ color: STATUS_COLOR.action }}>ACTION</b> now</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 60px 78px 68px 1.3fr', gap: 10, background: OLIVE, borderRadius: 10, padding: '9px 14px' }}>
          {['ITEM', 'OK', 'MONITOR', 'ACTION', 'MEASUREMENT / NOTE'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.05em', color: '#fff', fontWeight: 700 }}>{h}</span>)}
        </div>
        {INSPECTION_ITEMS.map((item) => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '1.4fr 60px 78px 68px 1.3fr', gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid var(--border-c)` }}>
            <span className="fg" style={{ fontSize: 12.5, color: INK }}>{item}</span>
            {['ok', 'monitor', 'action'].map((st) => (
              <CheckSquare key={st} on={status[item] === st} color={STATUS_COLOR[st]} onClick={() => setStatus((s) => ({ ...s, [item]: s[item] === st ? undefined : st }))} />
            ))}
            <input value={notes[item] || ''} onChange={(e) => setNotes((n) => ({ ...n, [item]: e.target.value }))} style={inp} />
          </div>
        ))}
        {/* Alignment */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
          <div className="cap" style={{ color: TERRA, fontSize: 15, marginRight: 4 }}>Alignment</div>
          {[['CAMBER L / R', 'camber'], ['TOE FRONT', 'toeF'], ['TOE REAR', 'toeR'], ['CASTER L / R', 'caster']].map(([lbl, k]) => (
            <div key={k}>
              <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 4 }}>{lbl}</div>
              <input value={align[k]} onChange={(e) => setAlign((a) => ({ ...a, [k]: e.target.value }))} style={{ ...inp, width: 150 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 22, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.withinSpec} onClick={() => flag('withinSpec')} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Within spec after adjust</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.printout} onClick={() => flag('printout')} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Printout attached</span></label>
        </div>
      </Card>

      {/* Parts & labour */}
      <Card>
        <SectionTitle>Parts &amp; Labour</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 150px 110px 110px', gap: 10, background: OLIVE, borderRadius: 10, padding: '9px 14px' }}>
          {['QTY', 'DESCRIPTION OF PART OR LABOUR', 'PART NO.', 'UNIT $', 'LINE $'].map((h, i) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.05em', color: '#fff', fontWeight: 700, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>)}
        </div>
        {parts.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 150px 110px 110px', gap: 10, alignItems: 'center', padding: '6px 14px' }}>
            <input value={r.qty} onChange={(e) => setPart(i, 'qty', e.target.value)} inputMode="decimal" style={{ ...inp, textAlign: 'center' }} />
            <input value={r.desc} onChange={(e) => setPart(i, 'desc', e.target.value)} style={inp} />
            <input value={r.partNo} onChange={(e) => setPart(i, 'partNo', e.target.value)} style={inp} />
            <input value={r.unit} onChange={(e) => setPart(i, 'unit', e.target.value)} inputMode="decimal" style={{ ...inp, textAlign: 'right' }} />
            <span className="fg" style={{ fontSize: 12.5, color: INK, fontWeight: 700, textAlign: 'right' }}>{lineTotal(r) ? fmt(lineTotal(r)) : '—'}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span className="fg" onClick={() => setParts((p) => [...p, { qty: '', desc: '', partNo: '', unit: '' }])} style={{ fontSize: 12, fontWeight: 700, color: TERRA, cursor: 'pointer' }}>+ Add row</span>
        </div>
      </Card>

      {/* Notes + payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <Card>
          <SectionTitle>Tech Notes &amp; Recommendations</SectionTitle>
          <textarea rows={6} style={{ ...inp, borderRadius: 14, resize: 'vertical', width: '100%' }} />
          <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.advised} onClick={() => flag('advised')} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Customer advised of ACTION items</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.quoted} onClick={() => flag('quoted')} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Quote for follow-up work given</span></label>
          </div>
        </Card>

        <Card>
          <SectionTitle>Payment</SectionTitle>
          {[['Parts', fmt(partsTotal), true], ['Labour', labour, false, setLabour], ['Sundries / disposal', sundries, false, setSundries], ['GST (10%)', fmt(gst), true]].map(([lbl, val, ro, setter]) => (
            <div key={lbl} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute)', fontWeight: 600 }}>{lbl}</span>
              {ro ? <div style={{ ...inp, textAlign: 'right', background: 'var(--panel-bg)', border: 'none' }}>{val}</div>
                  : <input value={val} onChange={(e) => setter(e.target.value)} inputMode="decimal" placeholder="0.00" style={{ ...inp, textAlign: 'right' }} />}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: OLIVE, borderRadius: 999, padding: '10px 16px', marginTop: 6 }}>
            <span className="cap" style={{ color: '#fff', fontSize: 15, lineHeight: 1 }}>TOTAL DUE</span>
            <span style={{ flex: 1 }} />
            <span className="cap" style={{ color: '#fff', fontSize: 22 }}>{fmt(totalDue)}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {['Card', 'Cash', 'Account', 'Fleet / warranty'].map((m) => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <CheckSquare on={method === m} onClick={() => setMethod((x) => (x === m ? '' : m))} color={TERRA} />
                <span className="fg" style={{ fontSize: 12.5, color: INK }}>{m}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <span className="fg" onClick={() => net > 0 && generateInvoice()} style={{ fontSize: 13, fontWeight: 700, color: net > 0 ? '#fff' : 'var(--text-mute2)', background: net > 0 ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '10px 22px', cursor: net > 0 ? 'pointer' : 'default' }}>Generate invoice →</span>
          </div>
        </Card>
      </div>

      {/* Sign-off footer */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {[['TECHNICIAN / FITTER'], ['LICENCE / TESTER NO.'], ['WORK COMPLETED — DATE / TIME']].map(([lbl]) => (
            <div key={lbl}>
              <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 6 }}>{lbl}</div>
              <input style={inp} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginTop: 16, alignItems: 'end' }}>
          <div>
            <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 6 }}>CUSTOMER SIGNATURE ON COLLECTION</div>
            <div style={{ height: 44, borderRadius: 12, border: `1px solid ${LINE}`, background: '#fffdf8' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingBottom: 12 }}><CheckSquare on={flags.keys} onClick={() => flag('keys')} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Keys returned / vehicle out</span></label>
        </div>
      </Card>
    </div>
  );
}

const WORK_TYPES = ['Logbook service', 'Tyres', 'Wheel alignment', 'Brakes', 'Battery', 'Air-con regas', 'Roadworthy (RWC)', 'Diagnostic'];

function FrontPage() {
  const { jobCard, updateJobCard } = useStore();
  const [f, setF] = useState({});
  const [flags, setFlags] = useState({});
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const work = jobCard.workTypes;
  const setWork = (fn) => updateJobCard({ workTypes: typeof fn === 'function' ? fn(jobCard.workTypes) : fn });

  const Field = ({ label, k, w, store }) => (
    <div style={{ minWidth: w || 0, flex: w ? '0 0 auto' : 1 }}>
      <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 5 }}>{label}</div>
      {store ? (
        <input value={jobCard[k] || ''} onChange={(e) => updateJobCard({ [k]: e.target.value })} style={inp} />
      ) : (
        <input value={f[k] || ''} onChange={set(k)} style={inp} />
      )}
    </div>
  );

  return (
    <div style={{ padding: '6px 30px 30px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div className="cap" style={{ color: TERRA, fontSize: 30 }}>Job Card — Customer &amp; Vehicle</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: 'var(--text-mute)', fontWeight: 700 }}>JOB NO.</span>
          <input placeholder="TPT-" style={{ ...inp, width: 130 }} />
          <span className="fg" style={{ fontSize: 10.5, letterSpacing: '.08em', color: 'var(--text-mute)', fontWeight: 700 }}>DATE</span>
          <input style={{ ...inp, width: 130 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <SectionTitle>Customer</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="NAME" k="customer" store />
            <div style={{ display: 'flex', gap: 12 }}><Field label="PHONE" k="phone" /><Field label="EMAIL" k="email" /></div>
            <Field label="ADDRESS" k="address" />
          </div>
        </Card>
        <Card>
          <SectionTitle>Vehicle</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}><Field label="MAKE / MODEL" k="vehicle" store /><Field label="YEAR" k="year" w={90} /></div>
            <div style={{ display: 'flex', gap: 12 }}><Field label="REGO" k="rego" w={120} /><Field label="ODOMETER (KM)" k="odo" /><Field label="COLOUR" k="colour" w={120} /></div>
            <Field label="VIN" k="vin" />
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>Booking</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="DATE / TIME IN" k="dateIn" />
          <Field label="PROMISED OUT" k="promised" />
          <Field label="SERVICE ADVISOR" k="advisor" />
          <Field label="BOOKING SOURCE" k="source" />
        </div>
      </Card>

      <Card>
        <SectionTitle>Work Requested</SectionTitle>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          {WORK_TYPES.map((w) => (
            <label key={w} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <CheckSquare on={work[w]} onClick={() => setWork((s) => ({ ...s, [w]: !s[w] }))} color={TERRA} />
              <span className="fg" style={{ fontSize: 12.5, color: INK }}>{w}</span>
            </label>
          ))}
        </div>
        <textarea rows={4} placeholder="Customer description / notes…" style={{ ...inp, borderRadius: 14, resize: 'vertical', width: '100%' }} />
      </Card>

      <Card>
        <SectionTitle>Authorisation</SectionTitle>
        <div className="fg" style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 14, lineHeight: 1.5 }}>
          I authorise the work described above and the use of necessary parts and materials. I understand additional work found during inspection will be quoted before proceeding.
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.loan} onClick={() => setFlags((s) => ({ ...s, loan: !s.loan }))} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Loan car required</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.keep} onClick={() => setFlags((s) => ({ ...s, keep: !s.keep }))} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Keep old parts</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CheckSquare on={flags.contact} onClick={() => setFlags((s) => ({ ...s, contact: !s.contact }))} /><span className="fg" style={{ fontSize: 12.5, color: INK }}>Contact before any extra work</span></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'end' }}>
          <div>
            <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 5 }}>ESTIMATE $</div>
            <input value={f.estimate || ''} onChange={set('estimate')} inputMode="decimal" style={inp} />
          </div>
          <div>
            <div className="fg" style={{ fontSize: 9.5, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700, marginBottom: 5 }}>CUSTOMER SIGNATURE ON DROP-OFF</div>
            <div style={{ height: 44, borderRadius: 12, border: `1px solid ${LINE}`, background: '#fffdf8' }} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function PageTab({ label, active, onClick }) {
  return <span className="fg" onClick={onClick} style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 999, padding: '7px 18px', color: active ? '#fff' : 'var(--text-soft)', background: active ? TERRA : 'transparent' }}>{label}</span>;
}

export function JobCard() {
  const [page, setPage] = useState('front');
  return (
    <div>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 6 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--panel-bg)', borderRadius: 999, padding: 3 }}>
          <PageTab label="Front — Intake" active={page === 'front'} onClick={() => setPage('front')} />
          <PageTab label="Back — Inspection & Sign-off" active={page === 'back'} onClick={() => setPage('back')} />
        </div>
        <span className="fg" onClick={() => window.print()} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: OLIVE, borderRadius: 999, padding: '8px 16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2M6 14h12v8H6z" /></svg>
          Print job card
        </span>
      </div>
      <div id="jobcard-print">
        <div className="jobcard-page" data-active={String(page === 'front')}><FrontPage /></div>
        <div className="jobcard-page" data-active={String(page === 'back')}><BackPage /></div>
      </div>
    </div>
  );
}
