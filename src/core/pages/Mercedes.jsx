import { useState } from 'react';

/**
 * Mercedes — the Hyper Agent screen. Faithful to the prototype: dark hero
 * with open threads, a real chat thread + quick-prompt chips, a mic toggle
 * (visual "London" voice-agent state), stats, activity log, and automation
 * toggles. Chat replies are a small canned/contextual engine — the real
 * mercedesChat integration (Claude + tools) plugs in here later.
 */
const THREADS = [
  { title: 'T. Nguyen credit hold', detail: 'Invoice #1042 past Net 14 — 12 days overdue', action: 'Chase' },
  { title: 'Burson part delayed', detail: 'Front brake pads for Ranger, ETA unknown', action: 'Follow up' },
  { title: 'NPS detractor', detail: 'T. Nguyen scored 6/10 — needs a call', action: 'Call' },
];

const ACTIVITY = [
  ['09:14', 'Sent service reminder to A. Costa — booked for Wed'],
  ['08:52', 'Chased Burson for the Ranger brake pad ETA'],
  ['08:30', 'Answered after-hours call — logged as new booking'],
  ['Yest', 'Sent 3 overdue-invoice nudges'],
  ['Yest', 'Requested review from S. Bianchi (Google)'],
];

const PROMPTS = ["Who's overdue?", "What's low on stock?", 'Summarise today'];

function reply(q) {
  const s = q.toLowerCase();
  if (s.includes('overdue')) return 'T. Nguyen is 12 days past Net 14 on invoice #1042 ($1,364.00), and M. Petrakis is 4 days over on #1039 ($594.00). Want me to send reminders?';
  if (s.includes('stock') || s.includes('low')) return "Penrite 5W-30 is down to 2 L and Ryco Z516 to 1 ea — both below reorder point. NGK BKR6E is on order from Burson.";
  if (s.includes('summar')) return 'Today: 4 jobs in progress, 3 booked, $0 invoiced so far. One account on credit hold, one NPS detractor needs a follow-up call.';
  return "I've got the floor, parts, invoices and GST covered — ask me anything, or try one of the quick prompts.";
}

export function Mercedes() {
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Morning. Three cars in, one waiting on a Burson part — want me to chase it?" },
  ]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [reviewsOn, setReviewsOn] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null); // message index currently fetching/playing
  const [voiceError, setVoiceError] = useState('');

  const send = (text) => {
    const q = (text ?? draft).trim();
    if (!q) return;
    setMessages((m) => [...m, { from: 'user', text: q }, { from: 'bot', text: reply(q) }]);
    setDraft('');
  };

  // Real call to api/mercedes/speak.js (MiniMax T2A) — decodes the returned
  // base64 audio and plays it. Surfaces the actual { ok, configured, message }
  // from the route rather than swallowing failures, same pattern as the rest
  // of the app's Supabase/Xero "not configured" states.
  const speak = async (text, idx) => {
    setVoiceError('');
    setSpeakingIdx(idx);
    try {
      const res = await fetch('/api/mercedes/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.ok) {
        setVoiceError(data.message || 'Voice synthesis failed');
        setSpeakingIdx(null);
        return;
      }
      const audio = new Audio(`data:audio/${data.format};base64,${data.audioBase64}`);
      audio.onended = () => setSpeakingIdx(null);
      audio.onerror = () => { setVoiceError('Audio failed to play'); setSpeakingIdx(null); };
      await audio.play();
    } catch (err) {
      setVoiceError(err.message);
      setSpeakingIdx(null);
    }
  };

  return (
    <div style={{ padding: '6px 30px 26px', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Hero + threads */}
        <div style={{ background: '#201e1d', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#c67139', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f5ead8' }} />
            </div>
            <div>
              <div className="fg" style={{ fontSize: 11, letterSpacing: '.14em', color: '#e2b48a', fontWeight: 700 }}>MERCEDES LEE · HYPER AGENT</div>
              <div className="cap" style={{ color: '#f5ead8', fontSize: 22, marginTop: 4 }}>Watching the floor and the books</div>
              <div className="fg" style={{ fontSize: 11, color: '#a8b48e', fontWeight: 600, marginTop: 4 }}>● Live · {THREADS.length} open threads</div>
            </div>
          </div>
          {THREADS.map((t) => (
            <div key={t.title} style={{ background: 'rgba(245,234,216,.06)', borderRadius: 16, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="fg" style={{ color: '#f5ead8', fontSize: 13.5, fontWeight: 600 }}>{t.title}</div>
                <div className="fg" style={{ color: '#a49a8c', fontSize: 11, marginTop: 3 }}>{t.detail}</div>
              </div>
              <span className="fg" style={{ fontSize: 11, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '5px 13px' }}>{t.action}</span>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                <div className="fg" style={{
                  background: m.from === 'user' ? '#201e1d' : 'var(--panel-bg)',
                  color: m.from === 'user' ? '#f5ead8' : 'var(--text)',
                  borderRadius: m.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '11px 15px', fontSize: 13, lineHeight: 1.5, maxWidth: '80%', whiteSpace: 'pre-wrap',
                }}>{m.text}</div>
                {m.from === 'bot' && (
                  <span onClick={() => speak(m.text, i)} title="Hear Mercedes say this" className="fg"
                    style={{ fontSize: 15, cursor: speakingIdx === null ? 'pointer' : 'default', flexShrink: 0, opacity: speakingIdx === i ? 1 : 0.55 }}>
                    {speakingIdx === i ? '🔊' : '🔈'}
                  </span>
                )}
              </div>
            ))}
          </div>
          {voiceError && (
            <div className="fg" style={{ fontSize: 11.5, color: '#c67139', fontWeight: 600 }}>Voice: {voiceError}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {PROMPTS.map((p) => (
              <span key={p} onClick={() => send(p)} className="fg" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-soft)', background: 'var(--panel-bg)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>{p}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask Mercedes anything about the floor…"
              style={{ flex: 1, background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '11px 16px', fontSize: 13.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
            <span onClick={() => setListening((v) => !v)} style={{ width: 38, height: 38, borderRadius: '50%', background: listening ? '#c67139' : 'var(--text-mute2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0M12 19v3" /></svg>
            </span>
            <span onClick={() => send()} className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Ask</span>
          </div>
        </div>

        {listening && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: '14px 18px', boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 18 }}>
              {[8, 16, 10, 14].map((h, i) => <span key={i} style={{ width: 3, height: h, background: '#c67139', borderRadius: 2 }} />)}
            </div>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>London is listening — say a command…</span>
          </div>
        )}
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><div className="cap" style={{ color: '#c67139', fontSize: 26, lineHeight: 1 }}>14</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Resolved today</div></div>
          <div><div className="cap" style={{ color: '#7a8a5e', fontSize: 26, lineHeight: 1 }}>6.2h</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Time saved</div></div>
          <div><div className="cap" style={{ color: 'var(--text)', fontSize: 26, lineHeight: 1 }}>{THREADS.length}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Open threads</div></div>
          <div><div className="cap" style={{ color: 'var(--text)', fontSize: 26, lineHeight: 1 }}>98%</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Call answer rate</div></div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Recent activity</div>
          {ACTIVITY.map(([time, text], i) => (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '8px 0', borderBottom: '1px solid var(--border-c)' }}>
              <span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600, width: 38, flexShrink: 0 }}>{time}</span>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)', flex: 1 }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Automations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['Service reminders', true], ['Stock chase-up', true], ['After-hours call answer · London', true], ['Overdue invoice nudges', false]].map(([label, on]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: on ? 'var(--text)' : 'var(--text-mute)', fontWeight: 600 }}>{label}</span>
                <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: on ? '#fff' : 'var(--text-soft)', background: on ? '#7a8a5e' : 'transparent', border: on ? 'none' : '1px solid var(--border-c)', borderRadius: 999, padding: '2px 9px' }}>{on ? 'On' : 'Off'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>Review requests <span style={{ color: 'var(--text-mute2)' }}>· London</span></span>
              <span onClick={() => setReviewsOn((v) => !v)} className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: reviewsOn ? '#7a8a5e' : 'var(--text-mute2)', borderRadius: 999, padding: '2px 9px', cursor: 'pointer' }}>{reviewsOn ? 'On' : 'Off'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
