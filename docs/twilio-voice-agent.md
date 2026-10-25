# Twilio voice agent (London on Grok) — runbook

Status: code only. Nothing is switched on, bought or configured.

## How it works

```
caller -> Twilio number -> POST /api/twilio/voice (Vercel, checks X-Twilio-Signature)
       -> TwiML <Dial><Sip>sip:{TWILIO_PHONE_NUMBER}@sip.voice.x.ai;transport=tls</Sip></Dial>
       -> xAI answers with the London Voice Agent (XAI_AGENT_ID)
```

Audio goes straight between Twilio and xAI, so there's no websocket bridge
and nothing long-running on Vercel. xAI lets a byo_trunk number route
directly to an agent (`agent_id`, mutually exclusive with `webhook`), so
London's existing prompt and tools in console.x.ai are reused as-is.

Docs:
- xAI SIP calls, Twilio steps: https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip
- xAI Create phone number (`origin`, `agent_id`): https://docs.x.ai/developers/rest-api-reference/inference/voice
- TwiML `<Sip>` (TLS, statusCallback): https://www.twilio.com/docs/voice/twiml/sip
- Twilio webhook signatures: https://www.twilio.com/docs/usage/webhooks/webhooks-security

Alternative that needs no webhook at all: a Twilio Elastic SIP Trunk with
origination URI `sip:{number}@sip.voice.x.ai;transport=tls` (xAI's Twilio
steps). The webhook route is used here so calls are signature-checked and
logged in Platform OS, and a fallback message plays if xAI doesn't answer.

If you later want custom per-call logic (live session.update, tools hitting
Platform OS data), xAI requires holding `wss://api.x.ai/v1/realtime?call_id=...`
open for the whole call. Vercel functions can't do that reliably; it would
run as a small Node service on the Hostinger VPS. Not built yet.

## To switch it on (Wai)

1. Twilio: upgrade the new account from trial (card), complete the
   Australian regulatory bundle (ID + local address) and buy an AU number.
   Public USD list price: local number $3.00/mo + $0.01/min to receive;
   mobile number $20.00/mo + $0.05/min. SIP leg $0.004/min.
   https://www.twilio.com/en-us/voice/pricing/au
2. xAI: register the number with `POST /v2/phone-numbers`,
   `origin: "byo_trunk"`, `phone_number: <the number>`, `agent_id: <XAI_AGENT_ID>`.
3. Vercel (project platform-os-one): set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
   TWILIO_PHONE_NUMBER (XAI_AGENT_ID already exists in .env.example).
4. Twilio console -> the number -> Voice "A call comes in": Webhook, HTTP POST,
   `https://<production domain>/api/twilio/voice`.
5. Call the number. Check Vercel logs for `[twilio/voice]` and `[twilio/status]`.

To turn it off: clear the webhook on the number in Twilio.
