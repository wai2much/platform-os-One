// Twilio <Sip> status callback (initiated/ringing/answered/completed).
// Logs only. See https://www.twilio.com/docs/voice/twiml/sip (statusCallback).
import { isValidTwilioSignature, publicUrl, formParams } from './_twilio.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: false, message: 'Expected POST' });
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return res.status(200).json({ ok: false, configured: false, message: 'TWILIO_AUTH_TOKEN not set' });

  const params = formParams(req);
  if (!isValidTwilioSignature(authToken, req.headers['x-twilio-signature'], publicUrl(req), params)) {
    return res.status(403).send('Invalid Twilio signature');
  }
  const { CallSid, CallStatus, CallbackSource, SipResponseCode, CallDuration } = params;
  console.log('[twilio/status]', JSON.stringify({ CallSid, CallStatus, CallbackSource, SipResponseCode, CallDuration }));
  return res.status(204).end();
}
