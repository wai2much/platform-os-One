import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Zap, Plus, Send, Mic, MicOff, Volume2, VolumeX, Paperclip, X, FileText,
  Trash2, MessageSquare, RefreshCw, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/core/auth';
import { useStore, fmt, liveInvoices } from '@/core/store';

// Her face in the left rail and on her chat bubbles. Ships as a plain public
// asset rather than a bundled import so swapping the file doesn't need a
// rebuild — drop a new /mercedes-avatar.jpg in and it's live. Falls back to
// the lightning-bolt mark if the file is missing, so this never blocks on it.
function MercedesAvatar({ size = 26, rounded = 9 }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div style={{ width: size, height: size, borderRadius: rounded, flexShrink: 0, background: 'rgba(198,113,57,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap size={Math.round(size * 0.55)} color={ACCENT} />
      </div>
    );
  }
  return (
    <img
      src="/mercedes-avatar.jpg" alt="Mercedes" onError={() => setBroken(true)}
      style={{ width: size, height: size, borderRadius: rounded, flexShrink: 0, objectFit: 'cover', border: '1px solid var(--border-c)' }}
    />
  );
}

// Rough relative age for the HISTORY list, same shape as PublicBooking's.
function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

// Attachment bytes ride with the live request but never get persisted — a
// handful of photos in a thread would otherwise turn into megabytes of jsonb
// per conversation. Keeps name/type/size so a restored thread still shows
// "here's the file that was attached," just without the pixels.
function stripFilesForStorage(messages) {
  return messages.map((m) => (m.files?.length
    ? { ...m, files: m.files.map(({ name, type, size }) => ({ name, type, size })) }
    : m));
}

/**
 * Mercedes — the Hyper Agent screen, rebuilt to the clean chat layout: a left
 * rail (New Chat · Vehicle Health Alerts · history) and a centred "Mercedes
 * here" hero with a composer + example prompts.
 *
 * Reasoning: when Supabase is configured she calls the mercedesChat Edge
 * Function (Claude + tools, scoped to the caller's org). If that's unreachable
 * (not signed in, function down) she falls back to buildReply — the data-driven
 * engine that answers only from what's in the store, never invented figures.
 * Replies can be spoken via the MiniMax voice route (api/mercedes/speak).
 *
 * Attachments: the paperclip takes photos, PDFs and text files straight into
 * the message. Files never touch storage — they ride with the request as
 * base64 and the Edge Function turns them into image/document blocks. Nothing
 * to clean up, nothing left in a bucket, and one less thing to secure.
 */

const ACCENT = '#c67139';

// Which Mercedes answers.
//
// Default stays 'mercedesChat' — the function the shop has been using — so
// nothing changes for staff. Adding ?agent=v2 to the URL routes that browser
// tab to 'mercedes', the harnessed rewrite (retry, memory, verified writes,
// telemetry). Lets the new one be used for real, by one person, against real
// data, without putting it in front of the floor.
//
// ?agent=v1 forces the old one back. When the rewrite has earned it, delete
// this and call 'mercedes' directly.
const MERCEDES_FN = (() => {
  try {
    const choice = new URLSearchParams(window.location.search).get('agent');
    if (choice === 'v2' || choice === 'mercedes') return 'mercedes';
  } catch { /* SSR or a locked-down browser: fall through to the default */ }
  return 'mercedesChat';
})();

const EXAMPLES = [
  { icon: Zap, label: 'Create a new job', sub: "Let's knock it out" },
  { icon: MessageSquare, label: 'Send customer an SMS', sub: 'Keep them in the loop' },
  { icon: Send, label: 'Draft a follow-up', sub: 'Follow up with them' },
];

const PROMPTS = ["Who's overdue?", "What's low on stock?", 'Summarise today'];

// --- Attachments -----------------------------------------------------------
//
// What she can actually read: the four image types Claude's vision endpoint
// accepts, PDF, and anything text-shaped. Everything else is refused at the
// picker rather than uploaded and silently ignored on the far side.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPT = [...IMAGE_TYPES, 'application/pdf', 'text/*', '.csv', '.md', '.log', '.json'].join(',');
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log|ya?ml|xml|html?|css|js|jsx|ts|tsx|sql|ini|conf|env)$/i;

const MAX_FILES = 5;
const MAX_FILE_MB = 6;
/** Base64 inflates by a third, and the Edge Function gateway will refuse a
 *  fat body outright — a refusal here, with a reason, beats a 413 that looks
 *  to the floor like Mercedes falling over. */
const MAX_TOTAL_MB = 12;
/** Claude reads nothing extra above ~1568px on the long edge, so anything
 *  bigger is bandwidth and tokens spent for no more detail. Phone photos off
 *  the workshop floor are routinely 4000px+. */
const MAX_IMAGE_EDGE = 1568;

const isImage = (f) => IMAGE_TYPES.includes(f.type);
const isTextual = (f) => f.type.startsWith('text/') || f.type === 'application/json' || TEXT_EXT.test(f.name);
const isAccepted = (f) => isImage(f) || f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || isTextual(f);

const prettySize = (bytes) => (bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

const base64Of = (dataUrl) => String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);

/** Shrink an oversized photo in the browser before it ever leaves the tab.
 *  Falls back to the original bytes if anything about the decode fails — a
 *  slightly fat upload beats a lost attachment. */
function downscaleImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const longEdge = Math.max(img.width, img.height);
      if (longEdge <= MAX_IMAGE_EDGE) { URL.revokeObjectURL(url); resolve(null); return; }
      const scale = MAX_IMAGE_EDGE / longEdge;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      // White underneath: a transparent PNG flattened to JPEG otherwise comes
      // out on a black background, which reads as a ruined photo.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try { resolve({ type: 'image/jpeg', dataUrl: canvas.toDataURL('image/jpeg', 0.85) }); }
      catch { resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  reader.readAsDataURL(file);
});

/** One picked file -> the shape the Edge Function expects on the wire. */
async function toAttachment(file) {
  const shrunk = isImage(file) ? await downscaleImage(file) : null;
  const dataUrl = shrunk ? shrunk.dataUrl : await readAsDataUrl(file);
  const type = shrunk ? shrunk.type : (file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'text/plain'));
  const data = base64Of(dataUrl);
  return {
    id: `${file.name}-${file.size}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    type,
    size: Math.round((data.length * 3) / 4),
    data,
    preview: type.startsWith('image/') ? dataUrl : null,
  };
}

/** Strip base64 off everything but the two most recent turns that carried it.
 *  She has already read the older ones; re-posting a 2MB photo on every follow
 *  up is how a chat gets slow and expensive. The filenames stay in the text so
 *  the conversation still makes sense. */
function trimForWire(messages) {
  const withFiles = messages.map((m, i) => (m.files?.length ? i : -1)).filter((i) => i >= 0);
  const keep = new Set(withFiles.slice(-2));
  return messages.map((m, i) => {
    if (!m.files?.length || keep.has(i)) return m;
    const names = m.files.map((f) => f.name).join(', ');
    return { ...m, files: undefined, text: `${m.text}\n\n[earlier attachment: ${names}]`.trim() };
  });
}

// Data-driven fallback — answers only from the store, never invented figures.
// Only live invoices count for money questions; migrated rows carry the old
// system's unreliable payment state.
function buildReply(q, store, fileCount = 0) {
  const s = q.toLowerCase();
  const { invoices = [], parts = [], tyreStock = [], jobs = [], bookings = [] } = store;

  // Reading a file is the agent's job, not the local engine's. Say so plainly
  // rather than answering around an attachment that was never opened.
  if (fileCount > 0) {
    return `I can't open ${fileCount === 1 ? 'that file' : 'those files'} from here — reading attachments needs the full agent, and I can't reach it right now. Sign in (or try again in a moment) and send it through again.`;
  }

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
    const live = liveInvoices(invoices);
    const invoiced = live.reduce((sum, i) => sum + i.amount, 0);
    return `${jobs.length} job${jobs.length === 1 ? '' : 's'} on the board (${inProgress} in progress), ${bookings.length} booking${bookings.length === 1 ? '' : 's'}, ${fmt(invoiced)} invoiced through Platform OS.`;
  }

  return "I can answer from what's in the system — try one of the prompts. For anything else, sign in so I can reach the full agent.";
}

// --- Vehicle Health Alerts (left rail card) --------------------------------
function VehicleHealthAlerts() {
  const { vehicles } = useStore();
  const [polling, setPolling] = useState(false);
  const alerts = useMemo(
    () => (vehicles || []).filter((v) => v.status === 'Overdue' || v.status === 'Due soon'),
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

// --- Shared pieces ----------------------------------------------------------
function IconBtn({ children, onClick, primary, active, disabled, title }) {
  const bg = disabled ? 'var(--text-mute2)' : active ? '#b4522f' : primary ? ACCENT : 'var(--panel-bg)';
  const col = primary || active ? '#fff' : 'var(--text-soft)';
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}

/** The row of pills sitting above the composer once something is clipped on. */
function AttachTray({ items, remove, error }) {
  if (!items.length && !error) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px 0' }}>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(198,113,57,.08)', border: '1px solid rgba(198,113,57,.25)', borderRadius: 10, padding: '5px 7px', maxWidth: 210 }}>
              {f.preview
                ? <img src={f.preview} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(198,113,57,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={13} color={ACCENT} /></div>}
              <div style={{ minWidth: 0 }}>
                <div className="fg" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                <div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)' }}>{prettySize(f.size)}</div>
              </div>
              <button onClick={() => remove(f.id)} title={`Remove ${f.name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute2)', display: 'flex', flexShrink: 0, padding: 0 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="fg" style={{ fontSize: 11, color: '#b4522f', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

function Bubble({ m, thinking, onSpeak, speaking }) {
  const user = m.from === 'user';
  const files = m.files || [];
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: user ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
      {!user && <MercedesAvatar size={28} />}
      <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: user ? 'flex-end' : 'flex-start', gap: 6 }}>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: user ? 'flex-end' : 'flex-start' }}>
            {files.map((f, i) => (f.preview || f.data ? (
              <img key={i} src={f.preview || `data:${f.type};base64,${f.data}`} alt={f.name} title={f.name}
                style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border-c)' }} />
            ) : (
              <div key={i} title={f.name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel-bg)', border: '1px solid var(--border-c)', borderRadius: 10, padding: '6px 9px', maxWidth: 200 }}>
                <FileText size={13} color={ACCENT} style={{ flexShrink: 0 }} />
                <span className="fg" style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              </div>
            )))}
          </div>
        )}
        {(m.text || thinking) && (
          <div className="fg" style={{
            padding: '11px 15px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
            borderRadius: user ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: user ? ACCENT : 'var(--panel-bg)', color: user ? '#fff' : 'var(--text)', opacity: thinking ? 0.6 : 1,
          }}>{thinking ? 'Thinking…' : m.text}</div>
        )}
      </div>
      {!user && !thinking && onSpeak && (
        <span onClick={onSpeak} title="Hear Mercedes say this" style={{ fontSize: 15, cursor: 'pointer', flexShrink: 0, opacity: speaking ? 1 : 0.5 }}>{speaking ? '🔊' : '🔈'}</span>
      )}
    </div>
  );
}

// Dictation language for the mic.
//
// Cantonese is 'yue-Hant-HK' here, NOT the 'zh-HK' you'd expect from BCP-47
// in general. Chrome's SpeechRecognition doesn't accept arbitrary language
// tags — it matches against Google's own speech-service list, where the
// Chinese entries are cmn-Hans-CN / cmn-Hans-HK / cmn-Hant-TW (Mandarin) and
// yue-Hant-HK (Cantonese). 'zh-HK' isn't on that list, so Chrome silently
// falls back to its default locale and transcribes spoken Cantonese as
// English — which looks exactly like the mic being broken.
const MIC_LANGS = [
  { code: 'en-AU', label: 'EN' },
  { code: 'yue-Hant-HK', label: '粵' },
];

function Composer({ draft, setDraft, send, thinking, listening, toggleMic, micLang, cycleMicLang, variant, attach }) {
  const hero = variant === 'hero';
  const fileRef = useRef(null);
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  // Screenshots and photos pasted straight from the clipboard count as
  // attaching — it's how most people move an image between two windows.
  const onPaste = (e) => {
    const pasted = Array.from(e.clipboardData?.files || []);
    if (pasted.length) { e.preventDefault(); attach.add(pasted); }
  };
  const pick = () => fileRef.current?.click();
  const onPicked = (e) => { attach.add(Array.from(e.target.files || [])); e.target.value = ''; };
  const canSend = Boolean(draft.trim() || attach.items.length) && !thinking;

  const hidden = (
    <input ref={fileRef} type="file" multiple accept={ACCEPT} onChange={onPicked} style={{ display: 'none' }} />
  );

  if (hero) {
    return (
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--panel-bg)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-c)' }}>
        {hidden}
        <AttachTray items={attach.items} remove={attach.remove} error={attach.error} />
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onPaste={onPaste} rows={3} placeholder="Ask Mercedes anything…"
          style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'none', background: 'transparent', padding: '14px 16px', fontSize: 13.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 12px' }}>
          <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)' }}>Press Enter to send · drop a file anywhere</span>
          <div style={{ display: 'flex', gap: 7 }}>
            <IconBtn onClick={pick} title="Attach a photo, PDF or file"><Paperclip size={14} /></IconBtn>
            <IconBtn onClick={cycleMicLang} title={`Dictation language: ${micLang === 'en-AU' ? 'English' : 'Cantonese'} — click to switch`}>
              <span className="fg" style={{ fontSize: 11, fontWeight: 800 }}>{MIC_LANGS.find((l) => l.code === micLang)?.label}</span>
            </IconBtn>
            <IconBtn onClick={toggleMic} active={listening} title="Dictate">{listening ? <MicOff size={14} /> : <Mic size={14} />}</IconBtn>
            <IconBtn onClick={() => send()} primary disabled={!canSend} title="Send"><Send size={14} /></IconBtn>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ borderTop: '1px solid var(--border-c)' }}>
      {hidden}
      <AttachTray items={attach.items} remove={attach.remove} error={attach.error} />
      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <IconBtn onClick={pick} title="Attach a photo, PDF or file"><Paperclip size={15} /></IconBtn>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onPaste={onPaste} placeholder={listening ? 'Listening…' : 'Ask Mercedes anything…'}
          style={{ flex: 1, background: 'var(--panel-bg)', border: '1px solid var(--border-c)', borderRadius: 999, padding: '11px 16px', fontSize: 13.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
        <IconBtn onClick={cycleMicLang} title={`Dictation language: ${micLang === 'en-AU' ? 'English' : 'Cantonese'} — click to switch`}>
          <span className="fg" style={{ fontSize: 12, fontWeight: 800 }}>{MIC_LANGS.find((l) => l.code === micLang)?.label}</span>
        </IconBtn>
        <IconBtn onClick={toggleMic} active={listening} title="Dictate">{listening ? <MicOff size={15} /> : <Mic size={15} />}</IconBtn>
        <IconBtn onClick={() => send()} primary disabled={!canSend} title="Send"><Send size={15} /></IconBtn>
      </div>
    </div>
  );
}

// Same three-way split as the Dashboard's greeting, plus the sun/moon that
// went with it in the Claude Code layout this hero is modelled on.
function greetingFor(hour) {
  if (hour < 12) return { text: 'Good morning', icon: '🌅' };
  if (hour < 17) return { text: 'Good afternoon', icon: '☀️' };
  return { text: 'Good evening', icon: '🌙' };
}

function EmptyHero({ draft, setDraft, send, listening, toggleMic, micLang, cycleMicLang, attach }) {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const { text: greetText, icon: greetIcon } = greetingFor(new Date().getHours());
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <MercedesAvatar size={64} rounded={20} />
        <div className="cap" style={{ fontSize: 26, color: 'var(--text)', marginTop: 14 }}>
          {greetIcon} {greetText}{firstName ? `, ${firstName}` : ''}
        </div>
        <div className="fg" style={{ fontSize: 13, color: 'var(--text-mute)', marginTop: 4 }}>Mercedes here — let's get to work · Tell me what needs fixing</div>
      </div>
      <Composer variant="hero" draft={draft} setDraft={setDraft} send={send} listening={listening} toggleMic={toggleMic} micLang={micLang} cycleMicLang={cycleMicLang} thinking={false} attach={attach} />
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
  const store = useStore();
  const { user, org } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [micLang, setMicLang] = useState('en-AU');
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [voiceError, setVoiceError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState('');
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const dragDepth = useRef(0);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  // Load the signed-in user's own past threads once org/user are known —
  // this is what fills in HISTORY instead of it resetting to empty on every
  // reload. Not org-wide: each person sees only their own chats with her.
  useEffect(() => {
    if (!isSupabaseConfigured || !org?.id || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('mercedes_conversations')
        .select('id, title, messages, updated_at')
        .eq('org_id', org.id)
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) { console.error('mercedes_conversations load:', error); return; }
      setConversations((data || []).map((r) => ({ id: r.id, title: r.title, messages: r.messages || [], updatedAt: r.updated_at })));
    })();
    return () => { cancelled = true; };
  }, [org?.id, user?.id]);

  // Fire-and-forget upsert — the UI already has the optimistic state from
  // setConversations, this just makes it survive a reload. Attachment bytes
  // are stripped (see stripFilesForStorage) before they ever reach Postgres.
  const saveConversation = (id, title, msgs) => {
    if (!isSupabaseConfigured || !org?.id || !user?.id) return;
    supabase.from('mercedes_conversations')
      .upsert({ id, org_id: org.id, created_by: user.id, title: title || 'Untitled', messages: stripFilesForStorage(msgs), updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('mercedes_conversations save:', error); });
  };

  // Validate, shrink, encode. Everything that gets refused says why, at the
  // moment it's refused — nobody should discover a rejected file by noticing
  // she answered without looking at it.
  const addFiles = async (picked) => {
    if (!picked.length) return;
    setAttachError('');
    const rejects = [];
    const room = MAX_FILES - attachments.length;
    if (room <= 0) { setAttachError(`That's the limit — ${MAX_FILES} files per message.`); return; }
    if (picked.length > room) {
      rejects.push(`only the first ${room} of ${picked.length} were taken (${MAX_FILES} per message)`);
      picked = picked.slice(0, room);
    }

    const accepted = [];
    for (const file of picked) {
      if (!isAccepted(file)) { rejects.push(`${file.name} — she can't read that format`); continue; }
      // Images get shrunk below, so judge them on what comes out, not what
      // came in. Everything else is judged as-is.
      if (!isImage(file) && file.size > MAX_FILE_MB * 1024 * 1024) { rejects.push(`${file.name} — over ${MAX_FILE_MB}MB`); continue; }
      accepted.push(file);
    }

    try {
      const built = await Promise.all(accepted.map(toAttachment));
      // Encoded size is the only size that matters — an image that was 8MB on
      // disk may be 300KB by the time it has been downscaled.
      let budget = MAX_TOTAL_MB * 1024 * 1024 - attachments.reduce((n, f) => n + f.size, 0);
      const fits = [];
      for (const file of built) {
        if (file.size > budget) { rejects.push(`${file.name} — over the ${MAX_TOTAL_MB}MB total for one message`); continue; }
        budget -= file.size;
        fits.push(file);
      }
      if (fits.length) setAttachments((list) => [...list, ...fits]);
    } catch (err) {
      rejects.push(err.message);
    }
    if (rejects.length) setAttachError(`Skipped: ${rejects.join('; ')}.`);
  };

  const removeAttachment = (id) => {
    setAttachments((list) => list.filter((f) => f.id !== id));
    setAttachError('');
  };
  const attach = { items: attachments, add: addFiles, remove: removeAttachment, error: attachError };

  const newChat = () => { setActiveId(null); setMessages([]); setDraft(''); setAttachments([]); setAttachError(''); };
  const selectChat = (c) => { setActiveId(c.id); setMessages(c.messages || []); setAttachments([]); setAttachError(''); };
  const deleteChat = (e, id) => {
    e.stopPropagation();
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) newChat();
    if (isSupabaseConfigured && org?.id) {
      supabase.from('mercedes_conversations').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('mercedes_conversations delete:', error); });
    }
  };

  // Drag and drop over the whole chat panel. depth counting because dragleave
  // fires for every child element the cursor crosses on the way in.
  const onDragEnter = (e) => { e.preventDefault(); dragDepth.current += 1; setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(Array.from(e.dataTransfer?.files || []));
  };

  // MiniMax voice — real call to api/mercedes/speak.js; plays the base64 audio.
  const speak = async (text, idx) => {
    setVoiceError('');
    setSpeakingIdx(idx);
    try {
      const res = await fetch('/api/mercedes/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.ok) { setVoiceError(data.message || 'Voice synthesis failed'); setSpeakingIdx(null); return; }
      const audio = new Audio(`data:audio/${data.format};base64,${data.audioBase64}`);
      audio.onended = () => setSpeakingIdx(null);
      audio.onerror = () => { setVoiceError('Audio failed to play'); setSpeakingIdx(null); };
      await audio.play();
    } catch (err) { setVoiceError(err.message); setSpeakingIdx(null); }
  };

  const send = async (text) => {
    const q = (text ?? draft).trim();
    const files = attachments;
    // A message is now sendable on words, files, or both.
    if ((!q && !files.length) || thinking) return;

    let convId = activeId;
    let convTitle = conversations.find((c) => c.id === convId)?.title;
    if (!convId) {
      convId = isSupabaseConfigured ? crypto.randomUUID() : 'c-' + Date.now().toString(36);
      convTitle = q.slice(0, 40) || files[0]?.name?.slice(0, 40) || 'Attachment';
      setConversations((cs) => [{ id: convId, title: convTitle, messages: [] }, ...cs]);
      setActiveId(convId);
    }
    const outgoing = { from: 'user', text: q, ...(files.length ? { files } : {}) };
    const history = [...messages, outgoing];
    setMessages(history);
    setDraft('');
    setAttachments([]);
    setAttachError('');
    const persist = (msgs) => {
      setConversations((cs) => cs.map((c) => (c.id === convId ? { ...c, messages: msgs, title: c.title || convTitle } : c)));
      saveConversation(convId, convTitle, msgs);
    };
    persist(history);

    const finish = (botText) => {
      const next = [...history, { from: 'bot', text: botText }];
      setMessages(next); persist(next);
      if (voiceOn) speak(botText, next.length - 1);
    };

    if (!isSupabaseConfigured) { finish(buildReply(q, store, files.length)); return; }
    setThinking(true);
    try {
      // `preview` is a data URL kept only for rendering the bubble — the wire
      // format is name/type/size/data, and shipping both would double the
      // payload for no reason.
      const wire = trimForWire(history).map((m) => (m.files?.length
        ? { ...m, files: m.files.map(({ name, type, size, data }) => ({ name, type, size, data })) }
        : m));
      const { data, error } = await supabase.functions.invoke(MERCEDES_FN, { body: { messages: wire } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      finish(data.content);
    } catch (err) {
      console.error(`${MERCEDES_FN}:`, err);
      finish(buildReply(q, store, files.length)); // graceful fall back to the data-driven engine
    } finally { setThinking(false); }
  };

  const startRecognition = (lang) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceError('this browser has no speech recognition. Chrome works.'); return; }
    const rec = new SR();
    rec.lang = lang; rec.continuous = true; rec.interimResults = false;
    rec.onstart = () => { setVoiceError(''); setListening(true); };
    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' ';
      if (t.trim()) setDraft((d) => (d + ' ' + t).trim());
    };
    // Guard against a just-replaced recognizer's async callbacks clobbering
    // the one that superseded it (see cycleMicLang's live-switch restart).
    //
    // Surface the failure rather than dying quietly: a wrong lang tag makes
    // Chrome fail with 'language-not-supported' and otherwise look identical
    // to a working mic that just isn't hearing you.
    rec.onerror = (e) => {
      if (recognitionRef.current !== rec) return;
      const kind = e?.error;
      if (kind === 'language-not-supported') setVoiceError(`${lang} isn't supported by this browser's speech engine.`);
      else if (kind === 'not-allowed' || kind === 'service-not-allowed') setVoiceError('microphone permission is blocked for this site.');
      else if (kind === 'no-speech') setVoiceError('did not catch anything. Try again.');
      else if (kind && kind !== 'aborted') setVoiceError(kind);
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onend = () => { if (recognitionRef.current === rec) { setListening(false); recognitionRef.current = null; } };
    recognitionRef.current = rec;
    try { rec.start(); } catch { /* ignore */ }
  };

  const toggleMic = async () => {
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    startRecognition(micLang);
  };

  // Switching language while the mic is live used to be a dead click (the
  // button was disabled during listening) — the most natural way to hit it
  // is start dictating, hear it come out wrong, then reach for the toggle.
  // So: mid-listen, stop the current recognizer and restart immediately in
  // the new language instead of requiring stop-switch-start.
  const cycleMicLang = () => {
    // Derived from MIC_LANGS rather than hardcoded, so the codes only ever
    // live in one place.
    const i = MIC_LANGS.findIndex((l) => l.code === micLang);
    const next = MIC_LANGS[(i + 1) % MIC_LANGS.length].code;
    setMicLang(next);
    const rec = recognitionRef.current;
    if (listening && rec) {
      // Starting a fresh recognizer before Chrome has actually released the
      // old one throws InvalidStateError, so chain the restart off the old
      // one's own onend rather than firing both at once.
      rec.onend = () => startRecognition(next);
      rec.onerror = () => startRecognition(next);
      try { rec.stop(); } catch { startRecognition(next); }
    }
  };

  return (
    <div style={{ display: 'flex', gap: 14, padding: '6px 24px 20px', height: 'calc(100vh - 128px)', minHeight: 560 }}>
      {/* Left rail */}
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--card-bg)', borderRadius: 20, padding: 12, boxShadow: '0 1px 3px rgba(32,30,29,.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MercedesAvatar size={26} rounded={8} />
            <span className="fg" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Mercedes</span>
            <span className="fg" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', color: ACCENT, background: 'rgba(198,113,57,.14)', borderRadius: 5, padding: '2px 5px' }}>AI</span>
            {/* Only ever shows on a ?agent=v2 tab, so you always know which one you are talking to. */}
            {MERCEDES_FN === 'mercedes' && (
              <span className="fg" title="Harnessed rewrite. Add ?agent=v1 to the URL for the original." style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', color: '#2f7d55', background: 'rgba(47,125,85,.14)', borderRadius: 5, padding: '2px 5px' }}>V2</span>
            )}
          </div>
          <button onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? 'Auto-speak replies: on' : 'Auto-speak replies: off'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: voiceOn ? ACCENT : 'var(--text-mute2)', display: 'flex' }}>
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
              <MessageSquare size={22} color="var(--text-mute2)" />
              <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)' }}>No chats yet</span>
            </div>
          ) : conversations.map((c) => (
            <div key={c.id} onClick={() => selectChat(c)} className="mercedes-history-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 10, cursor: 'pointer', background: activeId === c.id ? 'rgba(198,113,57,.1)' : undefined }}>
              <MessageSquare size={14} color={activeId === c.id ? ACCENT : 'var(--text-mute2)'} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fg" style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Untitled'}</div>
                {c.updatedAt && <div className="fg" style={{ fontSize: 9.5, color: 'var(--text-mute2)' }}>{relativeTime(c.updatedAt)}</div>}
              </div>
              <button onClick={(e) => deleteChat(e, c.id)} title="Delete" className="mercedes-history-delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mute2)', display: 'flex', flexShrink: 0 }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <section
        onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}
        style={{ position: 'relative', flex: 1, minWidth: 0, background: 'var(--card-bg)', borderRadius: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {dragging && (
          <div style={{ position: 'absolute', inset: 8, zIndex: 5, borderRadius: 16, border: `2px dashed ${ACCENT}`, background: 'rgba(198,113,57,.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
            <Paperclip size={26} color={ACCENT} />
            <span className="fg" style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Drop it here and Mercedes will take a look</span>
            <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute)' }}>Photos, PDFs and text files · up to {MAX_FILES} at a time</span>
          </div>
        )}
        {messages.length === 0 ? (
          <EmptyHero draft={draft} setDraft={setDraft} send={send} listening={listening} toggleMic={toggleMic} micLang={micLang} cycleMicLang={cycleMicLang} attach={attach} />
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((m, i) => (
                <Bubble key={i} m={m} onSpeak={m.from === 'bot' ? () => speak(m.text, i) : undefined} speaking={speakingIdx === i} />
              ))}
              {thinking && <Bubble m={{ from: 'bot' }} thinking />}
              <div ref={bottomRef} />
            </div>
            {voiceError && <div className="fg" style={{ fontSize: 11.5, color: ACCENT, fontWeight: 600, padding: '0 16px 6px' }}>Voice: {voiceError}</div>}
            <Composer draft={draft} setDraft={setDraft} send={send} thinking={thinking} listening={listening} toggleMic={toggleMic} micLang={micLang} cycleMicLang={cycleMicLang} attach={attach} />
          </>
        )}
      </section>
    </div>
  );
}
