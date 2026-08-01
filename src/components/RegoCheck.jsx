import { useState } from 'react';

/**
 * RegoCheck — enter an Australian plate, get registration status + expiry,
 * write-off flag and vehicle identity from api/rego/check.js (provider set by
 * REGO_PROVIDER env; CarJam or AutoGrab). Reusable: drop it on Vehicles, the
 * Job Card, or anywhere. onResult(result) fires on a successful lookup so a
 * host screen can pre-fill a form from it.
 */
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'NT', 'TAS', 'ACT'];
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' };

export function RegoCheck({ onResult }) {
  const [plate, setPlate] = useState('');
  const [state, setState] = useState('VIC');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const check = async () => {
    const p = plate.trim();
    if (!p || loading) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/rego/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plate: p, state }),
      });
      const data = await res.json();
      if (data.configured === false) { setError(data.message || 'Rego lookup not configured yet.'); return; }
      if (!data.ok) { setError(data.message || 'Lookup failed.'); return; }
      if (data.found === false) { setError(`No record found for ${p} (${state}).`); return; }
      setResult(data);
      onResult?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reg = result?.registered;
  const badge = reg === true ? { t: 'Registered', c: '#fff', bg: '#7a8a5e' }
    : reg === false ? { t: result.status || 'Not registered', c: '#fff', bg: '#b4522f' }
    : { t: result?.status || 'Status unknown', c: 'var(--text)', bg: 'var(--panel-bg)' };

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
      <div className="cap" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Rego check</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={plate} onChange={(e) => setPlate(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="Plate e.g. ABC123" style={{ ...inp, textTransform: 'uppercase', width: 150 }} />
        <select value={state} onChange={(e) => setState(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span onClick={check} className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: loading ? 'var(--text-mute2)' : '#c67139', borderRadius: 999, padding: '9px 18px', cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Checking…' : 'Check'}
        </span>
      </div>

      {error && <div className="fg" style={{ fontSize: 12, color: '#b4522f', marginTop: 10 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: badge.c, background: badge.bg, borderRadius: 999, padding: '3px 12px' }}>{badge.t}</span>
            {result.expiry && <span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>Expires {result.expiry}</span>}
            {result.writtenOff && <span className="fg" style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: '#b4522f', borderRadius: 999, padding: '3px 12px' }}>Write-off recorded</span>}
          </div>
          {(result.make || result.model || result.year || result.vin) && (
            <div className="fg" style={{ fontSize: 12.5, color: 'var(--text)' }}>
              {[result.year, result.make, result.model].filter(Boolean).join(' ') || 'Vehicle'}{result.vin ? ` · VIN ${result.vin}` : ''}
            </div>
          )}
          {result.note && <div className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>{result.note}</div>}
        </div>
      )}
    </div>
  );
}
