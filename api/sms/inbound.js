// Inbound SMS webhook for LinkedUp. Paste into LinkedUp's inbound forwarding:
//   https://<deployment>/api/sms/inbound   with header x-webhook-secret
//   (or ?secret=...) set to LINKEDUP_WEBHOOK_SECRET.
// Rejects anything without the shared secret. LinkedUp's payload shape is
// not documented yet, so the raw body is always kept in raw_payload and
// logged once the secret checks out.
import { verifyInboundSecret, parseInbound } from '../_smsProvider.js';
import { adminClient } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Expected POST' });
  if (!process.env.LINKEDUP_WEBHOOK_SECRET) return res.status(503).json({ ok: false, configured: false, message: 'SMS not configured: awaiting LinkedUp API details' });
  if (!verifyInboundSecret(req)) return res.status(401).json({ ok: false, message: 'Bad secret' });

  const payload = req.body || {};
  console.log('[sms/inbound] payload:', JSON.stringify(payload));
  const orgId = process.env.LINKEDUP_ORG_ID;
  const supabase = adminClient();
  if (!supabase || !orgId) return res.status(200).json({ ok: true, stored: false, message: 'Logged only: Supabase or LINKEDUP_ORG_ID not set' });

  const msg = parseInbound(payload);
  if (!msg) return res.status(200).json({ ok: true, stored: false, message: 'Logged only: unrecognised payload shape' });

  const { error } = await supabase.from('sms_messages').insert({ org_id: orgId, direction: 'in', status: 'received', raw_payload: payload, ...msg });
  if (error) return res.status(200).json({ ok: true, stored: false, message: error.message });
  return res.status(200).json({ ok: true, stored: true });
}
