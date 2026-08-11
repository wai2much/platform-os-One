// Rego (registration) check — plate -> registration status, expiry, write-off
// and vehicle identity. Server-side so the provider key never touches the
// browser. Degrades gracefully ("not configured") when no key is set, same
// pattern as the Xero/Mercedes routes.
//
// Provider-agnostic: pick with REGO_PROVIDER = 'regcheck' | 'carjam' | 'autograb'.
// The response is normalised to one shape, so switching providers (or adding a
// NEVDIS broker like MotorWeb) means editing only the adapter below, not the UI.
//
// Default provider is 'regcheck' — it needs NO env vars because it goes through
// our own Netlify proxy (rego-check-live.netlify.app) which holds the account
// username server-side. Optional overrides, set in Vercel env vars:
//   REGO_PROVIDER        'regcheck' (default), 'autograb' or 'carjam'
//   REGCHECK_PROXY       optional, defaults to the Netlify proxy URL
//   AUTOGRAB_API_KEY     your AutoGrab API key        (provider=autograb)
//   AUTOGRAB_BASE        optional, defaults to https://api.autograb.com.au
//   CARJAM_API_KEY       your CarJam API key          (provider=carjam)
//   CARJAM_PRODUCT       optional, defaults to au_vdrsbc

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'NT', 'TAS', 'ACT'];
const registeredFrom = (status) => (typeof status === 'string' ? /register|current|active/i.test(status) && !/expired|cancel|unregister/i.test(status) : null);

// RegCheck (carregistrationapi.com.au) via our own Netlify proxy, which holds
// the account username server-side and edge-caches each plate for 7 days so
// repeat lookups don't spend credits. No secrets needed in this app.
async function viaRegcheck(plate, state) {
    const base = process.env.REGCHECK_PROXY || 'https://rego-check-live.netlify.app/api/lookup';
    const r = await fetch(`${base}?plate=${encodeURIComponent(plate)}&state=${encodeURIComponent(state)}`);
    let data = {}; try { data = await r.json(); } catch { /* non-JSON */ }
    if (r.status === 404) return { ok: true, configured: true, found: false, plate, state };
    if (!r.ok || data.error) {
          const msg = String(data.error || `Lookup failed (HTTP ${r.status}).`);
          if (/not found|no vehicle data/i.test(msg)) return { ok: true, configured: true, found: false, plate, state };
          return { ok: false, configured: true, message: msg };
    }
    const tv = (x) => (x && typeof x === 'object' ? x.CurrentTextValue || null : x || null);
    const ext = data.extended || {};
    return {
          ok: true, configured: true, found: true, provider: 'regcheck',
          plate, state: data.State || state,
          registered: data.Expiry ? true : null,
          status: data.Expiry ? 'Registered' : null,
          expiry: data.Expiry || null,
          vin: data.VehicleIdentificationNumber || data.VechileIdentificationNumber || ext.code || null,
          make: tv(data.CarMake) || tv(data.MakeDescription) || ext.make || null,
          model: tv(data.CarModel) || tv(data.ModelDescription) || ext.model || null,
          year: data.RegistrationYear || ext.year || null,
          description: data.Description || null,
          body: tv(data.BodyStyle) || ext.bodyType || null,
          engine: data.Engine || (ext.engine && ext.engine.description) || null,
          transmission: ext.transmissionType || null,
          nvic: ext.nvic || null,
          imageUrl: data.ImageUrl ? String(data.ImageUrl).replace(/^http:\/\//, 'https://') : null,
          stolen: /^(true|yes)$/i.test(String(data.Stolen || '')),
          writtenOff: /^(true|yes)$/i.test(String(data.WrittenOff || '')),
          insurer: tv(data.Insurer) || null,
          raw: data,
    };
}

// AutoGrab — POST {base}/v2/valuations/registrations/{plate}?region=au with a
// JSON body {state, region} and header ApiKey (matches the account's curl).
// Returns vehicle identity + valuation, plus registration fields when the
// product includes them. Raw kept so mapping can be confirmed on a live hit.
async function viaAutograb(plate, state) {
    const key = process.env.AUTOGRAB_API_KEY;
    if (!key) return { ok: false, configured: false, message: 'AutoGrab not configured — set AUTOGRAB_API_KEY.' };
    const base = process.env.AUTOGRAB_BASE || 'https://api.autograb.com.au';
    const url = `${base}/v2/valuations/registrations/${encodeURIComponent(plate)}?region=au`;
    const r = await fetch(url, {
          method: 'POST',
          headers: { ApiKey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ state, region: 'au' }),
    });
    const text = await r.text();
    let data = {}; try { data = JSON.parse(text); } catch { /* non-JSON */ }
    if (r.status === 404) return { ok: true, configured: true, found: false, plate, state };
    if (!r.ok) return { ok: false, configured: true, message: data?.message || data?.error || `AutoGrab lookup failed (HTTP ${r.status}).`, raw: text.slice(0, 1200) };
    const v = data.vehicle || data.result || data.data || data;
    const status = v.registration_status || data.registration_status || null;
    const valuation = data.valuation ?? v.valuation ?? data.price ?? v.price ?? null;
    const incidents = Array.isArray(data.incidents) ? data.incidents : Array.isArray(v.incidents) ? v.incidents : [];
    return {
          ok: true, configured: true, found: true, provider: 'autograb',
          plate: v.plate || v.registration || plate, state: v.state || state,
          registered: registeredFrom(status), status,
          expiry: v.registration_expiry || data.registration_expiry || null,
          vin: v.vin || null, make: v.make || null, model: v.model || null,
          year: v.year || v.year_of_manufacture || null,
          valuation, writtenOff: incidents.length > 0, incidents, raw: data,
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
    const provider = (process.env.REGO_PROVIDER || 'regcheck').toLowerCase();
    const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const plate = String(src.plate || '').trim().toUpperCase().replace(/\s+/g, '');
    const state = String(src.state || 'VIC').trim().toUpperCase();

  if (!plate) return res.status(400).json({ ok: false, configured: true, message: 'A registration plate is required.' });
    if ((provider === 'autograb' || provider === 'regcheck') && !AU_STATES.includes(state)) {
          return res.status(400).json({ ok: false, configured: true, message: `Unknown state "${state}". Use one of ${AU_STATES.join(', ')}.` });
    }

  try {
        const result = provider === 'regcheck' ? await viaRegcheck(plate, state)
                : provider === 'autograb' ? await viaAutograb(plate, state)
                : await viaCarjam(plate);
        return res.status(200).json(result);
  } catch (err) {
        return res.status(200).json({ ok: false, configured: true, message: err.message });
  }
}
