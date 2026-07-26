// Server-side proxy for London (Grok voice agent) health check.
// XAI_API_KEY lives ONLY here — a Vercel server env var, never shipped to the
// browser (per GROK_VOICE_AGENT.md handoff). Settings' "Test connection"
// button calls this instead of faking a result client-side.
export default async function handler(req, res) {
  const apiKey = process.env.XAI_API_KEY;
  const agentId = process.env.XAI_AGENT_ID || 'agent_w54p3rF4EgKG1y4I';

  if (!apiKey) {
    return res.status(200).json({ ok: false, configured: false, message: 'XAI_API_KEY not set on the server' });
  }

  try {
    const r = await fetch('https://api.x.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(200).json({ ok: false, configured: true, message: `Grok API returned ${r.status}: ${text.slice(0, 200)}` });
    }
    return res.status(200).json({ ok: true, configured: true, agentId, message: 'Connected' });
  } catch (err) {
    return res.status(200).json({ ok: false, configured: true, message: err.message });
  }
}
