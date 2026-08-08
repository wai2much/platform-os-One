import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Auth — Google sign-in via Supabase Auth, plus the current org (tenant) for
 * the signed-in user. Every Google account gets its own organization
 * auto-provisioned server-side on first sign-in (see the `handle_new_user`
 * trigger in supabase/schema.sql) — there is no manual org-creation step
 * here, just a lookup once the trigger has landed.
 */
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// Business profile + bank details used to be hardcoded in Settings.jsx
// (same values shown for every org, including your real bank BSB/account
// number). They're real per-org columns now — selected here so every org
// gets its own, defaulting to blank until someone fills them in.
const ORG_COLUMNS = 'id, name, vertical, business_name, trading_as, address, phone, email, bank_name, bank_bsb, bank_account';

async function fetchOrg(userId) {
  const { data, error } = await supabase
    .from('memberships')
    .select(`role, organizations(${ORG_COLUMNS})`)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Supabase: failed to load membership', error);
    return null;
  }
  if (!data?.organizations) return null;
  return { ...data.organizations, role: data.role };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  // 'booting' -> checking for a session; 'provisioning' -> signed in, waiting
  // on the auto-provision trigger to create the org row; 'ready' -> done.
  const [phase, setPhase] = useState('booting');

  async function loadOrgFor(u, attempt = 0) {
    const found = await fetchOrg(u.id);
    if (found) {
      setOrg(found);
      setPhase('ready');
      return;
    }
    // The provisioning trigger fires on insert into auth.users and is
    // usually instant, but isn't guaranteed to have committed before this
    // query runs. Retry briefly before giving up.
    if (attempt < 5) {
      setPhase('provisioning');
      setTimeout(() => loadOrgFor(u, attempt + 1), 500);
    } else {
      console.error('Supabase: no organization found for user after retries', u.id);
      setPhase('ready');
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPhase('ready');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadOrgFor(session.user);
      } else {
        setPhase('ready');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadOrgFor(session.user);
      } else {
        setUser(null);
        setOrg(null);
        setPhase('ready');
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

  const signOut = () => supabase.auth.signOut();

  // Called after Settings saves changes to the org's business profile, so
  // the rest of the app (which reads org.* from context) sees the update
  // immediately without needing a full page reload.
  const refreshOrg = () => { if (user) loadOrgFor(user); };

  return (
    <Ctx.Provider value={{
      user, org,
      loading: phase !== 'ready',
      provisioning: phase === 'provisioning',
      signInWithGoogle, signOut, refreshOrg,
    }}>
      {children}
    </Ctx.Provider>
  );
}
