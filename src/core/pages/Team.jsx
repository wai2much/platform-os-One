/**
 * Team — core screen. 3-up staff profile cards (on-shift status, jobs/revenue/
 * avg-time, certifications). Faithful to the prototype.
 */
const TEAM = [
  { name: 'Sam Okafor', role: 'Senior Technician', avatarBg: '#201e1d', status: 'On shift', jobs: 6, revenue: '$4.2k', avgTime: '52m', certs: 'Cert III · Auto Elec' },
  { name: 'Dean Whitlock', role: 'Technician', avatarBg: '#7a8a5e', status: 'On shift', jobs: 5, revenue: '$3.1k', avgTime: '61m', certs: 'Cert III Light Vehicle' },
  { name: 'Anthony Ruiz', role: 'Apprentice, Yr 3', avatarBg: '#8a4f24', status: 'Break', jobs: 3, revenue: '$1.4k', avgTime: '74m', certs: 'RWC in progress' },
];

const initials = (name) => name.split(' ').map((s) => s[0]).slice(0, 2).join('');

export function Team() {
  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{TEAM.length} on the team</span>
        <span style={{ flex: 1 }} />
        <span className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ Add team member</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {TEAM.map((p) => (
          <div key={p.name} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: p.avatarBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="fg" style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{initials(p.name)}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="fg" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>{p.name}</div>
                <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{p.role}</div>
              </div>
              <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: p.status === 'On shift' ? '#fff' : 'var(--text-soft)', background: p.status === 'On shift' ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '3px 9px' }}>{p.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, borderTop: '1px solid var(--border-c)', paddingTop: 12 }}>
              <div><div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{p.jobs}</div><div className="fg" style={{ fontSize: 9, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>JOBS</div></div>
              <div><div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{p.revenue}</div><div className="fg" style={{ fontSize: 9, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>REVENUE</div></div>
              <div><div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{p.avgTime}</div><div className="fg" style={{ fontSize: 9, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>AVG TIME</div></div>
            </div>
            <div className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{p.certs}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
