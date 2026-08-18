// // Mercedes text-to-speech via MiniMax T2A (speech-02-turbo), per the
// jarvis-minimax integration spec. International endpoint (api.minimax.io) —
// this key's prefix doesn't match either documented format (sk-api-/eyJ/AQ.),
// so a 2049 here means the key needs the China endpoint (api.minimax.chat)
// instead, not a code problem.
const MINIMAX_ENDPOINT = 'https://api.minimax.io/v1/t2a_v2';
const DEFAULT_VOICE_ID = 'moss_audio_36bc73ae-125a-11f1-b31e-0a631a267b2a'; // Mercedes, female AU professional

export default async function handler(req, res) {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (!apiKey || !groupId) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message: !apiKey ? 'MINIMAX_API_KEY not set on the server' : 'MINIMAX_GROUP_ID not set on the server',
    });
  }

  const text = (req.method === 'POST' && req.body?.text) || '';
  if (!text.trim()) {
    return res.status(200).json({ ok: false, configured: true, message: 'No text provided' });
  }
  const voiceId = req.body?.voiceId || process.env.MERCEDES_VOICE_ID || DEFAULT_VOICE_ID;
  const model = req.body?.model || 'speech-02-turbo'; // -turbo for real-time, -hd for quality-first
  // Which language to read the text as. Matters for Chinese: the written form
  // is shared between Cantonese and Mandarin, and MiniMax reads it as Mandarin
  // unless told 'Chinese,Yue' (their exact value for Cantonese, comma included).
  // 'auto' lets it detect, which is right for everything else.
  const languageBoost = req.body?.languageBoost || 'auto';

  try {
    const r = await fetch(`${MINIMAX_ENDPOINT}?GroupId=${encodeURIComponent(groupId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        text,
        stream: false,
        language_boost: languageBoost,
        voice_setting: { voice_id: voiceId, speed: 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(200).json({ ok: false, configured: true, message: `MiniMax returned ${r.status}: ${errText.slice(0, 300)}` });
    }

    const data = await r.json();
    const hexAudio = data?.data?.audio;
    if (!hexAudio) {
      return res.status(200).json({ ok: false, configured: true, message: `No audio in response: ${JSON.stringify(data).slice(0, 300)}` });
    }

    const audioBuffer = Buffer.from(hexAudio, 'hex');
    return res.status(200).json({
      ok: true,
      configured: true,
      format: 'mp3',
      audioBase64: audioBuffer.toString('base64'),
    });
  } catch (err) {
    return res.status(200).json({ ok: false, configured: true, message: err.message });
  }
}
