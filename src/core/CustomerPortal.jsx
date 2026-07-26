import { useState } from 'react';
import { useStore } from '@/core/store';

/**
 * Customer Booking Portal — the public-facing flow (separate from the admin
 * "Public Booking" settings screen). Standalone, no app chrome. Faithful to
 * the prototype's 4-step design: service -> day/time -> details -> confirmation.
 *
 * "Confirm booking" writes a real booking through the shared store (Supabase
 * when configured), which the internal Bookings screen reads — replacing the
 * prototype's localStorage bridge now that there's an actual backend.
 */
const SERVICES = [
  { id: 's1', name: '4x Tyre fitment', duration: '45 min', price: 'from $60', iconBg: '#c67139' },
  { id: 's2', name: 'Wheel alignment', duration: '40 min', price: '$149', iconBg: '#7a8a5e' },
  { id: 's3', name: 'Puncture repair', duration: '30 min', price: '$45', iconBg: '#dcc9a8' },
  { id: 's4', name: 'Full service', duration: '90 min', price: 'from $289', iconBg: '#201e1d' },
  { id: 's5', name: 'Brakes inspection', duration: '30 min', price: 'free', iconBg: '#7a8a5e' },
];
const DAYS = [
  { id: 'd1', label: 'MON', date: '28' }, { id: 'd2', label: 'TUE', date: '29' },
  { id: 'd3', label: 'WED', date: '30' }, { id: 'd4', label: 'THU', date: '31' },
  { id: 'd5', label: 'FRI', date: '1' },
];
const TIMES = ['8:00', '9:30', '11:00', '1:00', '2:30', '4:00'];

const inp = { width: '100%', boxSizing: 'border-box', background: '#efe0c8', border: 'none', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'Figtree, sans-serif', color: '#201e1d' };

export function CustomerPortal() {
  const { addPortalBooking } = useStore();
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(null);
  const [dayId, setDayId] = useState(null);
  const [timeId, setTimeId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicle: '', notes: '' });
  const [confirmedName, setConfirmedName] = useState('');

  const service = SERVICES.find((s) => s.id === serviceId);
  const day = DAYS.find((d) => d.id === dayId);
  const time = timeId;

  const confirmBooking = () => {
    const name = form.name.trim() || 'you';
    addPortalBooking({
      customer: name,
      phone: form.phone.trim(),
      vehicle: form.vehicle.trim() || 'Vehicle TBC',
      service: service.name,
      day: day ? `${day.label} ${day.date}` : '',
      time,
      notes: form.notes.trim(),
    });
    setConfirmedName(name);
    setStep(4);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#efe0c8', fontFamily: 'Figtree, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 60px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#c67139', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="cap" style={{ fontSize: 19, color: '#f5ead8' }}>T</span></div>
          <div><div className="cap" style={{ color: '#201e1d', fontSize: 19, lineHeight: 1 }}>TyrePlus Thomastown</div><div className="fg" style={{ color: '#6f6a63', fontSize: 11.5, fontWeight: 600, marginTop: 3 }}>218 Mahoneys Rd, Thomastown VIC · 03 9462 4400</div></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: step >= n ? '#c67139' : 'rgba(32,30,29,.14)' }} />)}
        </div>

        <div style={{ background: '#fffaf0', borderRadius: 24, padding: '30px 28px', boxShadow: '0 10px 30px rgba(32,30,29,.08)' }}>
          {step === 1 && (
            <>
              <div className="cap" style={{ fontSize: 22, color: '#201e1d', marginBottom: 4 }}>What do you need done?</div>
              <div className="fg" style={{ fontSize: 13, color: '#6f6a63', marginBottom: 22 }}>Select a service to get started</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SERVICES.map((s) => (
                  <div key={s.id} onClick={() => { setServiceId(s.id); setStep(2); }} style={{ display: 'flex', alignItems: 'center', gap: 14, border: `1.5px solid ${serviceId === s.id ? '#c67139' : 'rgba(32,30,29,.14)'}`, background: serviceId === s.id ? 'rgba(198,113,57,.08)' : '#fffaf0', borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: s.iconBg, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}><div className="fg" style={{ fontSize: 14, color: '#201e1d', fontWeight: 700 }}>{s.name}</div><div className="fg" style={{ fontSize: 11.5, color: '#8a857c', fontWeight: 600, marginTop: 2 }}>{s.duration}</div></div>
                    <div className="fg" style={{ fontSize: 13, color: '#201e1d', fontWeight: 700 }}>{s.price}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="cap" style={{ fontSize: 22, color: '#201e1d', marginBottom: 4 }}>Pick a time</div>
              <div className="fg" style={{ fontSize: 13, color: '#6f6a63', marginBottom: 20 }}>{service.name} · {service.duration}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {DAYS.map((d) => (
                  <div key={d.id} onClick={() => setDayId(d.id)} style={{ flex: 1, minWidth: 88, textAlign: 'center', border: `1.5px solid ${dayId === d.id ? '#c67139' : 'rgba(32,30,29,.14)'}`, background: dayId === d.id ? 'rgba(198,113,57,.08)' : '#fffaf0', borderRadius: 14, padding: '12px 6px', cursor: 'pointer' }}>
                    <div className="fg" style={{ fontSize: 10.5, color: '#8a857c', fontWeight: 700 }}>{d.label}</div>
                    <div className="cap" style={{ fontSize: 18, color: '#201e1d', marginTop: 3 }}>{d.date}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
                {TIMES.map((t) => (
                  <div key={t} onClick={() => setTimeId(t)} style={{ textAlign: 'center', border: `1.5px solid ${timeId === t ? '#c67139' : 'rgba(32,30,29,.14)'}`, background: timeId === t ? '#c67139' : '#fffaf0', borderRadius: 12, padding: '11px 6px', cursor: 'pointer' }}>
                    <span className="fg" style={{ fontSize: 13, color: timeId === t ? '#fff' : '#201e1d', fontWeight: 700 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26 }}>
                <span onClick={() => setStep(1)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: '#3c3936', cursor: 'pointer' }}>Back</span>
                <span onClick={() => (dayId && timeId) && setStep(3)} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: (dayId && timeId) ? '#c67139' : 'rgba(32,30,29,.25)', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}>Continue</span>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="cap" style={{ fontSize: 22, color: '#201e1d', marginBottom: 4 }}>Your details</div>
              <div className="fg" style={{ fontSize: 13, color: '#6f6a63', marginBottom: 20 }}>{service.name} · {day.label} {day.date} {time}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><div className="fg" style={{ fontSize: 11, color: '#8a857c', fontWeight: 700, letterSpacing: '.06em', marginBottom: 6 }}>FULL NAME</div><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" style={inp} /></div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><div className="fg" style={{ fontSize: 11, color: '#8a857c', fontWeight: 700, letterSpacing: '.06em', marginBottom: 6 }}>PHONE</div><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="04xx xxx xxx" style={inp} /></div>
                  <div style={{ flex: 1 }}><div className="fg" style={{ fontSize: 11, color: '#8a857c', fontWeight: 700, letterSpacing: '.06em', marginBottom: 6 }}>EMAIL</div><input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@email.com" style={inp} /></div>
                </div>
                <div><div className="fg" style={{ fontSize: 11, color: '#8a857c', fontWeight: 700, letterSpacing: '.06em', marginBottom: 6 }}>VEHICLE</div><input value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))} placeholder="e.g. Toyota Hilux · rego" style={inp} /></div>
                <div><div className="fg" style={{ fontSize: 11, color: '#8a857c', fontWeight: 700, letterSpacing: '.06em', marginBottom: 6 }}>NOTES (OPTIONAL)</div><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Anything we should know?" style={{ ...inp, resize: 'vertical' }} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26 }}>
                <span onClick={() => setStep(2)} className="fg" style={{ fontSize: 13, fontWeight: 600, color: '#3c3936', cursor: 'pointer' }}>Back</span>
                <span onClick={confirmBooking} className="fg" style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#c67139', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' }}>Confirm booking</span>
              </div>
            </>
          )}

          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#7a8a5e', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 26, height: 14, borderLeft: '3.5px solid #fffaf0', borderBottom: '3.5px solid #fffaf0', transform: 'rotate(-45deg) translate(2px,-3px)' }} />
              </div>
              <div className="cap" style={{ fontSize: 23, color: '#201e1d', marginBottom: 8 }}>You're booked in</div>
              <div className="fg" style={{ fontSize: 13.5, color: '#6f6a63', lineHeight: 1.6, marginBottom: 14 }}>{service.name} on {day.label} {day.date} at {time}.<br />A confirmation has been sent to {confirmedName}.</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
                <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#3c3936', background: '#efe0c8', borderRadius: 999, padding: '5px 12px' }}>Email sent</span>
                <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#3c3936', background: '#efe0c8', borderRadius: 999, padding: '5px 12px' }}>SMS sent</span>
              </div>
              <div style={{ background: '#efe0c8', borderRadius: 16, padding: '16px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: '#8a857c', fontWeight: 600 }}>Service</span><span className="fg" style={{ fontSize: 12.5, color: '#201e1d', fontWeight: 700 }}>{service.name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: '#8a857c', fontWeight: 600 }}>When</span><span className="fg" style={{ fontSize: 12.5, color: '#201e1d', fontWeight: 700 }}>{day.label} {day.date} · {time}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fg" style={{ fontSize: 12, color: '#8a857c', fontWeight: 600 }}>Where</span><span className="fg" style={{ fontSize: 12.5, color: '#201e1d', fontWeight: 700 }}>218 Mahoneys Rd, Thomastown</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
