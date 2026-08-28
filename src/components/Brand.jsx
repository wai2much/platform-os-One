// Platform OS One — the brand lockup ("Terminal One").
//
// Drawn as inline SVG rather than shipped as a PNG: the mark appears at 26px
// in the sidebar, 36px on login and 16px as a favicon, and a raster asset
// that looks right at one of those is soft at the others. Vector also means
// the jade is a token we can move in one place instead of re-exporting art.
//
// The previous mark (/hos-mark-black.png) is deliberately left in public/ —
// invoicePdf.js still stamps it as a watermark and depends on its real pixel
// dimensions, so removing it would break invoice PDFs. That's a separate job.
export const JADE = '#10b981';
const SQUARE = '#0d0d0d';

/**
 * The rounded-square terminal glyph on its own — a jade prompt on near-black.
 *
 * The square stays near-black in both themes so the mark is the same object
 * everywhere it appears. On a dark sidebar that would sink into the
 * background, so it gains a hairline ring in dark mode only (the ring is
 * transparent in light mode, where the square already has all the contrast
 * it needs against cream).
 */
export function BrandMark({ size = 26, title = 'Platform OS One' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect x="0" y="0" width="64" height="64" rx="15" fill={SQUARE} />
      <rect
        x="0.6" y="0.6" width="62.8" height="62.8" rx="14.4"
        fill="none" stroke="var(--brand-mark-ring, transparent)" strokeWidth="1.2"
      />
      {/* The prompt: a chevron and an underscore, both on the same stroke
          weight so the glyph reads as one piece of type rather than two marks. */}
      <path
        d="M22 21.5 L34.5 32 L22 42.5" fill="none" stroke={JADE}
        strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M38 43 L48 43" fill="none" stroke={JADE}
        strokeWidth="6" strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mark + wordmark + the ONE pill.
 *
 * `size` drives the mark; the type scales off it so the lockup keeps its
 * proportions whether it's in the 224px sidebar or centred on the login card.
 */
export function BrandLockup({ size = 26, wordSize }) {
  const word = wordSize ?? Math.round(size * 0.73);
  const pill = Math.round(word * 0.62);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.38) }}>
      <BrandMark size={size} />
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.3) }}>
        <span
          className="fg"
          style={{
            fontSize: word, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--text)', whiteSpace: 'nowrap', lineHeight: 1,
          }}
        >
          PLATFORM OS
        </span>
        <span
          className="fg"
          style={{
            fontSize: pill, fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1,
            color: '#08301f', background: JADE, borderRadius: 999,
            padding: `${Math.round(pill * 0.42)}px ${Math.round(pill * 0.75)}px`,
            whiteSpace: 'nowrap',
          }}
        >
          ONE
        </span>
      </div>
    </div>
  );
}
