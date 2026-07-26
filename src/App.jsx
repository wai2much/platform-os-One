import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { SECTIONS } from '@/core/registry';
import { Dashboard } from '@/core/pages/Dashboard';
import { Customers } from '@/core/pages/Customers';
import { Invoices } from '@/core/pages/Invoices';
import { Jobs } from '@/core/pages/Jobs';
import { Bookings } from '@/core/pages/Bookings';

const SCREENS = { dashboard: Dashboard, customers: Customers, invoices: Invoices, jobs: Jobs, bookings: Bookings };

/**
 * Demo tenant. In the product this comes from the signed-in org (multi-tenant).
 * Switch `vertical` and the workshop-tagged nav items drop out — core stays.
 */
const TENANT = { name: 'TyrePlus Thomastown', vertical: 'workshop' };

const TITLES = { dashboard: 'Good morning, Wai', bookings: "Today's bookings", assistant: 'Mercedes' };

function Placeholder({ label }) {
  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <p className="fg" style={{ color: 'var(--text-mute)', fontSize: 13 }}>
        <span className="cap" style={{ fontSize: 20, color: 'var(--text)' }}>{label}</span><br />
        Screen not built yet. Core screens first, then the workshop pack.
      </p>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('dashboard');

  // Filter nav by the tenant's vertical: core items always show; pack items only
  // when their pack matches the tenant's vertical.
  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.pack || i.pack === TENANT.vertical) }))
    .filter((s) => s.items.length);

  const label = sections.flatMap((s) => s.items).find((i) => i.key === active)?.label ?? active;
  const title = TITLES[active] ?? label;

  const Screen = SCREENS[active];

  return (
    <Layout title={title} sections={sections} activeKey={active} onNavigate={setActive}>
      {Screen ? <Screen /> : <Placeholder label={label} />}
    </Layout>
  );
}
