import { useState } from 'react';

/**
 * HR — core screen. KPIs, Onboarding (interactive checklist), Leave requests,
 * Payroll (real "Run payroll" state change + leave accrual), Disciplinary
 * notes (add-note modal). Faithful to the prototype's HR module scope;
 * Handbook/Performance-reviews/Documents sub-sections are a smaller separate
 * follow-up, not included here.
 */
const ONBOARDING_SEED = [
  { name: 'J. Alvarez', role: 'Apprentice Technician', startDate: '4 Aug', tasks: [
    { label: 'Contract signed', done: true }, { label: 'Uniform issued', done: true },
    { label: 'Toolbox & PPE allocated', done: false }, { label: 'Induction & site tour', done: false },
  ], docs: ['📄 Contract', '📄 Tax file declaration', '📄 Super choice form'] },
];

const LEAVE_SEED = [
  { name: 'Dean Whitlock', type: 'Annual leave', dates: '4–8 Aug', status: 'Pending', color: '#fff', bg: '#c67139' },
  { name: 'Anthony Ruiz', type: 'Sick leave', dates: '26 Jul', status: 'Approved', color: '#fff', bg: '#7a8a5e' },
];

const PAYROLL_SEED = [
  { name: 'Sam Okafor', hours: 76, rate: 38 },
  { name: 'Dean Whitlock', hours: 74, rate: 34 },
  { name: 'Anthony Ruiz', hours: 72, rate: 24 },
];

const ACCRUAL = [
  { name: 'Sam Okafor', annual: 84, sick: 42, rate: '2.9h' },
  { name: 'Dean Whitlock', annual: 61, sick: 38, rate: '2.9h' },
  { name: 'Anthony Ruiz', annual: 55, sick: 30, rate: '2.9h' },
];

const SEVERITY = { Minor: { color: 'var(--text-soft)', bg: 'var(--panel-bg)' }, Moderate: { color: '#fff', bg: '#c67139' } };

export function HR() {
  const [onboarding, setOnboarding] = useState(ONBOARDING_SEED);
  const [leave] = useState(LEAVE_SEED);
  const [payrollRun, setPayrollRun] = useState(false);
  const [notes, setNotes] = useState([{ name: 'Anthony Ruiz', severity: 'Minor', date: '2 Jul 2026', note: 'Arrived 20 minutes late without notice, discussed expectations.' }]);
  const [showNote, setShowNote] = useState(false);
  const [noteName, setNoteName] = useState('');
  const [noteText, setNoteText] = useState('');

  const toggleTask = (hireIdx, taskIdx) => {
    setOnboarding((list) => list.map((h, i) => (i === hireIdx ? { ...h, tasks: h.tasks.map((t, j) => (j === taskIdx ? { ...t, done: !t.done } : t)) } : h)));
  };

  const gross = PAYROLL_SEED.map((p) => p.hours * p.rate);
  const totalGross = gross.reduce((s, g) => s + g, 0);
  const totalSuper = totalGross * 0.115;

  const addNote = () => {
    if (!noteName.trim() || !noteText.trim()) return;
    setNotes((n) => [{ name: noteName, severity: 'Minor', date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }), note: noteText }, ...n]);
    setNoteName(''); setNoteText(''); setShowNote(false);
  };

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: 'var(--text)', fontSize: 26, lineHeight: 1 }}>3</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Team members</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 26, lineHeight: 1 }}>2</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Timesheets pending</div></div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 15, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}><div className="cap" style={{ color: '#c67139', fontSize: 26, lineHeight: 1 }}>1</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute2)', marginTop: 8, fontWeight: 600 }}>Cert expiring soon</div></div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}><span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Onboarding</span><span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>+ New hire</span></div>
        {onboarding.map((h, hi) => {
          const doneCount = h.tasks.filter((t) => t.done).length;
          return (
            <div key={h.name} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-c)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div><div className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700 }}>{h.name} · {h.role}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>Starts {h.startDate}</div></div>
                <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: doneCount === h.tasks.length ? '#7a8a5e' : '#c67139', borderRadius: 999, padding: '3px 10px' }}>{doneCount}/{h.tasks.length} done</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {h.tasks.map((t, ti) => (
                  <div key={ti} onClick={() => toggleTask(hi, ti)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${t.done ? '#7a8a5e' : 'var(--border-c)'}`, background: t.done ? '#7a8a5e' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.done && <span className="fg" style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </span>
                    <span className="fg" style={{ fontSize: 12.5, color: t.done ? 'var(--text-mute2)' : 'var(--text)', fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {h.docs.map((d) => <span key={d} className="fg" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', background: 'var(--panel-bg)', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>{d}</span>)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}><span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Leave requests</span><span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>+ New request</span></div>
        {leave.map((lv) => (
          <div key={lv.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-c)' }}>
            <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{lv.name} · {lv.type}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>{lv.dates}</div></div>
            <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: lv.color, background: lv.bg, borderRadius: 999, padding: '3px 10px' }}>{lv.status}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Payroll</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Next pay run: 31 Jul</span>
            <span onClick={() => setPayrollRun(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: payrollRun ? '#7a8a5e' : '#201e1d', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: payrollRun ? 'default' : 'pointer' }}>{payrollRun ? '✓ Payroll run' : 'Run payroll'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .8fr .8fr .9fr .9fr auto', gap: 10, padding: '0 0 8px' }}>
          {['STAFF', 'HOURS', 'RATE', 'GROSS', 'SUPER', ''].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {PAYROLL_SEED.map((p, i) => (
          <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1.3fr .8fr .8fr .9fr .9fr auto', gap: 10, padding: '9px 0', borderTop: '1px solid var(--border-c)', alignItems: 'center' }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{p.name}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{p.hours}h</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>${p.rate}/h</span>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>${gross[i].toLocaleString()}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)' }}>${(gross[i] * 0.115).toFixed(0)}</span>
            <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>Payslip</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--border-c)' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700 }}>Total gross this run</span><span className="cap" style={{ fontSize: 17, color: 'var(--text)' }}>${totalGross.toLocaleString()}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Super contributions (11.5%)</span><span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>${totalSuper.toFixed(0)}</span></div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-c)' }}>
          <div className="cap" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>Leave accrual</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 12, padding: '0 0 8px' }}>
            {['STAFF', 'ANNUAL', 'SICK', 'ACCRUES/WK'].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
          </div>
          {ACCRUAL.map((la) => (
            <div key={la.name} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border-c)', alignItems: 'center' }}>
              <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{la.name}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{la.annual}h</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{la.sick}h</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)' }}>{la.rate}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}><span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Disciplinary notes</span><span onClick={() => setShowNote(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#201e1d', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>+ New note</span></div>
        {notes.map((dn, i) => {
          const s = SEVERITY[dn.severity];
          return (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-c)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{dn.name}</span><span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 999, padding: '3px 10px' }}>{dn.severity}</span></div>
              <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>{dn.date}</div>
              <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.5 }}>{dn.note}</div>
            </div>
          );
        })}
      </div>

      {showNote && (
        <div onClick={() => setShowNote(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 400 }}>
            <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New disciplinary note</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={noteName} onChange={(e) => setNoteName(e.target.value)} placeholder="Staff name" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Note…" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <span onClick={() => setShowNote(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
              <span onClick={addNote} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Add note</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
