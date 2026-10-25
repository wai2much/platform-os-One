// GET -> whether two-way SMS is connected. Reports env var NAMES that are
// missing, never their values.
import { smsConfig } from '../_smsProvider.js';

export default function handler(req, res) {
  const { configured, missing } = smsConfig();
  res.status(200).json({ ok: true, configured, missing, webhookSecretSet: Boolean(process.env.LINKEDUP_WEBHOOK_SECRET) });
}
