/**
 * Theme (light / dark / follow system).
 *
 * Sets `data-theme` on <html>, which is what src/index.css keys the dark
 * palette off. Three states rather than a boolean, because "follow the
 * system" is a real preference: a shop iMac on macOS auto-dark at dusk
 * should follow along without anyone touching a toggle.
 *
 * The initial read runs before React mounts (see the inline script in
 * index.html) so a dark-mode user never gets a flash of cream on load.
 */
const KEY = 'platform-os-theme';

/** @returns {'light'|'dark'|'system'} */
export function getThemePreference() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage can throw in private mode / blocked-cookie setups. Not
    // worth failing the app over a colour scheme.
  }
  return 'system';
}

/** The theme actually being shown, after resolving 'system'. */
export function getResolvedTheme(pref = getThemePreference()) {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref) {
  document.documentElement.setAttribute('data-theme', getResolvedTheme(pref));
}

export function setThemePreference(pref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch { /* see above */ }
  applyTheme(pref);
}

/**
 * Re-applies on OS theme change, but only while the user is on 'system' —
 * an explicit light/dark choice shouldn't be overridden by the OS.
 * Returns an unsubscribe fn.
 */
export function watchSystemTheme(onChange) {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return () => {};
  const handler = () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
      onChange?.();
    }
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
