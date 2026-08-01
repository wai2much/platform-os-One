// Rego (registration) check — plate -> registration status, expiry, write-off
// and vehicle identity. Server-side so the provider key never touches the
// browser. Degrades gracefully ("not configured") when no key is set, same
// pattern as the Xero/Mercedes routes.
//
// Provider-agnostic: pick with REGO_PROVIDER = 'carjam' | 'autograb'. The
// response is normalised to one shape, so switching providers (or adding a
// NEVDIS broker like MotorWeb) means editing only the adapter below, not the UI.
//
// Secrets — set in Vercel -> Project -> Environment Variables, never committed:
//   REGO_PROVIDER        'carjam' (default) or 'autograb'
//   CARJAM_API_KEY       your CarJam API key         (provider=carjam)
//   CARJAM_URL_TEMPLATE  optional override, use {plate}/{key} placeholders,
//                        e.g. https://www.carjam.co.nz/api/car/?plate={plate}&key={key}
//   AUTOGRAB_API_KEY     your AutoGrab API key        (provider=autograb)
//   AUTOGRAB_BASE        optional, defaults to https://api.autograb.com

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'NT', 'TAS', 'ACT'];
const registeredFrom = (status) => (typeof status === 'string' ? /register|current|active/i.test(status) && !/expired|cancel|unregister/i.test(status) : null);

async function viaAutograb(plate, state) {
  const key = process.env.AUTOGRAB_API_KEY;
  if (!key) return { ok: false, configured: false, message: 'AutoGrab not configured — set AUTOGRAB_API_KEY.' };
  const base = process.env.AUTOGRAB_BASE || 'https://api.autograb.com';
  const url = `${base}/v2/vehicles/${encodeURIComponent(plate)}/status?region=au&state=${state}`;
  const r = await fetch(url, { headers: { ApiKey: key, Accept: 'application/json' } });
  const text = await r.text();
  let data = {}; try { data = JSON.parse(text); } catch { /* non-JSON */ }
  if (r.status === 404) return { ok: true, configured: true, found: false, plate, state };
  if (!r.ok) return { ok: false, configured: true, message: data?.message || `AutoGrab lookup failed (HTTP ${r.status}).` };
  const status = data.registration_status || data.status || null;
  const incidents = Array.isArray(data.incidents) ? data.incidents : [];
  return {
    ok: true, configured: true, found: true, provider: 'autograb',
    plate: data.plate_number || plate, state: data.state || state,
    registered: registeredFrom(status), status, expiry: data.registration_expiry || null,
    vin: data.vin || null, make: data.make || null, model: data.model || null, year: data.year || null,
    writtenOff: incidents.length > 0, incidents, raw: data,
  };
}

// CarJam — GET {base}/api/car/?plate=..&key=..&{product}=1. Returns XML: a
// <message> block on success, or <error .../>. AU datasets are selected by a
// product flag (au_vdrsbc = vehicle data + rego status bundle; au_rs = rego
// status only). Override the flag with CARJAM_PRODUCT if your enabled product
// differs. Field tag names below are best-effort against CarJam's schema and
// the full XML is returned as `raw` so mapping can be confirmed against a real
// response.
async function viaCarjam(plate) {
  const key = process.env.CARJAM_API_KEY;
  if (!key) return { ok: false, configured: false, message: 'CarJam not configured — set CARJAM_API_KEY.' };
  const base = process.env.CARJAM_BASE || 'https://www.carjam.co.nz';
  const product = process.env.CARJAM_PRODUCT || 'au_vdrsbc';
  const extra = process.env.CARJAM_EXTRA_PARAMS || `${product}=1`;
  const url = `${base}/api/car/?plate=${encodeURIComponent(plate)}&key=${encodeURIComponent(key)}&${extra}`;

  const r = await fetch(url, { headers: { Accept: 'application/xml, application/json' } });
  const text = await r.text();
  const tag = (name) => { const m = text.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i')); return m ? m[1].trim() : null; };
  const attr = (name) => { const m = text.match(new RegExp(`${name}="([^"]*)"`, 'i')); return m ? m[1].trim() : null; };

  const errMsg = /<error/i.test(text) ? (attr('message') || tag('error') || 'CarJam returned an error') : null;
  if (!r.ok || errMsg) return { ok: false, configured: true, message: errMsg || `CarJam lookup failed (HTTP ${r.status}).`, raw: text.slice(0, 1200) };

  const status = tag('registration_status') || tag('license_status') || tag('reg_status') || tag('status');
  const found = /<message|<vehicle|<plate/i.test(text);
  return {
    ok: true, configured: true, found, provider: 'carjam',
    plate: tag('plate') || plate,
    registered: registeredFrom(status), status,
    expiry: tag('license_expiry') || tag('registration_expiry') || tag('expiry') || null,
    vin: tag('vin') || null, make: tag('make') || null, model: tag('model') || null,
    year: tag('year_of_manufacture') || tag('year') || null,
    raw: text.slice(0, 1600),
  };
}

export default async function handler(req, res) {
  const provider = (process.env.REGO_PROVIDER || 'carjam').toLowerCase();
  const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const plate = String(src.plate || '').trim().toUpperCase().replace(/\s+/g, '');
  const state = String(src.state || 'VIC').trim().toUpperCase();

  if (!plate) return res.status(400).json({ ok: false, configured: true, message: 'A registration plate is required.' });
  if (provider === 'autograb' && !AU_STATES.includes(state)) {
    return res.status(400).json({ ok: false, configured: true, message: `Unknown state "${state}". Use one of ${AU_STATES.join(', ')}.` });
  }

  try {
    const result = provider === 'autograb' ? await viaAutograb(plate, state) : await viaCarjam(plate);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ ok: false, configured: true, message: err.message });
  }
}
