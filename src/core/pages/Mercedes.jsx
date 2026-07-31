import { useState } from 'react';
import { useStore, fmt, liveInvoices } from '@/core/store';

/**
 * Mercedes — the Hyper Agent screen. Faithful to the prototype: dark hero
 * with open threads, a real chat thread + quick-prompt chips, a mic toggle
 * (visual "London" voice-agent state), stats, activity log, and automation
 * toggles. Chat replies are a small canned/contextual engine — the real
 * mercedesChat integration (Claude + tools) plugs in here later.
 */
// Mercedes has no autonomous task or activity backend yet — nothing chases
// invoices, follows up parts, or logs actions on its own. These lists used to
// be hardcoded, presenting invented work ("Sent service reminder to A. Costa",
// "Chased Burson for the Ranger brake pad ETA") as things the assistant had
// actually done, alongside a live thread count and a "14 resolved today"
// stat. Empty until real work is tracked.
const THREADS = [];
const ACTIVITY = [];

const PROMPTS = ["Who's overdue?", "What's low on stock?", 'Summarise today'];

/**
 * Answers the quick prompts from the store, not from a script.
 *
 * These replies were previously hardcoded prose citing specific invoice
 * numbers, customers and dollar figures ("T. Nguyen is 12 days past Net 14 on
 * invoice #1042 ($1,364.00)"). An assistant stating invented financials as
 * fact is the worst version of the fake-data problem — it's confident, and
 * staff have no way to tell it apart from a real answer. Now every number
 * traces to a record in the store, and when there's nothing to report it says
 * so instead of filling the silence.
 *
 * Only live invoices count for money questions — migrated MechanicDesk rows
 * carry the old system's unreliable payment state (see store.jsx).
 */
function buildReply(q, store) {
  const s = q.toLowerCase();
  const { invoices = [], parts = [], tyreStock = [], jobs = [], bookings = [] } = store;

  if (s.includes('overdue') || s.includes('owe') || s.includes('unpaid')) {
    const unpaid = liveInvoices(invoices).filter((i) => i.status !== 'Paid');
    if (!unpaid.length) return 'Nothing outstanding on invoices raised in Platform OS. (Imported history is excluded — its payment state came from the old system and needs reconciling separately.)';
    const total = unpaid.reduce((sum, i) => sum + i.amount, 0);
    const top = [...unpaid].sort((a, b) => b.amount - a.amount).slice(0, 3)
      .map((i) => `${i.customer || 'Unnamed'} ${fmt(i.amount)} (${i.id})`).join(', ');
    return `${unpaid.length} unpaid invoice${unpaid.length === 1 ? '' : 's'}, ${fmt(total)} total. Largest: ${top}.`;
  }

  if (s.includes('stock') || s.includes('low') || s.includes('order')) {
    const lowParts = parts.filter((p) => p.stock <= 0 || p.status === 'Low' || p.status === 'Ordered');
    const lowTyres = tyreStock.filter((t) => t.qty <= (t.reorder ?? 0));
    if (!lowParts.length && !lowTyres.length) return 'Nothing below reorder point in parts or tyre stock right now.';
    const bits = [];
    if (lowParts.length) bits.push(`${lowParts.length} part${lowParts.length === 1 ? '' : 's'} (${lowParts.slice(0, 3).map((p) => p.name).join(', ')}${lowParts.length > 3 ? '…' : ''})`);
    if (lowTyres.length) bits.push(`${lowTyres.length} tyre line${lowTyres.length === 1 ? '' : 's'} (${lowTyres.slice(0, 3).map((t) => [t.brand, t.size].filter(Boolean).join(' ')).join(', ')}${lowTyres.length > 3 ? '…' : ''})`);
    return `Below reorder point: ${bits.join(' and ')}.`;
  }

  if (s.includes('summar') || s.includes('today') || s.includes('going on')) {
    const inProgress = jobs.filter((j) => j.status === 'In progress').length;
    const booked = bookings.length;
    const live = liveInvoices(invoices);
    const invoiced = live.reduce((sum, i) => sum + i.amount, 0);
    return `${jobs.length} job${jobs.length === 1 ? '' : 's'} on the board (${inProgress} in progress), ${booked} booking${booked === 1 ? '' : 's'}, ${fmt(invoiced)} invoiced through Platform OS.`;
  }

  return "I can answer from what's in the system — try one of the prompts below. Free-form questions aren't wired to a language model yet, so I'd rather say that than guess.";
}

export function Mercedes() {
  const store = useStore();
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Ask me about overdue invoices, low stock, or today's summary — I'll answer from what's actually in the system." },
  ]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [reviewsOn, setReviewsOn] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null); // message index currently fetching/playing
  const [voiceError, setVoiceError] = useState('');

  const send = (text) => {
    const q = (text ?? draft).trim();
    if (!q) return;
    setMessages((m) => [...m, { from: 'user', text: q }, { from: 'bot', text: buildReply(q, store) }]);
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
        <div style={{ background: 'var(--ink)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#c67139', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f5ead8' }} />
            </div>
            <div>
              <div className="fg" style={{ fontSize: 11, letterSpacing: '.14em', color: '#e2b48a', fontWeight: 700 }}>MERCEDES LEE · HYPER AGENT</div>
              <div className="cap" style={{ color: '#f5ead8', fontSize: 22, marginTop: 4 }}>Watching the floor and the books</div>
              <div className="fg" style={{ fontSize: 11, color: '#a8b48e', fontWeight: 600, marginTop: 4 }}>{THREADS.length > 0 ? `● Live · ${THREADS.length} open threads` : 'No open threads'}</div>
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
            <span onClick={() => send()} className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Ask</span>
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
          <div><div className="cap" style={{ color: 'var(--text-mute2)', fontSize: 26, lineHeight: 1 }}>&mdash;</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Resolved today</div></div>
          <div><div className="cap" style={{ color: 'var(--text-mute2)', fontSize: 26, lineHeight: 1 }}>&mdash;</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Time saved</div></div>
          <div><div className="cap" style={{ color: 'var(--text)', fontSize: 26, lineHeight: 1 }}>{THREADS.length}</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Open threads</div></div>
          <div><div className="cap" style={{ color: 'var(--text-mute2)', fontSize: 26, lineHeight: 1 }}>&mdash;</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>Call answer rate</div></div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Recent activity</div>
          {ACTIVITY.length === 0 && (
            <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', lineHeight: 1.6 }}>
              Nothing logged yet. Actions Mercedes takes on your behalf will appear here.
            </div>
          )}
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
