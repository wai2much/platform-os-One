import { useEffect, useState } from 'react';
import { getResolvedTheme, watchSystemTheme } from '@/core/theme';

/** Aspect ratio of the horizontal lockup artwork (742.2 x 144). */
const LOCKUP_RATIO = 742.2 / 144;

/**
 * Which palette the brand artwork should use right now.
 *
 * Two sources of truth to watch: watchSystemTheme covers an OS-level flip
 * while the user is on 'system', and the MutationObserver covers the in-app
 * toggle, which writes data-theme straight onto <html>.
 */
function useResolvedTheme() {
  const [theme, setTheme] = useState(() => getResolvedTheme());
  useEffect(() => watchSystemTheme(() => setTheme(getResolvedTheme())), []);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getResolvedTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

/**
 * The Platform OS One brand mark on its own — the caret plate, no wordmark.
 *
 * Two files rather than one: the standard mark is a near-black plate with a
 * jade caret, which reads on the cream UI but disappears into the dark
 * palette. The dark variant flips only the ink to bone, so the plate keeps
 * its silhouette and the caret stays jade — unlike the supplied single-colour
 * reverse artwork, which drops the accent entirely. Everything that shows the
 * mark goes through here, so that swap only has to be right once.
 */
export function BrandMark({ size = 26, style }) {
  const dark = useResolvedTheme() === 'dark';
  return (
    <img
      src={dark ? '/pos-one-mark-dark.svg' : '/pos-one-mark.svg'}
      alt="Platform OS One"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}

/**
 * The full horizontal lockup: mark, PLATFORM OS wordmark and the ONE chip.
 * Sized by height — the width follows the artwork's own ratio so the
 * wordmark never stretches. Same light/dark swap as BrandMark.
 */
export function BrandLockup({ height = 30, style }) {
  const dark = useResolvedTheme() === 'dark';
  return (
    <img
      src={dark ? '/pos-one-lockup-dark.svg' : '/pos-one-lockup.svg'}
      alt="Platform OS One"
      height={height}
      style={{ height, width: height * LOCKUP_RATIO, maxWidth: '100%', objectFit: 'contain', ...style }}
    />
  );
}
