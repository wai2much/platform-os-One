import { useState } from 'react';

/**
 * Reviews — core screen. Aggregate rating + star breakdown, individual review
 * list with a real inline reply flow (open textarea -> Send/Cancel -> shows
 * "Replied"). Faithful to the prototype; sample reviews.
 */
const BREAKDOWN = [[5, 68, 34], [4, 20, 10], [3, 8, 4], [2, 2, 1], [1, 2, 1]];

const SEED = [
  { id: 'rv1', name: 'M. Petrakis', rating: 5, platform: 'Google', date: '24 Jul', text: 'Quick turnaround on the alignment, explained everything clearly. Will be back.', replied: true, sentReply: 'Thanks so much for the kind words, see you next time!' },
  { id: 'rv2', name: 'A. Costa', rating: 5, platform: 'Google', date: '20 Jul', text: 'Best tyre shop in Thomastown, fair pricing and no upselling.', replied: true, sentReply: 'Really appreciate that, thank you!' },
  { id: 'rv3', name: 'T. Nguyen', rating: 3, platform: 'Facebook', date: '15 Jul', text: 'Good work but took longer than quoted. Would appreciate better time estimates.', replied: false },
  { id: 'rv4', name: 'S. Bianchi', rating: 5, platform: 'Google', date: '10 Jul', text: 'Friendly staff, honest advice on what actually needed doing.', replied: false },
  { id: 'rv5', name: 'L. Farrow', rating: 4, platform: 'Google', date: '2 Jul', text: 'Solid service, a bit of a wait on a Saturday morning but worth it.', replied: false },
];

export function Reviews() {
  const [reviews, setReviews] = useState(SEED);
  const [replyingId, setReplyingId] = useState(null);
  const [draft, setDraft] = useState('');

  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const total = reviews.length;

  const openReply = (id) => { setReplyingId(id); setDraft(''); };
  const send = (id) => {
    const text = draft.trim();
    if (!text) return;
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, replied: true, sentReply: text } : r)));
    setReplyingId(null);
  };

  return (
    <div style={{ padding: '6px 30px 26px', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14, alignItems: 'start' }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 22, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="cap" style={{ fontSize: 40, color: 'var(--text)', lineHeight: 1 }}>{avg}</div>
          <div className="fg" style={{ fontSize: 14, color: '#c67139', letterSpacing: '.05em', marginTop: 4 }}>★★★★★</div>
          <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 5 }}>{total} reviews</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BREAKDOWN.map(([star, pct, count]) => (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, width: 10 }}>{star}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--panel-bg)', borderRadius: 999 }}><div style={{ width: `${pct}%`, height: 6, background: '#c67139', borderRadius: 999 }} /></div>
              <span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, width: 16, textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ background: 'var(--card-bg)', borderRadius: 18, padding: '16px 18px', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div><span className="fg" style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700 }}>{r.name}</span><span className="fg" style={{ fontSize: 11, color: 'var(--text-mute2)', fontWeight: 600, marginLeft: 8 }}>{r.platform} · {r.date}</span></div>
              <span className="fg" style={{ fontSize: 12.5, color: '#c67139', letterSpacing: '.04em' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            </div>
            <div className="fg" style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.55, marginBottom: 10 }}>{r.text}</div>

            {r.replied ? (
              <>
                <div className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#7a8a5e', marginBottom: 6 }}>Replied</div>
                <div style={{ background: 'var(--panel-bg)', borderRadius: 10, padding: '9px 11px' }}><span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.sentReply}</span></div>
              </>
            ) : replyingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Write a reply…" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <span onClick={() => send(r.id)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>Send</span>
                  <span onClick={() => setReplyingId(null)} className="fg" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-mute2)', cursor: 'pointer' }}>Cancel</span>
                </div>
              </div>
            ) : (
              <span onClick={() => openReply(r.id)} className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>Reply</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
