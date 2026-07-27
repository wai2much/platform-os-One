import { useStore } from '@/core/store';

function NavIcon({ icon, color }) {
  return (
    <svg
      viewBox="0 0 24 24" width="17" height="17" fill="none" stroke={color}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  );
}

function NavItem({ item, active, onClick }) {
  const color = active ? '#fff' : '#3c3936';
  const badgeColor = active ? '#fff' : item.badgeAccent ? '#fff' : '#8a857c';
  const badgeBg = active ? 'rgba(255,255,255,.25)' : item.badgeAccent ? '#7a8a5e' : 'transparent';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
        textAlign: 'left', background: active ? '#c67139' : 'transparent',
      }}
    >
      <NavIcon icon={item.icon} color={color} />
      <span className="fg" style={{ fontSize: 13.5, fontWeight: active ? 700 : 500, color, flex: 1 }}>{item.label}</span>
      {item.badge && (
        <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: badgeColor, background: badgeBg, borderRadius: 999, padding: '2px 8px' }}>{item.badge}</span>
      )}
    </button>
  );
}

export function Layout({ title, sections, activeKey, onNavigate, user, org, onSignOut, children }) {
  const { startJobCard } = useStore();
  const name = user?.user_metadata?.full_name || user?.email || 'Signed in';
  const roleLabel = org?.role ? org.role[0].toUpperCase() + org.role.slice(1) : 'Member';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--page-bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '0 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 6px 12px' }}>
          <img src="/hos-mark-black.png" alt="Haus" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span className="cap" style={{ fontSize: 19, color: 'var(--text)' }}>Platform OS</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {sections.map((section) => (
            <div key={section.title}>
              <div className="fg" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--text-mute2)', padding: '15px 14px 6px', fontWeight: 700 }}>{section.title}</div>
              {section.items.map((item) => (
                <NavItem key={item.key} item={item} active={activeKey === item.key} onClick={() => onNavigate(item.key)} />
              ))}
            </div>
          ))}
        </nav>

        {/* Dark toggle (visual — not yet wired) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 15px', borderRadius: 999 }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--text-mute)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" />
          </svg>
          <span className="fg" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', flex: 1 }}>Dark mode</span>
          <span style={{ width: 34, height: 19, borderRadius: 999, background: 'var(--panel-bg)', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: 2, width: 15, height: 15, borderRadius: '50%', background: '#fff' }} />
          </span>
        </div>

        {/* User card */}
        <div
          onClick={onSignOut}
          title="Sign out"
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel-bg)', borderRadius: 999, padding: '8px 12px', cursor: onSignOut ? 'pointer' : 'default' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcc9a8', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="fg" style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div className="fg" style={{ color: 'var(--text-mute2)', fontSize: 9.5, fontWeight: 600 }}>{org?.name} · {roleLabel} · Sign out</div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', gap: 10 }}>
          <div className="cap" style={{ color: 'var(--text)', fontSize: 22, whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ position: 'relative', flex: 1, minWidth: 130, maxWidth: 340, margin: '0 14px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-mute)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input type="text" placeholder="Search…" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '9px 14px 9px 36px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute)', fontWeight: 600, whiteSpace: 'nowrap' }}>{today}</span>
            <span onClick={() => startJobCard({})} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#201e1d', color: '#f5ead8', borderRadius: 999, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>New job</span>
            <span onClick={() => onNavigate('settings')} style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z" />
              </svg>
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </main>
    </div>
  );
}
