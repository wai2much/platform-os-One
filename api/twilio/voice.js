// Twilio inbound-call webhook for the AI voice agent (London on Grok).
//
// Architecture (no websocket bridge needed):
//   caller -> Twilio number -> this webhook -> TwiML <Dial><Sip>
//   -> sip:{TWILIO_PHONE_NUMBER}@sip.voice.x.ai;transport=tls
//   -> xAI answers with the Voice Agent (XAI_AGENT_ID) the number is routed to.
// Audio flows Twilio <-> xAI directly; Vercel only returns TwiML.
//   xAI SIP:      https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip
//   agent_id:     https://docs.x.ai/developers/rest-api-reference/inference/voice (Create phone number)
//   TwiML <Sip>:  https://www.twilio.com/docs/voice/twiml/sip
//
// This is separate from LinkedUp/CommStack (phone lines) and from the 3CX
// byo_trunk path in api/grok/voice-webhook.js.
import { isValidTwilioSignature, publicUrl, sendTwiml, xmlEscape, formParams } from './_twilio.js';

const XAI_SIP_HOST = 'sip.voice.x.ai';

export function buildXaiSipUri(number) {
  return `sip:${number}@${XAI_SIP_HOST};transport=tls`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, message: 'Expected POST from Twilio' });
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const number = process.env.TWILIO_PHONE_NUMBER;
  const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'].filter((k) => !process.env[k]);

  if (missing.length) {
    // Twilio needs TwiML, so say it out loud rather than returning JSON.
    console.warn('[twilio/voice] not configured, missing:', missing.join(', '));
    return sendTwiml(res, '<Say voice="alice" language="en-AU">Sorry, this line is not set up yet. Please call back later.</Say><Hangup/>');
  }

  const params = formParams(req);
  if (!isValidTwilioSignature(authToken, req.headers['x-twilio-signature'], publicUrl(req), params)) {
    console.warn('[twilio/voice] rejected: bad X-Twilio-Signature');
    return res.status(403).send('Invalid Twilio signature');
  }

  console.log('[twilio/voice] inbound', JSON.stringify({ CallSid: params.CallSid, From: params.From, To: params.To }));

  const statusUrl = xmlEscape(`${publicUrl({ ...req, url: '/api/twilio/status' })}`);
  const sipUri = xmlEscape(buildXaiSipUri(number));
  return sendTwiml(
    res,
    `<Dial answerOnBridge="true"><Sip statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">${sipUri}</Sip></Dial>` +
      '<Say voice="alice" language="en-AU">Sorry, our assistant is unavailable right now. Please try again shortly.</Say>'
  );
}
