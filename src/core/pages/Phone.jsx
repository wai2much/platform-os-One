import { useEffect, useRef, useState } from 'react';

/**
 * Phone (3CX) — core screen. Live call card with a REAL ticking timer,
 * Transfer team-picker, End call -> wrap-up modal (outcome tags + note),
 * queue with per-caller Pick up, recent calls with playable progress bar,
 * stats + team status. Faithful to the prototype.
 */
const TRANSFER_TARGETS = ['Sam · Ext 102', 'Dean · Ext 103', 'Wai · Ext 100'];
const OUTCOMES = ['Booked job', 'Info only', 'Follow-up needed', 'No answer'];

// No telephony data reaches this screen yet. The 3CX trunk exists but nothing
// routes to it, api/grok/voice-webhook.js has never received an event, and
// voice_agent_events is empty. This used to render a fake live call, a caller
// waiting 42 seconds, and five invented call records — a fake queue is
// actively misleading on a front-desk screen, since staff may think someone
// is holding. Everything starts empty until real call events arrive.
const QUEUE_SEED = [];
const CALL_LOG = [];

function fmtTimer(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function Phone() {
  const [live, setLive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [wrapNote, setWrapNote] = useState('');
  const [queue, setQueue] = useState(QUEUE_SEED);
  const [playingIdx, setPlayingIdx] = useState(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (playingIdx === null) { setProgress(0); return; }
    setProgress(0);
    const id = setInterval(() => setProgress((p) => (p >= 100 ? (clearInterval(id), setPlayingIdx(null), 0) : p + 4)), 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIdx]);

  const endCall = () => { setShowTransfer(false); setShowWrapUp(true); };
  const saveWrapUp = () => { setLive(false); setShowWrapUp(false); };
  const pickUp = (i) => setQueue((q) => q.filter((_, j) => j !== i));

  return (
    <div style={{ padding: '6px 30px 26px', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {live ? (
          <div style={{ background: 'var(--ink)', borderRadius: 24, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#7a8a5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f5ead8' }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}><span className="fg" style={{ fontSize: 11, letterSpacing: '.14em', color: '#c9d4b5', fontWeight: 700 }}>LIVE CALL</span><span className="fg" style={{ fontSize: 10, color: '#a8b48e', fontWeight: 600 }}>{fmtTimer(seconds)}</span></div>
              <div className="cap" style={{ color: '#f5ead8', fontSize: 19, lineHeight: 1.2 }}>Incoming call</div>
              <div className="fg" style={{ fontSize: 11.5, color: '#a49a8c', marginTop: 4 }}>Connected line</div>
            </div>
            <span onClick={() => setShowTransfer((v) => !v)} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#14110e', background: '#c67139', borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}>Transfer</span>
            <span onClick={endCall} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: '#7a2a2a', borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}>End call</span>
            {showTransfer && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 24, background: 'var(--card-bg)', borderRadius: 14, padding: 8, boxShadow: '0 12px 30px rgba(32,30,29,.3)', zIndex: 20, minWidth: 180 }}>
                {TRANSFER_TARGETS.map((t) => <div key={t} onClick={() => setShowTransfer(false)} style={{ padding: '9px 12px', borderRadius: 9, cursor: 'pointer' }}><span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{t}</span></div>)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: 24, padding: '22px 24px', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
            <div className="fg" style={{ fontSize: 13, color: 'var(--text-mute)', fontWeight: 600 }}>{seconds > 0 ? `No live call. ${fmtTimer(seconds)} logged${outcome ? ` — ${outcome}` : ''}.` : 'No live call. Call activity appears here once the phone system is connected.'}</div>
          </div>
        )}

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Queue</span><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{queue.length} waiting</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {queue.map((q, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{q.caller}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#c67139', border: '1px solid #c67139', borderRadius: 999, padding: '3px 10px' }}>Waiting {q.waiting}s</span>
                  <span onClick={() => pickUp(i)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#7a8a5e', cursor: 'pointer' }}>Pick up</span>
                </div>
              </div>
            ))}
            {!queue.length && <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)' }}>Queue is empty.</div>}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div style={{ padding: '17px 17px 12px' }}><span className="cap" style={{ fontSize: 15, color: 'var(--text)' }}>Recent calls</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '.6fr 1.2fr .7fr .7fr .5fr', gap: 12, padding: '0 17px 10px' }}>
            {['TIME', 'CALLER', 'DURATION', 'OUTCOME', ''].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
          </div>
          {CALL_LOG.length === 0 && (
            <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', padding: '12px 17px 16px', borderTop: '1px solid var(--border-c)', lineHeight: 1.6 }}>
              No calls logged. This fills in once the 3CX line is routed through Platform OS.
            </div>
          )}
          {CALL_LOG.map((c, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border-c)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '.6fr 1.2fr .7fr .7fr .5fr', gap: 12, padding: '11px 17px', alignItems: 'center' }}>
                <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{c.time}</span>
                <span className="fg" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{c.caller}</span>
                <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{c.duration}</span>
                <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: c.color }}>{c.outcome}</span>
                <span onClick={() => setPlayingIdx(playingIdx === i ? null : i)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#c67139', cursor: 'pointer', justifySelf: 'end' }}>{playingIdx === i ? 'Stop' : 'Play'}</span>
              </div>
              {playingIdx === i && (
                <div style={{ padding: '0 17px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border-c)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${progress}%`, background: '#c67139', borderRadius: 2 }} /></div>
                  <span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600, flexShrink: 0 }}>{c.duration}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[['Calls today', 'var(--text)'], ['Avg wait', '#7a8a5e'], ['Missed today', '#c67139'], ['Answer rate', 'var(--text)']].map(([label]) => (
            <div key={label}><div className="cap" style={{ color: 'var(--text-mute2)', fontSize: 26, lineHeight: 1 }}>&mdash;</div><div className="fg" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 7, fontWeight: 600 }}>{label}</div></div>
          ))}
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 17, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
          <div className="cap" style={{ fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>Team status</div>
          <div className="fg" style={{ fontSize: 12.5, color: 'var(--text-mute2)', lineHeight: 1.6 }}>Extensions and live status appear here once the 3CX phone system is connected.</div>
        </div>
      </div>

      {showWrapUp && (
        <div onClick={() => setShowWrapUp(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 400 }}>
            <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>Call wrap-up</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {OUTCOMES.map((o) => (
                  <span key={o} onClick={() => setOutcome(o)} className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: outcome === o ? '#fff' : 'var(--text-soft)', background: outcome === o ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>{o}</span>
                ))}
              </div>
              <textarea value={wrapNote} onChange={(e) => setWrapNote(e.target.value)} rows={2} placeholder="Quick note (optional)…" style={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <span onClick={() => setShowWrapUp(false)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
              <span onClick={saveWrapUp} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--ink)', borderRadius: 999, padding: '9px 20px', cursor: 'pointer' }}>Log &amp; end call</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
