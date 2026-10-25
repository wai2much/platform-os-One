import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../auth.jsx';

/**
 * Comms — unified SMS/Email inbox.
 *
 * There is no messaging backend yet: no SMS gateway, no mailbox connection,
 * nothing that would put a real customer message on this screen. It used to
 * open with four fabricated conversations (T. Nguyen chasing a Ranger,
 * A. Costa asking about alignment) written to look like live customer
 * traffic. With real customers now in the system, staff could reasonably
 * believe someone was waiting on a reply that doesn't exist.
 *
 * SMS is now wired (26 Oct 2026) through LinkedUp: threads come from the
 * sms_messages table, Send goes through /api/sms/send (key server-side).
 * Until LinkedUp's API details are in, the screen says 'SMS not connected
 * yet' and Send refuses. Nothing is ever shown that didn't really happen.
 */
const normalizeAuMobile = (input) => {
  const d = String(input || '').replace(/[^\d+]/g, '');
  const m = d.match(/^\+?614(\d{8})$/) || d.match(/^04(\d{8})$/);
  return m ? `+614${m[1]}` : null;
};
const fmtAu = (n) => (/^\+614\d{8}$/.test(n) ? `0${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : n);

// sms_messages rows (supabase/add-sms-messages.sql) -> one thread per number.
function groupThreads(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.contact)) by.set(r.contact, { id: r.contact, name: fmtAu(r.contact), phone: fmtAu(r.contact), channel: 'SMS', messages: [], unread: false, resolved: false, last: '' });
    const t = by.get(r.contact);
    t.messages.push({ from: r.direction === 'out' ? 'us' : 'them', text: r.body });
    if (r.direction === 'in' && !r.read) t.unread = true;
    t.resolved = r.resolved; t.last = r.created_at;
  }
  return [...by.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

const QUICK_REPLIES = ["It's ready for pickup", 'Running about 30 min behind', "I'll check and call you back"];

// Hoisted to module scope (found during the 13 Aug health check) — this was
// previously defined inside Comms(), the same "component defined inside a
// parent's render" pattern that broke job-card input focus. Low-risk here
// only because Comms has no real backend yet; fixed anyway before it bites.
function Toggle({ on, onClick }) {
  return (
    <span onClick={onClick} className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', cursor: 'pointer', borderRadius: 999, padding: '2px 9px', background: on ? '#7a8a5e' : 'var(--text-mute2)' }}>{on ? 'On' : 'Off'}</span>
  );
}

export function Comms() {
  const { org } = useAuth();
  const [rows, setRows] = useState([]);
  const [sms, setSms] = useState({ checked: false, configured: false });
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [newTo, setNewTo] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [notif, setNotif] = useState({ sms: true, email: true, forward: true });

  const load = useCallback(async () => {
    if (!supabase || !org?.id) return;
    const { data, error } = await supabase.from('sms_messages').select('*').eq('org_id', org.id).order('created_at', { ascending: true }).limit(2000);
    // Table not created yet (migration unapplied) -> just stay empty.
    if (error) { setLoadError(error.message); return; }
    setLoadError(''); setRows(data || []);
  }, [org?.id]);

  useEffect(() => {
    fetch('/api/sms/status').then((r) => r.json()).then((d) => setSms({ checked: true, configured: !!d.configured })).catch(() => setSms({ checked: true, configured: false }));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const threads = useMemo(() => groupThreads(rows), [rows]);
  const active = threads.find((t) => t.id === activeId) || (activeId ? { id: activeId, name: activeId, phone: activeId, channel: 'SMS', messages: [], resolved: false } : null);
  const term = search.trim().toLowerCase();
  const visible = threads.filter((t) => !term || t.name.toLowerCase().includes(term) || t.messages.some((m) => m.text.toLowerCase().includes(term)));

  const open = async (id) => {
    setActiveId(id); setSendError('');
    const t = threads.find((x) => x.id === id);
    if (supabase && t?.unread) {
      await supabase.from('sms_messages').update({ read: true }).eq('org_id', org.id).eq('contact', id).eq('direction', 'in').eq('read', false);
      load();
    }
  };

  const startNew = () => {
    const n = normalizeAuMobile(newTo);
    if (!n) { setSendError('Enter an Australian mobile, e.g. 0412 345 678'); return; }
    setNewTo(''); setActiveId(n); setSendError('');
  };

  const send = async (text) => {
    const msg = (text ?? draft).trim();
    if (!msg || !activeId || sending) return;
    if (!sms.configured) { setSendError('SMS not connected yet. Nothing was sent.'); return; }
    setSending(true); setSendError('');
    try {
      const { data: s } = await supabase.auth.getSession();
      const r = await fetch('/api/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.session?.access_token || ''}` }, body: JSON.stringify({ to: activeId, body: msg }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setSendError(d.message || `Send failed (HTTP ${r.status}). Nothing was sent.`); return; }
      setDraft(''); load();
    } catch (e) { setSendError(`Send failed: ${e.message}. Nothing was sent.`); }
    finally { setSending(false); }
  };

  const toggleResolved = async () => {
    if (!supabase || !active) return;
    await supabase.from('sms_messages').update({ resolved: !active.resolved }).eq('org_id', org.id).eq('contact', active.id);
    load();
  };
  const resolved = { [activeId]: active?.resolved };

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 4 }}>
        <span onClick={() => setShowSettings((v) => !v)} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>{showSettings ? 'Hide settings' : 'Notification settings'}</span>
      </div>

      {showSettings && (
        <div style={{ paddingBottom: 12 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: '18px 20px', boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>Notification settings</div>
            {[['New SMS alerts', 'sms'], ['New email alerts', 'email'], ['Auto-forward unresolved to London after hours', 'forward']].map(([label, key]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{label}</span>
                <Toggle on={notif[key]} onClick={() => setNotif((n) => ({ ...n, [key]: !n[key] }))} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>Quiet hours</span>
              <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute2)', fontWeight: 600 }}>9pm – 7am</span>
            </div>
          </div>
        </div>
      )}

      {sms.checked && !sms.configured && (
        <div style={{ paddingBottom: 12 }}>
          <div className="fg" style={{ background: 'var(--card-bg)', borderRadius: 20, padding: '14px 20px', boxShadow: '0 1px 3px rgba(32,30,29,.06)', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: '#c67139' }}>SMS not connected yet.</span> Waiting on LinkedUp's API details. Texts can't be sent or received until then. Email isn't connected either.
          </div>
        </div>
      )}
      {loadError && !/does not exist|schema cache/i.test(loadError) && (
        <div className="fg" style={{ paddingBottom: 10, fontSize: 12, color: '#c67139', fontWeight: 600 }}>Couldn't load messages: {loadError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.6fr', gap: 14, flex: 1, minHeight: 0 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 12, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={newTo} onChange={(e) => setNewTo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startNew()} placeholder="New text to mobile…" style={{ flex: 1, minWidth: 0, background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '9px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
            <span onClick={startNew} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#c67139', cursor: 'pointer', alignSelf: 'center', padding: '0 6px' }}>Start</span>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '9px 14px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', marginBottom: 6 }} />
          {visible.map((t) => (
            <div key={t.id} onClick={() => open(t.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', borderRadius: 12, cursor: 'pointer', background: t.id === activeId ? 'var(--panel-bg)' : 'transparent' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{t.name}</span>
                  <span className="fg" style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-mute2)', background: 'var(--panel-bg)', borderRadius: 5, padding: '1px 5px' }}>{t.channel}</span>
                </div>
                <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.messages[t.messages.length - 1]?.text}</div>
              </div>
              {t.unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c67139', flexShrink: 0 }} />}
            </div>
          ))}
          {!visible.length && (
            <div className="fg" style={{ padding: 16, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center', lineHeight: 1.6 }}>
              {threads.length === 0 && !term
                ? (sms.configured ? 'No texts yet.' : 'No conversations yet. Messages will appear here once SMS is connected.')
                : 'No matches'}
            </div>
          )}
        </div>

        {active && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>{active.name}</div>
                <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 2 }}>{active.phone} · via {active.channel}</div>
              </div>
              <span onClick={toggleResolved} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>{resolved[activeId] ? 'Reopen' : 'Mark resolved'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', flex: 1 }}>
              {active.messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.from === 'us' ? 'flex-end' : 'flex-start' }}>
                  <div className="fg" style={{ background: m.from === 'us' ? '#201e1d' : 'var(--panel-bg)', color: m.from === 'us' ? '#f5ead8' : 'var(--text)', borderRadius: 14, padding: '9px 13px', fontSize: 13, maxWidth: '75%' }}>{m.text}</div>
                </div>
              ))}
            </div>
            {resolved[activeId] && (
              <div className="fg" style={{ fontSize: 11.5, color: '#7a8a5e', fontWeight: 700, textAlign: 'center' }}>● Resolved</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {QUICK_REPLIES.map((qr) => <span key={qr} onClick={() => send(qr)} className="fg" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-soft)', background: 'var(--panel-bg)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>{qr}</span>)}
            </div>
            {sendError && <div className="fg" style={{ fontSize: 11.5, color: '#c67139', fontWeight: 600 }}>{sendError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a message…" style={{ flex: 1, background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '10px 15px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
              <span onClick={() => send()} className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending…' : 'Send'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
