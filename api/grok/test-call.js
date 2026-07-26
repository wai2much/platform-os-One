// Real test-call invocation against Grok (replaces the design's scripted
// 4-line transcript per GROK_VOICE_AGENT.md item 5). This exercises Grok's
// chat/reasoning API as a stand-in for the full voice pipeline — actual
// telephony placement needs xAI's voice/telephony product specifics, which
// weren't provided in the handoff; this proves real API connectivity and a
// real generated response, not a canned one.
const LONDON_SYSTEM_PROMPT = `You are London, the phone-answering voice agent for TyrePlus Thomastown, a tyre and mechanical workshop. You handle inbound calls: bookings, reminders, after-hours answer, and complaints. Keep replies short (1-2 sentences), warm, and practical — like a friendly front-desk person, not a generic assistant. Do not invent prices, stock, or appointment slots that weren't given to you.`;

export default async function handler(req, res) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ ok: false, configured: false, message: 'XAI_API_KEY not set on the server' });
  }

  const callerLine = (req.method === 'POST' && req.body?.callerLine) || "Hey, can I book in for a wheel alignment next Tuesday?";

  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          { role: 'system', content: LONDON_SYSTEM_PROMPT },
          { role: 'user', content: callerLine },
        ],
        max_tokens: 120,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(200).json({ ok: false, configured: true, message: `Grok API returned ${r.status}: ${text.slice(0, 200)}` });
    }
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '(no response)';
    return res.status(200).json({ ok: true, configured: true, callerLine, reply });
  } catch (err) {
    return res.status(200).json({ ok: false, configured: true, message: err.message });
  }
}
