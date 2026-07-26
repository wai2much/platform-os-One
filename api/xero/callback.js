// Exchanges the Xero auth code for access/refresh tokens and stores them
// server-side in Supabase (never in the browser), per XERO_INTEGRATION.md.
// Refresh tokens rotate on each use — always overwrite with the latest.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, error: xeroError } = req.query;
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI || `https://${req.headers.host}/api/xero/callback`;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  // Service role key, NOT the anon key — xero_tokens has zero anon RLS
  // grants on purpose (see schema.sql). Server-side only, never VITE_-prefixed.
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const redirectToSettings = (status) => {
    res.writeHead(302, { Location: `/?xero=${status}` });
    res.end();
  };

  if (xeroError) return redirectToSettings('denied');
  if (!clientId || !clientSecret) return redirectToSettings('not_configured');
  if (!code) return redirectToSettings('missing_code');

  try {
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) return redirectToSettings('token_exchange_failed');
    const tokens = await tokenRes.json();

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from('xero_tokens').upsert({
        id: 'default',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + (tokens.expires_in || 0) * 1000).toISOString(),
      });
    }

    return redirectToSettings('connected');
  } catch (err) {
    console.error('Xero token exchange failed', err);
    return redirectToSettings('error');
  }
}
