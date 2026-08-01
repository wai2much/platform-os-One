import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Shared helpers for Slim's Supabase Edge Functions.
 *
 * Required secrets (set with `supabase secrets set ...`):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for
 *  deployed functions; the service role key you must set yourself.)
 */

// Service-role client — full DB access, bypasses RLS. Use for server-side reads/writes.
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Verify the caller's JWT (from the Authorization header). Returns the user or null.
export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
