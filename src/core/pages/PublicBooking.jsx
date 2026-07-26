import { useState } from 'react';

/**
 * Public Booking — core (admin settings for the customer booking portal).
 * Booking-link toggle + copyable link, real scheduling-rule sliders,
 * recent-online-bookings feed, appointment types. Faithful to the prototype.
 */
const RECENT = [
  { name: 'R. Kelso', service: 'Wheel alignment', when: '2h ago' },
  { name: 'P. Nguyen', service: 'Tyre replacement (2)', when: 'Yesterday' },
  { name: 'K. Osei', service: 'Logbook service', when: '2 days ago' },
];

const APPT_TYPES = [
  ['Service', 1.5], ['Tyres & alignment', 1], ['Brakes', 1.5], ['Diagnostic', 1], ['Roadworthy', 1],
];

export function PublicBooking() {
  const [linkOn, setLinkOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [leadTime, setLeadTime] = useState(4);
  const [buffer, setBuffer] = useState(15);
  const [maxPerDay, setMaxPerDay] = useState(6);

  const copyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Booking link</span>
          <span onClick={() => setLinkOn((v) => !v)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: linkOn ? '#fff' : 'var(--text-soft)', background: linkOn ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '5px 13px', cursor: 'pointer' }}>{linkOn ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', lineHeight: 1.6, marginBottom: 14 }}>When enabled, customers can book online via the Customer Booking Portal. New bookings sync straight into the Bookings calendar.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel-bg)', borderRadius: 12, padding: '11px 14px' }}>
          <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>tyreplusthomastown.com.au/book</span>
          <span onClick={copyLink} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer', flexShrink: 0 }}>{copied ? 'Copied!' : 'Copy'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Scheduling rules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>Minimum lead time</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{leadTime}h</span></div>
            <input type="range" min="0" max="48" step="1" value={leadTime} onChange={(e) => setLeadTime(+e.target.value)} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>Buffer between bookings</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{buffer} min</span></div>
            <input type="range" min="0" max="60" step="5" value={buffer} onChange={(e) => setBuffer(+e.target.value)} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>Max bookings/day online</span><span className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{maxPerDay}</span></div>
            <input type="range" min="1" max="12" step="1" value={maxPerDay} onChange={(e) => setMaxPerDay(+e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Recent online bookings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RECENT.map((rb) => (
              <div key={rb.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-c)' }}>
                <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{rb.name}</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>{rb.service} · {rb.when}</div></div>
                <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '3px 10px' }}>Confirmed</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}><span className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>Appointment types</span><span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>+ New type</span></div>
        {APPT_TYPES.map(([name, hours]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-c)' }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{name}</span>
            <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)' }}>{hours}h allocated</span>
          </div>
        ))}
      </div>
    </div>
  );
}
