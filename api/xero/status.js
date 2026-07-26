// Reports whether Xero is connected WITHOUT exposing the actual tokens to
// the browser (xero_tokens has no anon select policy — see schema.sql).
// This route runs server-side, so it can read the table directly.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  // Service role key — see callback.js's comment; xero_tokens grants nothing to anon.
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(200).json({ connected: false, configured: false });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.from('xero_tokens').select('expires_at').eq('id', 'default').maybeSingle();
    if (error || !data) return res.status(200).json({ connected: false, configured: true });
    const connected = new Date(data.expires_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000; // token exists within last 30 days (refresh handles actual expiry)
    return res.status(200).json({ connected, configured: true });
  } catch (err) {
    return res.status(200).json({ connected: false, configured: true, message: err.message });
  }
}
