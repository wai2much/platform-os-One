// Receives xAI's `realtime.call.incoming` webhook when a call arrives on
// London's SIP trunk (byo_trunk, bridged from TyrePlus's 3CX line). The
// actual call audio flows directly between 3CX and xAI's infrastructure —
// this route never touches audio, it's a control/logging hook only.
//
// Payload shape is NOT confirmed against xAI's official docs (docs.x.ai
// blocked this environment's fetch tool with a 403, likely bot protection) —
// only secondhand summaries were available. So this logs the raw body
// unconditionally rather than assuming field names, to avoid silently
// dropping data once we see a real call and can confirm the real shape.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, message: 'Expected POST' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const payload = req.body || {};

  console.log('[grok/voice-webhook] realtime.call.incoming payload:', JSON.stringify(payload));

  if (!supabaseUrl || !supabaseServiceKey) {
    // Still ack the webhook — xAI expects a fast 200, and we don't want it
    // retrying/backing off just because logging storage isn't configured yet.
    return res.status(200).json({ ok: true, configured: false, message: 'Supabase not configured — payload logged to console only' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabase.from('voice_agent_events').insert({
      agent: 'london',
      event_type: payload.type || payload.event || 'unknown',
      call_id: payload.call_id || payload.data?.call_id || null,
      raw_payload: payload,
    });
    if (error) {
      console.error('[grok/voice-webhook] Supabase insert failed:', error.message);
      return res.status(200).json({ ok: true, configured: true, message: `Logged to console; DB insert failed: ${error.message}` });
    }
    return res.status(200).json({ ok: true, configured: true });
  } catch (err) {
    console.error('[grok/voice-webhook] error:', err.message);
    return res.status(200).json({ ok: true, configured: true, message: `Logged to console; handler error: ${err.message}` });
  }
}
