import { useState } from 'react';
import { useStore, fmt } from '@/core/store';

/**
 * Loan Cars — workshop pack. Fleet cards backed by the store's real
 * loan_cars table (see supabase/schema.sql Phase 6), plus "Uber for
 * Business": when a customer doesn't want a loan car, request a ride and
 * bill the trip straight onto that job's line items — this actually appends
 * a real line to the job in the shared store (and its total), the same as
 * the Job Card's parts do.
 */
const STATUS = { Available: { color: '#7a8a5e', bg: 'rgba(122,138,94,.16)' }, Out: { color: '#fff', bg: '#c67139' } };
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function AssignModal({ available, onClose, onAssign }) {
  const [carId, setCarId] = useState(available[0]?.id || '');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueBack, setDueBack] = useState('');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>Assign loan car</div>
        {available.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={carId} onChange={(e) => setCarId(e.target.value)} style={inp}>
              {available.map((c) => <option key={c.id} value={c.id}>{c.car}</option>)}
            </select>
            <input autoFocus value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Customer name" style={inp} />
            <input value={dueBack} onChange={(e) => setDueBack(e.target.value)} placeholder="Due back (e.g. 28 Jul)" style={inp} />
          </div>
        ) : (
          <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>No cars available right now.</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <span onClick={onClose} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
          {available.length > 0 && (
            <span onClick={() => assignedTo.trim() && onAssign(carId, { assignedTo, dueBack })}
              className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: assignedTo.trim() ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 20px', cursor: assignedTo.trim() ? 'pointer' : 'not-allowed' }}>
              Assign
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoanCars() {
  const { jobs, saveJobLines, loanCars, assignLoanCar, returnLoanCar } = useStore();
  const [showAssign, setShowAssign] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [jobId, setJobId] = useState('');
  const [cost, setCost] = useState('');
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState('');

  const outCount = loanCars.filter((c) => c.status === 'Out').length;
  const available = loanCars.filter((c) => c.status === 'Available');

  const requestRide = () => {
    const job = jobs.find((j) => j.id === jobId.trim());
    const amount = parseFloat(cost);
    if (!job) { setError(`No job found with ID "${jobId.trim()}"`); return; }
    if (!amount || amount <= 0) { setError('Enter a valid trip cost'); return; }

    const newLines = [...job.lines, ['Uber for Business — customer ride', 1, amount]];
    const newTotal = job.total + amount;
    saveJobLines(job.id, newLines, newTotal);
    setTrips((t) => [...t, { customer: job.customer, job: job.id, cost: amount.toFixed(2) }]);
    setJobId(''); setCost(''); setError(''); setShowRequest(false);
  };

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{outCount} of {loanCars.length} out</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setShowAssign(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ Assign loan car</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {loanCars.map((c) => {
          const s = STATUS[c.status];
          return (
            <div key={c.id} style={{ background: 'var(--card-bg)', borderRadius: 18, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--panel-bg)' }} />
                <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 9px' }}>{c.status}</span>
              </div>
              <div className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700, lineHeight: 1.3 }}>{c.car}</div>
              <div style={{ borderTop: '1px solid var(--border-c)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[['Assigned to', c.assignedTo || '—'], ['Out since', c.outSince || '—'], ['Due back', c.dueBack || '—']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{k}</span><span className="fg" style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600 }}>{v}</span></div>
                ))}
              </div>
              {c.status === 'Out' && (
                <span onClick={() => returnLoanCar(c.id)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer', alignSelf: 'flex-start' }}>Mark returned</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Uber for Business</span>
          <span onClick={() => setShowRequest(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: 'var(--ink)', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>+ Request ride</span>
        </div>
        <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', lineHeight: 1.6, marginBottom: 14 }}>When a customer doesn't want a loan car, book them an Uber instead — the trip cost adds straight to their job invoice.</div>
        {trips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {trips.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
                <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{t.customer} · {t.job}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>Billed to invoice</div></div>
                <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{fmt(parseFloat(t.cost))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAssign && <AssignModal available={available} onClose={() => setShowAssign(false)} onAssign={(carId, data) => { assignLoanCar(carId, data); setShowAssign(false); }} />}

      {showRequest && (
        <div onClick={() => setShowRequest(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 400 }}>
            <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>Request Uber for customer</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="Job ID (e.g. J-0412)" style={inp} />
              <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="Trip cost ($)" style={inp} />
              {error && <div className="fg" style={{ fontSize: 12, color: '#c67139', fontWeight: 600 }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <span onClick={() => setShowRequest(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
              <span onClick={requestRide} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Request &amp; bill to job</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
