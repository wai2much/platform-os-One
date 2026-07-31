import { useState } from 'react';
import { useStore } from '@/core/store';

const SVC = { Service: 'Logbook service', Brakes: 'Brakes', Diagnostic: 'Diagnostic', Tyres: 'Tyres' };

/**
 * Bookings — core screen. Calendar (bay grid) / List tab switcher, appointment
 * type chips, and a per-row Send-reminder action.
 *
 * The calendar grid used to render three hardcoded blocks (BMW 320i, Golf GTI,
 * Hilux SR5) regardless of what was actually booked, so it showed phantom jobs
 * next to the real list view. It now derives from the same bookings the list
 * uses — an empty day renders as an empty grid.
 */
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const APPT_TYPES = ['Service', 'Tyres & alignment', 'Brakes', 'Diagnostic', 'Roadworthy'];

const BAY_COLORS = ['#c67139', '#7a8a5e', '#b5703f'];

/** "1:00"/"13:15"/"8:30am" -> 24h hour int, or null if unparseable. */
function parseHour(time) {
  if (!time) return null;
  const m = String(time).trim().match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const suffix = (m[3] || '').toLowerCase();
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  // Shop hours run 8-16, so a bare 1-6 means afternoon, not 1am.
  if (!suffix && h >= 1 && h <= 6) h += 12;
  return h;
}

/** Bay label ("Bay 2", "2", "TBC") -> column index, or null when unassigned. */
function parseBay(bay) {
  const m = String(bay || '').match(/(\d+)/);
  if (!m) return null;
  const idx = parseInt(m[1], 10) - 1;
  return idx >= 0 && idx <= 2 ? idx : null;
}

function Tab({ label, active, onClick }) {
  return <span className="fg" onClick={onClick} style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 999, padding: '7px 16px', color: active ? '#fff' : 'var(--text-soft)', background: active ? '#c67139' : 'transparent' }}>{label}</span>;
}

const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function NewBookingModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ customer: '', phone: '', vehicle: '', service: 'Service', time: '', bay: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New booking</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.customer} onChange={set('customer')} placeholder="Customer name" style={inp} />
          <input value={form.phone} onChange={set('phone')} placeholder="Phone" style={inp} />
          <input value={form.vehicle} onChange={set('vehicle')} placeholder="Vehicle" style={inp} />
          <select value={form.service} onChange={set('service')} style={inp}>
            {Object.keys(SVC).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={form.time} onChange={set('time')} placeholder="Time (e.g. 09:30)" style={inp} />
          <input value={form.bay} onChange={set('bay')} placeholder="Bay (e.g. Bay 1)" style={inp} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <span onClick={onClose} className="fg" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
          <span onClick={() => form.customer.trim() && form.vehicle.trim() && onCreate(form)}
            className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.customer.trim() && form.vehicle.trim() ? '#c67139' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 20px', cursor: form.customer.trim() && form.vehicle.trim() ? 'pointer' : 'not-allowed' }}>
            Add booking
          </span>
        </div>
      </div>
    </div>
  );
}

export function Bookings() {
  const { startJobCard, bookings, addBooking } = useStore();
  const [view, setView] = useState('calendar');
  const [reminded, setReminded] = useState({});
  const [creating, setCreating] = useState(false);

  // Only bookings that resolve to a real hour AND an assigned bay can be
  // placed on the grid. Portal bookings arrive with bay 'TBC', so they show
  // in the List view until someone assigns them — better than guessing a bay
  // and having the board disagree with reality.
  const calBlocks = bookings
    .map((b) => ({ ...b, hour: parseHour(b.time), bay: parseBay(b.bay) }))
    .filter((b) => b.hour !== null && b.bay !== null);
  const unplaced = bookings.length - calBlocks.length;

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--panel-bg)', borderRadius: 999, padding: 3 }}>
          <Tab label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
          <Tab label="List" active={view === 'list'} onClick={() => setView('list')} />
        </div>
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: '#c67139', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New booking</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {APPT_TYPES.map((a) => <span key={a} className="fg" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-soft)', background: 'var(--panel-bg)', borderRadius: 999, padding: '6px 13px' }}>{a}</span>)}
      </div>

      {view === 'calendar' && unplaced > 0 && (
        <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>
          {unplaced} booking{unplaced === 1 ? '' : 's'} not on the board — no bay assigned yet. See the List tab.
        </div>
      )}

      {view === 'calendar' ? (
        <div style={{ background: 'var(--card-bg)', borderRadius: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(3,1fr)' }}>
            <div />
            {['Bay 1', 'Bay 2', 'Bay 3'].map((b) => (
              <div key={b} style={{ padding: 12, borderBottom: '1px solid var(--border-c)', borderLeft: '1px solid var(--border-c)' }}><span className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{b}</span></div>
            ))}
          </div>
          {HOURS.map((h) => (
            <div key={h} style={{ display: 'grid', gridTemplateColumns: '64px repeat(3,1fr)' }}>
              <div style={{ padding: '18px 10px 0', textAlign: 'right' }}><span className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', fontWeight: 600 }}>{h}:00</span></div>
              {[0, 1, 2].map((bay) => {
                const blk = calBlocks.find((c) => c.hour === h && c.bay === bay);
                return (
                  <div key={bay} style={{ minHeight: 56, borderTop: '1px solid var(--border-c)', borderLeft: '1px solid var(--border-c)', padding: 6 }}>
                    {blk && (
                      <div style={{ background: BAY_COLORS[bay % BAY_COLORS.length], borderRadius: 10, padding: '8px 10px', overflow: 'hidden' }}>
                        <div className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{blk.vehicle || blk.customer || 'Booking'}</div>
                        <div className="fg" style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>{blk.service}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bookings.map((b) => (
            <div key={b.id} style={{ background: 'var(--card-bg)', borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
              <span className="fg" style={{ fontSize: 13, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '6px 13px', fontWeight: 700 }}>{b.time}</span>
              <div style={{ flex: 1 }}>
                <div className="fg" style={{ fontSize: 14.5, color: 'var(--text)', fontWeight: 700 }}>{b.vehicle}</div>
                <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600, marginTop: 3 }}>{b.customer} · {b.service}</div>
              </div>
              {b.source === 'portal' && <span className="fg" style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '3px 9px' }}>Online booking</span>}
              {b.bay && <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)', border: '1.4px solid var(--border-c)', borderRadius: 999, padding: '4px 12px' }}>{b.bay}</span>}
              <span className="fg" onClick={() => startJobCard({ customer: b.customer, vehicle: (b.vehicle || '').split(' · ')[0], workTypes: SVC[b.service] ? { [SVC[b.service]]: true } : {} })} style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: '#5a6a3c', borderRadius: 999, padding: '6px 13px', cursor: 'pointer' }}>Start job card →</span>
              {reminded[b.id] ? (
                <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '4px 11px' }}>Reminded</span>
              ) : (
                <span className="fg" onClick={() => setReminded((r) => ({ ...r, [b.id]: true }))} style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', background: '#c67139', borderRadius: 999, padding: '6px 13px', cursor: 'pointer' }}>Send reminder</span>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && <NewBookingModal onClose={() => setCreating(false)} onCreate={(form) => { addBooking(form); setCreating(false); }} />}
    </div>
  );
}
