// Kicks off the real Xero OAuth 2.0 flow (per XERO_INTEGRATION.md handoff).
// XERO_CLIENT_ID is a public-ish identifier (safe in a redirect URL) but the
// Client Secret never appears here or anywhere client-side — only in
// api/xero/callback.js's server-side token exchange.
export default async function handler(req, res) {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI || `https://${req.headers.host}/api/xero/callback`;

  if (!clientId) {
    return res.status(200).json({ ok: false, configured: false, message: 'XERO_CLIENT_ID not set on the server' });
  }

  const scopes = ['openid', 'profile', 'email', 'accounting.transactions', 'accounting.contacts', 'offline_access'].join(' ');
  const state = Math.random().toString(36).slice(2);
  const authUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
