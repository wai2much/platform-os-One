// Shared server-side Xero helper — NOT a route itself (leading underscore),
// imported by api/xero/*.js. Holds the one thing every real Xero API call
// needs: a currently-valid access token + tenant id, refreshing via the
// rotating refresh_token when the stored one is close to expiry.
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Returns { accessToken, tenantId } for a live connection, or null if Xero
// isn't configured, never connected, or the refresh itself fails.
export async function getXeroConnection() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const supabase = getSupabase();
  if (!clientId || !clientSecret || !supabase) return null;

  const { data: row, error } = await supabase.from('xero_tokens').select('*').eq('id', 'default').maybeSingle();
  if (error || !row) return null;

  const expiresInMs = new Date(row.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return { accessToken: row.access_token, tenantId: row.tenant_id };

  // Within a minute of expiry (or already expired) — refresh. Xero rotates
  // the refresh token on every use, so the old one is single-use.
  const refreshRes = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
  });
  if (!refreshRes.ok) return null;
  const tokens = await refreshRes.json();

  await supabase.from('xero_tokens').upsert({
    id: 'default',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + (tokens.expires_in || 0) * 1000).toISOString(),
    tenant_id: row.tenant_id,
  });

  return { accessToken: tokens.access_token, tenantId: row.tenant_id };
}

// Thin wrapper for the Xero Accounting API (api.xro/2.0/*).
export async function xeroApiFetch(conn, path, options = {}) {
  return fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      'Xero-tenant-id': conn.tenantId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
