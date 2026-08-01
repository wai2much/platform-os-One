import { useAuth } from '@/core/auth';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.4-6.4C35.5 2.8 30.1.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.5 5.8C11.9 13.6 17.4 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4z" />
    <path fill="#FBBC05" d="M10.1 19.5a14.5 14.5 0 000 9l-7.5 5.8a24 24 0 010-20.6l7.5 5.8z" />
    <path fill="#34A853" d="M24 47.5c6.1 0 11.5-2 15.3-5.6l-7.3-5.7c-2 1.4-4.7 2.2-8 2.2-6.6 0-12.1-4.1-14-9.9l-7.5 5.8C6.5 42.1 14.6 47.5 24 47.5z" />
  </svg>
);

export function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--card-bg)', border: '1px solid var(--border-c)', borderRadius: 18, padding: '40px 36px', textAlign: 'center' }}>
        <img src="/hos-mark-black.png" alt="Haus" style={{ width: 40, height: 40, objectFit: 'contain', margin: '0 auto 16px' }} />
        <div className="cap" style={{ fontSize: 26, color: 'var(--text)', marginBottom: 6 }}>Platform OS</div>
        <p className="fg" style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 28 }}>
          Sign in to get to your workspace.
        </p>
        <button
          onClick={signInWithGoogle}
          className="fg"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 999, border: '1px solid var(--border-c)',
            /* Google's button is fixed-white per their branding rules, so the
               label must be fixed ink too — var(--text) inverts to cream in
               dark mode and renders the label invisible on the white fill. */
            background: '#fff', color: '#201c16', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <GoogleG />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
