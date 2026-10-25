// Shared helpers for the Twilio voice-agent routes. No `twilio` npm
// dependency on purpose: signature validation is a few lines of HMAC.
//
// X-Twilio-Signature algorithm (https://www.twilio.com/docs/usage/webhooks/webhooks-security):
// take the full webhook URL, append each POST param name+value sorted by
// name, HMAC-SHA1 with the account auth token, base64-encode.
import crypto from 'node:crypto';

export function computeTwilioSignature(authToken, url, params = {}) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + (params[key] ?? ''), url);
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

export function isValidTwilioSignature(authToken, signature, url, params) {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(computeTwilioSignature(authToken, url, params));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Rebuild the public URL Twilio called. Behind Vercel's proxy the host and
// scheme come from forwarded headers. TWILIO_WEBHOOK_BASE_URL overrides
// this when a custom domain is used, so it matches what was pasted in Twilio.
export function publicUrl(req) {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (base) return base.replace(/\/$/, '') + req.url;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${req.url}`;
}

export function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function sendTwiml(res, body) {
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`);
}

// Vercel parses application/x-www-form-urlencoded into req.body already;
// fall back to the raw string just in case.
export function formParams(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}
