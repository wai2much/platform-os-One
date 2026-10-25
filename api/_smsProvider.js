// SMS provider adapter — LinkedUp Communications (resells CommStack).
//
// LinkedUp's SMS API is NOT documented publicly. Wai has asked Jim at
// LinkedUp (26 Oct 2026) for the API key, docs, inbound forwarding and the
// sending number. Until those arrive this adapter deliberately does nothing:
// no endpoint, auth scheme or payload shape has been guessed. Everything
// provider-specific lives in this one file, so wiring the real API later
// means editing sendViaProvider() and parseInbound() only — not the routes
// or the UI.
//
// Env vars (Vercel, server-side only — never VITE_*, never in the browser):
//   LINKEDUP_API_KEY         API key from LinkedUp
//   LINKEDUP_SENDER          the sending number / sender ID
//   LINKEDUP_WEBHOOK_SECRET  shared secret LinkedUp sends on inbound posts
//   LINKEDUP_ORG_ID          which Platform OS org inbound texts belong to
import { timingSafeEqual } from 'node:crypto';

export const NOT_CONFIGURED = 'SMS not configured: awaiting LinkedUp API details';

export function smsConfig(env = process.env) {
  const missing = ['LINKEDUP_API_KEY', 'LINKEDUP_SENDER'].filter((k) => !env[k]);
  return { configured: missing.length === 0, missing, sender: env.LINKEDUP_SENDER || null };
}

// Australian mobile, normalised to +614XXXXXXXX. Returns null if not valid.
export function normalizeAuMobile(input) {
  const d = String(input || '').replace(/[^\d+]/g, '');
  let m = d.match(/^\+?614(\d{8})$/) || d.match(/^04(\d{8})$/);
  return m ? `+614${m[1]}` : null;
}

export async function sendViaProvider({ to, body }, env = process.env) {
  const cfg = smsConfig(env);
  if (!cfg.configured) return { ok: false, configured: false, error: NOT_CONFIGURED };
  // Keys are set but LinkedUp's endpoint is still unknown. Refuse rather than
  // guess — fill this in from LinkedUp's docs.
  void to; void body;
  return { ok: false, configured: false, error: 'SMS not configured: LinkedUp send endpoint not yet implemented (awaiting docs)' };
}

// Constant-time compare of the shared secret, from header or ?secret=.
export function verifyInboundSecret(req, env = process.env) {
  const expected = env.LINKEDUP_WEBHOOK_SECRET;
  if (!expected) return false;
  const got = String(req.headers?.['x-webhook-secret'] || req.query?.secret || '');
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// LinkedUp's inbound format is unknown. Accept only fields that are present
// under common names; anything else stays in raw_payload. Returns null when
// no sender number + text can be found, so nothing is invented.
export function parseInbound(payload) {
  const p = payload || {};
  const from = p.from ?? p.sender ?? p.source ?? p.msisdn;
  const text = p.message ?? p.body ?? p.text ?? p.content;
  const to = p.to ?? p.destination ?? null;
  if (!from || typeof text !== 'string') return null;
  return { contact: normalizeAuMobile(from) || String(from), body: text, our_number: to ? String(to) : null };
}
