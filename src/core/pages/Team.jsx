import { useState } from 'react';
import { useStore } from '@/core/store';

/**
 * Team — core screen. 3-up staff profile cards. Backed by the store's real
 * team_members table (see supabase/schema.sql Phase 3); jobs/revenue are
 * computed live from the real jobs table (matched by tech first name)
 * rather than stored separately.
 */
const AVATAR_COLORS = ['#201c16', 'var(--positive)', '#8a4f24', '#a8926f', '#6b3a22', 'var(--vermillion)'];
const initials = (name) => (name || '').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
const colorFor = (id) => AVATAR_COLORS[[...String(id)].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const fmtK = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + n);
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Zen Kaku Gothic New, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };
const STATUSES = ['On shift', 'Break', 'Off shift'];

function NewMemberModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', role: '', email: '', status: 'On shift', certs: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="fold fold-lg" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 0, padding: 26, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>Add team member</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="Name" style={inp} />
          <input value={form.role} onChange={set('role')} placeholder="Role (e.g. Technician)" style={inp} />
          <input value={form.email} onChange={set('email')} placeholder="Email" type="email" style={inp} />
          <input value={form.certs} onChange={set('certs')} placeholder="Certifications" style={inp} />
          <select value={form.status} onChange={set('status')} style={inp}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <span className="fg" onClick={() => form.name.trim() && onCreate(form)}
            style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.name.trim() ? 'var(--vermillion)' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 18px', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>
            Add
          </span>
          <span className="fg" onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
        </div>
      </div>
    </div>
  );
}

export function Team() {
  const { team, addTeamMember, jobs } = useStore();
  const [creating, setCreating] = useState(false);

  const statsFor = (name) => {
    const firstName = (name || '').split(' ')[0];
    const mine = jobs.filter((j) => j.tech === firstName);
    return { jobsCount: mine.length, revenue: mine.reduce((s, j) => s + (j.total || 0), 0) };
  };

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{team.length} on the team</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: 'var(--vermillion)', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ Add team member</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {team.map((p) => {
          const { jobsCount, revenue } = statsFor(p.name);
          return (
            <div key={p.id} className="fold" style={{ background: 'var(--card-bg)', borderRadius: 0, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: colorFor(p.id), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="fg" style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{initials(p.name)}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fg" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>{p.name}</div>
                  <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600 }}>{p.role}{p.email ? ` · ${p.email}` : ''}</div>
                </div>
                <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: p.status === 'On shift' ? '#fff' : 'var(--text-soft)', background: p.status === 'On shift' ? 'var(--positive)' : 'var(--panel-bg)', borderRadius: 999, padding: '3px 9px' }}>{p.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, borderTop: '1px solid var(--border-c)', paddingTop: 12 }}>
                <div><div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{jobsCount}</div><div className="fg" style={{ fontSize: 9, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>JOBS</div></div>
                <div><div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{fmtK(revenue)}</div><div className="fg" style={{ fontSize: 9, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>REVENUE</div></div>
                <div><div className="cap" style={{ fontSize: 18, color: 'var(--text)' }}>{p.avgTime || '—'}</div><div className="fg" style={{ fontSize: 9, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>AVG TIME</div></div>
              </div>
              <div className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{p.certs || '—'}</div>
            </div>
          );
        })}
      </div>

      {creating && <NewMemberModal onClose={() => setCreating(false)} onCreate={(form) => { addTeamMember(form); setCreating(false); }} />}
    </div>
  );
}
