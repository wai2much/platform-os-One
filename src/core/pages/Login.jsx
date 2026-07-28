import { useAuth } from '@/core/auth';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.4-6.4C35.5 2.8 30.1.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.5 5.8C11.9 13.6 17.4 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4z" />
    <path fill="#FBBC05" d="M10.1 19.5a14.5 14.5 0 000 9l-7.5 5.8a24 24 0 010-20.6l7.5 5.8z" />
    <path fill="#34A853" d="M24 47.5c6.1 0 11.5-2 15.3-5.6l-7.3-5.7c-2 1.4-4.7 2.2-8 2.2-6.6 0-12.1-4.1-14-9.9l-7.5 5.8C6.5 42.1 14.6 47.5 24 47.5z" />
  </svg>
);

// Folded-paper accents: each is a triangle split into a lit half and a
// shadowed half, like a crease catching the light. Positioned around the
// card and left to drift slowly so the screen doesn't feel static.
const CREAM = { light: '#fffaf0', dark: '#e0dccf' };
const BLUSH = { light: '#e8b4ac', dark: '#c17b71' };
const SAGE = { light: '#a8bb8b', dark: '#63744a' };
const INK = { light: '#3c3936', dark: '#201e1d' };

const ORIGAMI_SHAPES = [
  { size: 160, top: '2%', left: '3%', rot: -12, duration: '7s', delay: '-2s', ...CREAM },
  { size: 56, top: '11%', right: '9%', rot: 20, duration: '6s', delay: '-5s', ...SAGE },
  { size: 96, bottom: '8%', left: '7%', rot: 8, duration: '6.5s', delay: '-1s', ...CREAM },
  { size: 174, bottom: '-6%', right: '-4%', rot: -18, duration: '8s', delay: '-4s', ...BLUSH },
  { size: 40, top: '42%', right: '18%', rot: 32, duration: '5s', delay: '-3s', ...INK },
  { size: 62, top: '3%', left: '42%', rot: -6, duration: '6.5s', delay: '-1.5s', ...BLUSH },
  { size: 34, top: '58%', left: '4%', rot: 16, duration: '5.5s', delay: '-2.5s', ...BLUSH },
  { size: 112, top: '64%', right: '6%', rot: -24, duration: '9s', delay: '-6s', ...CREAM },
];

const OrigamiShape = ({ size, top, left, right, bottom, rot, duration, delay, light, dark }) => (
  <div
    aria-hidden="true"
    className="origami-shape"
    style={{
      width: size, height: size, top, left, right, bottom,
      '--rot': `${rot}deg`,
      transform: `rotate(${rot}deg)`,
      animationDuration: duration,
      animationDelay: delay,
    }}
  >
    <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)', background: light }} />
    <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0%, 100% 100%, 50% 100%)', background: dark }} />
  </div>
);

export function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        perspective: 900,
        background: `
          radial-gradient(50rem 40rem at 8% -8%, rgba(255,255,255,.16), transparent 55%),
          radial-gradient(46rem 42rem at 106% 112%, rgba(32,30,29,.22), transparent 60%),
          #c67139
        `,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, opacity: .5, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,250,240,.16) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(60rem 60rem at 50% 40%, #000, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(60rem 60rem at 50% 40%, #000, transparent 75%)',
        }}
      />
      {ORIGAMI_SHAPES.map((s, i) => (
        <OrigamiShape key={i} {...s} />
      ))}
      <div className="origami-card-in" style={{ width: '100%', maxWidth: 380, position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--border-c)', borderRadius: 18, padding: '40px 36px', textAlign: 'center', boxShadow: '0 24px 60px -20px rgba(32,30,29,.25)' }}>
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
            background: '#fff', color: 'var(--text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <GoogleG />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
