import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Zap, Plus, Send, Mic, MicOff, Volume2, VolumeX,
  Folder, FolderOpen, Trash2, MessageSquare, RefreshCw, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useStore } from '@/core/store';

/**
 * Mercedes — the Hyper Agent screen, rebuilt to the clean chat layout: a left
 * rail (New Chat · Vehicle Health Alerts · history) and a centred "Mercedes
 * here" hero with a composer + example prompts. Replies come from the
 * mercedesChat Supabase Edge Function (Claude + tools, scoped to the caller's
 * org) when Supabase is configured; otherwise a small canned engine keeps the
 * screen usable on sample data — same fallback pattern as the rest of the app.
 */

const ACCENT = '#c67139';

const EXAMPLES = [
  { icon: Zap, label: 'Create a new job', sub: "Let's knock it out" },
  { icon: MessageSquare, label: 'Send customer an SMS', sub: 'Keep them in the loop' },
  { icon: Send, label: 'Draft a follow-up', sub: 'Follow up with them' },
];

// Offline fallback so the screen works before the backend is wired / signed in.
function cannedReply(q) {
  const s = q.toLowerCase();
  if (s.includes('overdue')) return 'T. Nguyen is 12 days past Net 14 on invoice #1042 ($1,364.00), and M. Petrakis is 4 days over on #1039 ($594.00). Want me to send reminders?';
  if (s.includes('stock') || s.includes('low')) return 'Penrite 5W-30 is down to 2 L and Ryco Z516 to 1 ea — both below reorder point. NGK BKR6E is on order from Burson.';
  if (s.includes('summar')) return 'Today: 4 jobs in progress, 3 booked, $0 invoiced so far. One account on credit hold, one NPS detractor needs a follow-up call.';
  if (s.includes('job')) return "Sure — tell me the customer and vehicle and I'll open a job card.";
  if (s.includes('sms') || s.includes('follow')) return "Give me the customer and the gist, and I'll draft the message for you to send.";
  return "I've got the floor, parts, invoices and GST covered — ask me anything, or pick one of the examples.";
}

// --- Vehicle Health Alerts (left rail card) --------------------------------
function VehicleHealthAlerts() {
  const { vehicles } = useStore();
  const [polling, setPolling] = useState(false);
  const alerts = useMemo(
    () => vehicles.filter((v) => v.status === 'Overdue' || v.status === 'Due soon'),
    [vehicles],
  );
  const poll = () => { setPolling(true); setTimeout(() => setPolling(false), 900); };
  return (
    <div style={{ background: 'rgba(198,113,57,.06)', border: '1px solid var(--border-c)', borderRadius: 14, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={13} color={alerts.length ? ACCENT : 'var(--text-mute)'} />
          <span className="fg" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Vehicle Health Alerts</span>
        </div>
        <button onClick={poll} className="fg" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: ACCENT, background: 'rgba(198,113,57,.12)', border: 'none', borderRadius: 999, padding: '4px 9px', cursor: 'pointer' }}>
          <RefreshCw size={11} style={{ animation: polling ? 'spin .9s linear infinite' : 'none' }} /> Poll Now
        </button>
      </div>
      {alerts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0' }}>
          <CheckCircle2 size={26} color="#7a8a5e" />
          <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute)', textAlign: 'center' }}>All vehicles healthy — no active alerts</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((v) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="fg" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.model} · {v.rego}</div>
                <div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)' }}>{v.owner} · due {v.nextDue}</div>
              </div>
              <span className="fg" style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#fff', background: v.status === 'Overdue' ? '#b4522f' : ACCENT, borderRadius: 999, padding: '2px 8px' }}>{v.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Small shared pieces ----------------------------------------------------
function IconBtn({ children, onClick, primary, active, danger, disabled }) {
  const bg = disabled ? 'var(--text-mute2)' : danger || active ? '#b4522f' : primary ? ACCENT : 'var(--panel-bg)';
  const col = primary || danger || active ? '#fff' : 'var(--text-soft)';
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}

function Bubble({ m, thinking }) {
  const user = m.from === 'user';
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: user ? 'flex-end' : 'flex-start' }}>
      {!user && (
        <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: 'rgba(198,113,57,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={14} color={ACCENT} />
        </div>
      )}
      <div className="fg" style={{
        maxWidth: '78%', padding: '11px 15px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
        borderRadius: user ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: user ? ACCENT : 'var(--panel-bg)', color: user ? '#fff' : 'var(--text)', opacity: thinking ? 0.6 : 1,
      }}>{thinking ? 'Thinking…' : m.text}</div>
    </div>
  );
}

function Composer({ draft, setDraft, send, thinking, listening, toggleMic, variant }) {
  const hero = variant === 'hero';
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  if (hero) {
    return (
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--panel-bg)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-c)' }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} rows={3} placeholder="Ask Mercedes anything…"
          style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'none', background: 'transparent', padding: '14px 16px', fontSize: 13.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 12px' }}>
          <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)' }}>Press Enter to send</span>
          <div style={{ display: 'flex', gap: 7 }}>
            <IconBtn onClick={toggleMic} active={listening}>{listening ? <MicOff size={14} /> : <Mic size={14} />}</IconBtn>
            <IconBtn onClick={() => send()} primary disabled={!draft.trim() || thinking}><Send size={14} /></IconBtn>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ borderTop: '1px solid var(--border-c)', padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={listening ? 'Listening…' : 'Ask Mercedes anything…'}
        style={{ flex: 1, background: 'var(--panel-bg)', border: '1px solid var(--border-c)', borderRadius: 999, padding: '11px 16px', fontSize: 13.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
      <IconBtn onClick={toggleMic} active={listening}>{listening ? <MicOff size={15} /> : <Mic size={15} />}</IconBtn>
      <IconBtn onClick={() => send()} primary disabled={!draft.trim() || thinking}><Send size={15} /></IconBtn>
    </div>
  );
}

// --- Empty-state hero -------------------------------------------------------
function EmptyHero({ draft, setDraft, send, listening, toggleMic }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', background: 'rgba(198,113,57,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={26} color={ACCENT} />
        </div>
        <div className="cap" style={{ fontSize: 26, color: 'var(--text)' }}>Mercedes here</div>
        <div className="fg" style={{ fontSize: 13, color: 'var(--text-mute)', marginTop: 4 }}>Let's get to work · Tell me what needs fixing</div>
      </div>
      <Composer variant="hero" draft={draft} setDraft={setDraft} send={send} listening={listening} toggleMic={toggleMic} thinking={false} />
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', marginBottom: 8 }}>Get started with some examples</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} onClick={() => send(ex.label)} style={{ textAlign: 'left', background: 'var(--panel-bg)', border: '1px solid var(--border-c)', borderRadius: 14, padding: 12, cursor: 'pointer' }}>
              <ex.icon size={16} color={ACCENT} style={{ marginBottom: 8 }} />
              <div className="fg" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{ex.label}</div>
              <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>{ex.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Mercedes screen --------------------------------------------------------
export function Mercedes() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId) || null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const newChat = () => { setActiveId(null); setMessages([]); setDraft(''); };
  const selectChat = (c) => { setActiveId(c.id); setMessages(c.messages || []); };
  const deleteChat = (e, id) => {
    e.stopPropagation();
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) newChat();
  };

  const send = async (text) => {
    const q = (text ?? draft).trim();
    if (!q || thinking) return;

    let convId = activeId;
    if (!convId) {
      convId = 'c-' + Date.now().toString(36);
      setConversations((cs) => [{ id: convId, title: q.slice(0, 40), messages: [] }, ...cs]);
      setActiveId(convId);
    }

    const history = [...messages, { from: 'user', text: q }];
    setMessages(history);
    setDraft('');
    const persist = (msgs) => setConversations((cs) => cs.map((c) => (c.id === convId ? { ...c, messages: msgs, title: c.title || q.slice(0, 40) } : c)));
    persist(history);

    if (!isSupabaseConfigured) {
      const next = [...history, { from: 'bot', text: cannedReply(q) }];
      setMessages(next); persist(next);
      return;
    }

    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercedesChat', { body: { messages: history } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next = [...history, { from: 'bot', text: data.content }];
      setMessages(next); persist(next);
    } catch (err) {
      console.error('mercedesChat:', err);
      const next = [...history, { from: 'bot', text: "Couldn't reach the backend just now — try again in a moment." }];
      setMessages(next); persist(next);
    } finally {
      setThinking(false);
    }
  };

  const toggleMic = async () => {
    if (listening) {
      setListening(false);
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-AU'; rec.continuous = true; rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' ';
      if (t.trim()) setDraft((d) => (d + ' ' + t).trim());
    };
    rec.onerror = () => { setListening(false); recognitionRef.current = null; };
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    try { rec.start(); } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', gap: 14, padding: '6px 24px 20px', height: 'calc(100vh - 128px)', minHeight: 560 }}>
      {/* Left rail */}
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--card-bg)', borderRadius: 20, padding: 12, boxShadow: '0 1px 3px rgba(32,30,29,.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(198,113,57,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color={ACCENT} />
            </div>
            <span className="fg" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Mercedes</span>
            <span className="fg" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', color: ACCENT, background: 'rgba(198,113,57,.14)', borderRadius: 5, padding: '2px 5px' }}>AI</span>
          </div>
          <button onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? 'Mute Mercedes' : 'Unmute Mercedes'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: voiceOn ? ACCENT : 'var(--text-mute2)', display: 'flex' }}>
            {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <button onClick={newChat} className="fg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', fontSize: 12.5, fontWeight: 700, color: ACCENT, background: 'rgba(198,113,57,.1)', border: '1px solid rgba(198,113,57,.25)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer' }}>
          <Plus size={14} /> New Chat
        </button>

        <VehicleHealthAlerts />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="fg" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--text-mute2)', fontWeight: 700, padding: '8px 4px 6px' }}>HISTORY</div>
          {conversations.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 0' }}>
              <FolderOpen size={22} color="var(--text-mute2)" />
              <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)' }}>No chats yet</span>
            </div>
          ) : conversations.map((c) => (
            <div key={c.id} onClick={() => selectChat(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 10, cursor: 'pointer', background: activeId === c.id ? 'rgba(198,113,57,.1)' : 'transparent' }}>
              {activeId === c.id ? <FolderOpen size={14} color={ACCENT} style={{ flexShrink: 0 }} /> : <Folder size={14} color="var(--text-mute2)" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fg" style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Untitled'}</div>
                {c.messages?.length > 0 && <div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)' }}>{c.messages.length} msg{c.messages.length !== 1 ? 's' : ''}</div>}
              </div>
              <button onClick={(e) => deleteChat(e, c.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute2)', display: 'flex', flexShrink: 0 }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <section style={{ flex: 1, minWidth: 0, background: 'var(--card-bg)', borderRadius: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {messages.length === 0 ? (
          <EmptyHero draft={draft} setDraft={setDraft} send={send} listening={listening} toggleMic={toggleMic} />
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((m, i) => <Bubble key={i} m={m} />)}
              {thinking && <Bubble m={{ from: 'bot' }} thinking />}
              <div ref={bottomRef} />
            </div>
            <Composer draft={draft} setDraft={setDraft} send={send} thinking={thinking} listening={listening} toggleMic={toggleMic} />
          </>
        )}
      </section>
    </div>
  );
}
