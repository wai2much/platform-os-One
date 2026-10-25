// Resolves the signed-in user's org from their Supabase access token, using
// the service role server-side. Mirrors the memberships check RLS uses.
import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export async function memberOrg(req, supabase) {
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: u } = await supabase.auth.getUser(token);
  if (!u?.user) return null;
  const { data } = await supabase.from('memberships').select('org_id').eq('user_id', u.user.id).limit(1).maybeSingle();
  return data ? { userId: u.user.id, orgId: data.org_id } : null;
}
