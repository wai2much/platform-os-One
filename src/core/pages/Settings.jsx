import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/core/auth';

/**
 * Settings — core screen. Business profile, bank details, credit &
 * invoicing, integrations. Grok (London) and Xero are wired to REAL
 * serverless endpoints (api/grok/*, api/xero/*) per the GROK_VOICE_AGENT.md
 * and XERO_INTEGRATION.md handoffs — they degrade gracefully to "not
 * configured" until Wai adds the real secrets as Vercel env vars (never in
 * chat, never client-side), same pattern as the Supabase wiring.
 *
 * Business profile + bank details are now real per-org columns on
 * `organizations` (see supabase/add-business-profile.sql). They used to be
 * hardcoded here — every org, including demo signups, showed Wai's real
 * business name and real bank BSB/account number. Fixed 2026-08-08.
 */
const inp = { width: '100%', boxSizing: 'border-box', background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, fontFamily: 'Figtree, sans-serif', color: 'var(--text)', outline: 'none' };
const label = { fontSize: 11, color: 'var(--text-mute)', fontWeight: 700, letterSpacing: '.06em' };

function Card({ title, children, action }) {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(32,30,29,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="cap" style={{ fontSize: 16, color: 'var(--text)' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ l, value, onChange, placeholder }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span className="fg" style={label}>{l}</span><input value={value ?? ''} placeholder={placeholder} onChange={onChange} style={inp} /></div>;
}

function SaveButton({ onClick, status }) {
  const label = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Retry' : 'Save';
  return (
    <span onClick={status === 'saving' ? undefined : onClick} className="fg" style={{ fontSize: 11, fontWeight: 700, color: status === 'saved' ? '#fff' : 'var(--text-soft)', background: status === 'saved' ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '4px 12px', cursor: status === 'saving' ? 'default' : 'pointer' }}>
      {label}
    </span>
  );
}

function Toggle({ on, onClick }) {
  return (
    <span onClick={onClick} style={{ width: 34, height: 19, borderRadius: 999, background: on ? '#7a8a5e' : 'var(--panel-bg)', position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </span>
  );
}

const XERO_BANNER = {
  connected: { color: '#7a8a5e', text: 'Xero connected successfully.' },
  denied: { color: '#c67139', text: 'Xero authorisation was cancelled.' },
  not_configured: { color: '#c67139', text: 'Xero isn’t configured on the server yet (XERO_CLIENT_ID/SECRET missing).' },
  token_exchange_failed: { color: '#c67139', text: 'Xero token exchange failed — check the server logs.' },
  error: { color: '#c67139', text: 'Something went wrong connecting Xero.' },
};

const BLANK_PROFILE = { business_name: '', trading_as: '', abn: '', address: '', phone: '', email: '' };
const BLANK_BANK = { bank_name: '', bank_bsb: '', bank_account: '' };

export function Settings() {
  const { org, user, refreshOrg, signOut } = useAuth();

  const [profile, setProfile] = useState(BLANK_PROFILE);
  const [bank, setBank] = useState(BLANK_BANK);
  const [profileStatus, setProfileStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [bankStatus, setBankStatus] = useState(null);

  // Load this org's own saved values once it's known. Re-runs if the user
  // switches org (e.g. signs into a different account in the same tab).
  useEffect(() => {
    if (!org) return;
    setProfile({
      business_name: org.business_name || '',
      trading_as: org.trading_as || '',
      abn: org.abn || '',
      address: org.address || '',
      phone: org.phone || '',
      email: org.email || '',
    });
    setBank({
      bank_name: org.bank_name || '',
      bank_bsb: org.bank_bsb || '',
      bank_account: org.bank_account || '',
    });
  }, [org?.id]);

  const saveProfile = async () => {
    if (!org || !isSupabaseConfigured) return;
    setProfileStatus('saving');
    const { error } = await supabase.from('organizations').update(profile).eq('id', org.id);
    if (error) { console.error('Failed to save business profile', error); setProfileStatus('error'); return; }
    setProfileStatus('saved');
    refreshOrg?.();
    setTimeout(() => setProfileStatus(null), 2000);
  };

  const saveBank = async () => {
    if (!org || !isSupabaseConfigured) return;
    setBankStatus('saving');
    const { error } = await supabase.from('organizations').update(bank).eq('id', org.id);
    if (error) { console.error('Failed to save bank details', error); setBankStatus('error'); return; }
    setBankStatus('saved');
    refreshOrg?.();
    setTimeout(() => setBankStatus(null), 2000);
  };

  const [creditHold, setCreditHold] = useState(true);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroConfigured, setXeroConfigured] = useState(null); // null = checking
  const [xeroBanner, setXeroBanner] = useState(null);

  const [testCallOpen, setTestCallOpen] = useState(false);
  const [testCallResult, setTestCallResult] = useState(null); // { ok, configured, callerLine, reply, message }
  const [testCallRunning, setTestCallRunning] = useState(false);

  const [connTesting, setConnTesting] = useState(false);
  const [connResult, setConnResult] = useState(null); // { ok, configured, message }

  useEffect(() => {
    // Show the result banner from the Xero OAuth redirect, if we just came back from it.
    const params = new URLSearchParams(window.location.search);
    const xeroParam = params.get('xero');
    if (xeroParam) {
      setXeroBanner(XERO_BANNER[xeroParam] || null);
      window.history.replaceState({}, '', window.location.pathname);
    }
    fetch('/api/xero/status').then((r) => r.json()).then((d) => {
      setXeroConfigured(d.configured);
      setXeroConnected(!!d.connected);
    }).catch(() => setXeroConfigured(false));
  }, []);

  const runTestCall = async () => {
    setTestCallOpen(true);
    setTestCallRunning(true);
    setTestCallResult(null);
    try {
      const r = await fetch('/api/grok/test-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setTestCallResult(await r.json());
    } catch (err) {
      setTestCallResult({ ok: false, configured: true, message: err.message });
    }
    setTestCallRunning(false);
  };

  const testConnection = async () => {
    setConnTesting(true);
    setConnResult(null);
    try {
      const r = await fetch('/api/grok/test-connection');
      setConnResult(await r.json());
    } catch (err) {
      setConnResult({ ok: false, configured: true, message: err.message });
    }
    setConnTesting(false);
  };

  const connectXero = () => { window.location.href = '/api/xero/authorize'; };

  return (
    <div style={{ padding: '6px 30px 26px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <Card title="Business profile" action={<SaveButton onClick={saveProfile} status={profileStatus} />}>
        <Field l="BUSINESS NAME" placeholder="Your business name" value={profile.business_name} onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))} />
        <Field l="TRADING AS" placeholder="Trading name (if different)" value={profile.trading_as} onChange={(e) => setProfile((p) => ({ ...p, trading_as: e.target.value }))} />
        <Field l="ABN" placeholder="e.g. 12 345 678 901" value={profile.abn} onChange={(e) => setProfile((p) => ({ ...p, abn: e.target.value }))} />
        <Field l="ADDRESS" placeholder="Business address" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
        <Field l="PHONE" placeholder="Phone number" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
        <Field l="EMAIL" placeholder="Contact email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
      </Card>

      <Card title="Bank details" action={<SaveButton onClick={saveBank} status={bankStatus} />}>
        <Field l="BANK" placeholder="Bank name" value={bank.bank_name} onChange={(e) => setBank((b) => ({ ...b, bank_name: e.target.value }))} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Field l="BSB" placeholder="000-000" value={bank.bank_bsb} onChange={(e) => setBank((b) => ({ ...b, bank_bsb: e.target.value }))} /></div>
          <div style={{ flex: 1 }}><Field l="ACCOUNT NUMBER" placeholder="Account number" value={bank.bank_account} onChange={(e) => setBank((b) => ({ ...b, bank_account: e.target.value }))} /></div>
        </div>
        <div className="fg" style={{ fontSize: 11, color: 'var(--text-mute)', fontWeight: 600 }}>Used on invoices for direct bank transfer payment</div>
      </Card>

      <Card title="Credit & invoicing">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>Enforce credit hold</div><div className="fg" style={{ fontSize: 11, color: 'var(--text-mute)', fontWeight: 600, marginTop: 2 }}>Flag accounts past their terms and block new work until approved</div></div>
          <Toggle on={creditHold} onClick={() => setCreditHold((v) => !v)} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><div className="fg" style={{ ...label, marginBottom: 5 }}>DEFAULT TERMS</div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, background: 'var(--panel-bg)', borderRadius: 10, padding: '10px 13px' }}>Net 14</div></div>
          <div style={{ flex: 1 }}><div className="fg" style={{ ...label, marginBottom: 5 }}>MAX ACCOUNT TERM</div><div className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, background: 'var(--panel-bg)', borderRadius: 10, padding: '10px 13px' }}>Net 30</div></div>
        </div>
      </Card>

      <Card title="Integrations">
        {[['3CX phone system', true], ['Mercedes AI', true], ['London (voice agent · Grok)', true]].map(([name, connected]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{name}</span>
            <span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#7a8a5e', borderRadius: 999, padding: '3px 10px' }}>{connected ? 'Connected' : 'Off'}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 14 }}><span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Voice ID</span><span className="fg" style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'monospace' }}>f47a84ff-bb8c-42f9-8458-763051a6dae0</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 14 }}><span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Agent ID</span><span className="fg" style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'monospace' }}>agent_w54p3rF4EgKG1y4I</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 14 }}>
          <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Connection</span>
          <span onClick={testConnection} className="fg" style={{ fontSize: 11, fontWeight: 700, color: connResult?.ok ? '#fff' : 'var(--text-soft)', background: connResult?.ok ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}>
            {connTesting ? 'Testing…' : connResult?.ok ? '✓ Connected' : 'Test connection'}
          </span>
        </div>
        {connResult && !connResult.ok && (
          <div className="fg" style={{ fontSize: 11, color: '#c67139', paddingLeft: 14 }}>{connResult.configured ? connResult.message : 'XAI_API_KEY not set on the server yet.'}</div>
        )}
        <div className="fg" style={{ fontSize: 10.5, color: 'var(--text-mute2)', paddingLeft: 14, lineHeight: 1.5 }}>API key stored server-side only — never shipped to the browser</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 14 }}>
          <span className="fg" style={{ fontSize: 11.5, color: 'var(--text-mute2)', fontWeight: 600 }}>Test call flow</span>
          <span onClick={runTestCall} className="fg" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)', background: 'var(--panel-bg)', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}>Run test call</span>
        </div>
        {testCallOpen && (
          <div style={{ background: 'var(--panel-bg)', borderRadius: 14, padding: '14px 16px', marginLeft: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {testCallRunning && <span className="fg" style={{ fontSize: 12, color: 'var(--text-mute)' }}>Calling Grok…</span>}
            {testCallResult && testCallResult.ok && (
              <>
                <div style={{ display: 'flex', gap: 8 }}><span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-soft)', width: 52, flexShrink: 0 }}>Caller</span><span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{testCallResult.callerLine}</span></div>
                <div style={{ display: 'flex', gap: 8 }}><span className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: '#c67139', width: 52, flexShrink: 0 }}>London</span><span className="fg" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{testCallResult.reply}</span></div>
                <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: '#7a8a5e' }}>✓ Real Grok response — call flow verified</span>
              </>
            )}
            {testCallResult && !testCallResult.ok && (
              <span className="fg" style={{ fontSize: 12, color: '#c67139' }}>{testCallResult.configured ? testCallResult.message : 'XAI_API_KEY not set on the server yet — nothing to test.'}</span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>Accounting sync</span>
          <span onClick={xeroConnected ? undefined : connectXero} className="fg" style={{ fontSize: 10.5, fontWeight: 700, color: xeroConnected ? '#fff' : 'var(--text-soft)', background: xeroConnected ? '#7a8a5e' : 'var(--panel-bg)', borderRadius: 999, padding: '2px 9px', cursor: xeroConnected ? 'default' : 'pointer' }}>
            {xeroConfigured === null ? 'Checking…' : xeroConnected ? 'Xero · Synced' : xeroConfigured ? 'Connect Xero' : 'Not configured'}
          </span>
        </div>
        {xeroBanner && <div className="fg" style={{ fontSize: 11, color: xeroBanner.color, fontWeight: 600 }}>{xeroBanner.text}</div>}
      </Card>

      <Card title="Account">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{user?.email || 'Signed in'} · {org?.role ? org.role[0].toUpperCase() + org.role.slice(1) : 'Owner'}</span><span className="fg" style={{ fontSize: 12, fontWeight: 600, color: '#c67139', cursor: 'pointer' }}>Manage team</span></div>
        <span onClick={signOut} className="fg" style={{ fontSize: 12.5, fontWeight: 700, color: '#c67139', cursor: 'pointer' }}>Sign out</span>
      </Card>
    </div>
  );
}
