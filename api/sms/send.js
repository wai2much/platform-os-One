// POST { to, body } with the user's Supabase token -> sends an SMS through
// LinkedUp and records it in sms_messages. The API key stays server-side.
// Until LinkedUp details are in, this returns 503 "not configured" and
// records nothing, so the inbox never shows a message that didn't go out.
import { sendViaProvider, normalizeAuMobile, smsConfig } from '../_smsProvider.js';
import { adminClient, memberOrg } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Expected POST' });
  const { to, body } = req.body || {};
  const contact = normalizeAuMobile(to);
  const text = String(body || '').trim();
  if (!contact) return res.status(400).json({ ok: false, message: 'Enter an Australian mobile number' });
  if (!text) return res.status(400).json({ ok: false, message: 'Message is empty' });

  const supabase = adminClient();
  if (!supabase) return res.status(503).json({ ok: false, configured: false, message: 'Supabase not configured on the server' });
  const who = await memberOrg(req, supabase);
  if (!who) return res.status(401).json({ ok: false, message: 'Sign in again' });

  const r = await sendViaProvider({ to: contact, body: text });
  if (!r.ok) return res.status(r.configured === false ? 503 : 502).json({ ok: false, configured: r.configured, message: r.error });

  const { data, error } = await supabase.from('sms_messages').insert({
    org_id: who.orgId, direction: 'out', contact, our_number: smsConfig().sender,
    body: text, status: 'sent', provider_id: r.providerId || null, read: true, sent_by: who.userId,
  }).select().single();
  if (error) return res.status(200).json({ ok: true, warning: `Sent, but not saved: ${error.message}` });
  return res.status(200).json({ ok: true, message: data });
}
