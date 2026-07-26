import { useState } from 'react';

/**
 * Comms — unified SMS/Email inbox. Faithful to the prototype: searchable
 * thread list, active thread with real message state, quick-reply chips,
 * live send, and per-thread Mark resolved. Sample threads/messages for now.
 */
const THREADS = [
  { id: 't1', name: 'T. Nguyen', phone: '0412 663 921', channel: 'SMS', unread: true,
    messages: [
      { from: 'them', text: "Hey, is the Ranger ready? Was hoping to grab it before 5" },
      { from: 'us', text: "Just checking with the tech now, one sec" },
    ] },
  { id: 't2', name: 'A. Costa', phone: 'a.costa@email.com', channel: 'Email', unread: false,
    messages: [
      { from: 'them', text: "Can you confirm the alignment is included in the Service B price?" },
      { from: 'us', text: "Yep, alignment check is included — no extra charge unless it's out of spec." },
      { from: 'them', text: "Perfect, thank you!" },
    ] },
  { id: 't3', name: 'L. Farrow', phone: '0418 907 233', channel: 'SMS', unread: true,
    messages: [
      { from: 'them', text: "Do you have 2 of the 225/65/R17 in stock for the fleet job?" },
    ] },
  { id: 't4', name: 'M. Petrakis', phone: 'm.petrakis@email.com', channel: 'Email', unread: false,
    messages: [
      { from: 'them', text: "Following up on invoice #1039 — will pay Friday, apologies for the delay." },
      { from: 'us', text: "No worries, thanks for the heads up!" },
    ] },
];

const QUICK_REPLIES = ["It's ready for pickup", 'Running about 30 min behind', "I'll check and call you back"];

export function Comms() {
  const [threads, setThreads] = useState(THREADS);
  const [activeId, setActiveId] = useState(THREADS[0].id);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [resolved, setResolved] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [notif, setNotif] = useState({ sms: true, email: true, forward: true });

  const active = threads.find((t) => t.id === activeId);
  const term = search.trim().toLowerCase();
  const visible = threads.filter((t) => !term || t.name.toLowerCase().includes(term) || t.messages.some((m) => m.text.toLowerCase().includes(term)));

  const open = (id) => {
    setActiveId(id);
    setThreads((list) => list.map((t) => (t.id === id ? { ...t, unread: false } : t)));
  };

  const send = (text) => {
    const msg = (text ?? draft).trim();
    if (!msg) return;
    setThreads((list) => list.map((t) => (t.id === activeId ? { ...t, messages: [...t.messages, { from: 'us', text: msg }] } : t)));
    setDraft('');
  };

  const toggleResolved = () => setResolved((r) => ({ ...r, [activeId]: !r[activeId] }));

  const Toggle = ({ on, onClick }) => (
    <span onClick={onClick} className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', cursor: 'pointer', borderRadius: 999, padding: '2px 9px', background: on ? '#7a8a5e' : 'var(--text-mute2)' }}>{on ? 'On' : 'Off'}</span>
  );

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

      <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.6fr', gap: 14, flex: 1, minHeight: 0 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 12, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
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
          {!visible.length && <div className="fg" style={{ padding: 16, fontSize: 12.5, color: 'var(--text-mute)', textAlign: 'center' }}>No matches</div>}
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
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a message…" style={{ flex: 1, background: 'var(--panel-bg)', border: 'none', borderRadius: 999, padding: '10px 15px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' }} />
              <span onClick={() => send()} className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: '#201e1d', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Send</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
