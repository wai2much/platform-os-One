import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { CustomerPortal } from '@/core/CustomerPortal';
import { StoreProvider } from '@/core/store';
import { AuthProvider, useAuth } from '@/core/auth';
import { Login } from '@/core/pages/Login';
import { applyTheme, getThemePreference } from '@/core/theme';
import './index.css';

// index.html sets data-theme inline before first paint (avoiding a flash of
// the light theme). Re-applying here is the backstop for anything that loads
// the bundle without that script — and keeps the two in sync from one source.
applyTheme(getThemePreference());

// /book is the public Customer Booking Portal — no app chrome, no login,
// just the booking flow. It uses a fixed org id (VITE_DEFAULT_ORG_ID) since
// there's no signed-in user to derive a tenant from. Everything else is the
// internal app, gated behind Google sign-in.
const isPortal = window.location.pathname.startsWith('/book');

function Splash({ label }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }}>
      <p className="fg" style={{ color: 'var(--text-mute)', fontSize: 13 }}>{label}</p>
    </div>
  );
}

// Reads auth state and decides what to render: a loading splash while we
// check for a session, the Login screen if signed out, a brief "setting up
// your workspace" splash while the auto-provision trigger creates the new
// user's org (see handle_new_user in supabase/schema.sql), or the real app
// once both a user and their org are known.
function AuthGate() {
  const { user, org, loading, provisioning } = useAuth();
  if (loading) return <Splash label={provisioning ? 'Setting up your workspace…' : 'Loading…'} />;
  if (!user) return <Login />;
  if (!org) return <Splash label="Setting up your workspace…" />;
  return (
    <StoreProvider orgId={org.id}>
      <App />
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPortal ? (
      <StoreProvider orgId={import.meta.env.VITE_DEFAULT_ORG_ID}>
        <CustomerPortal />
      </StoreProvider>
    ) : (
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    )}
  </React.StrictMode>
);
