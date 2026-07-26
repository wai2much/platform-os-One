import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { CORE_SECTIONS } from '@/core/registry';
import { workshopPack } from '@/verticals/workshop';
import { Dashboard } from '@/core/pages/Dashboard';

/**
 * Demo tenant. In the product this comes from the signed-in org (multi-tenant).
 * Switch `vertical` and the enabled packs change — the core stays the same.
 */
const TENANT = { name: 'TyrePlus Thomastown', vertical: 'workshop' };

// Available vertical packs, keyed by id.
const PACKS = { workshop: workshopPack };

function Placeholder({ label }) {
  return (
    <div className="mx-auto max-w-6xl px-8 py-7">
      <h1 className="text-4xl">{label}</h1>
      <p className="mt-3 text-muted-foreground">
        Screen not built yet. Core screens come first, then the workshop pack.
      </p>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('dashboard');

  const pack = PACKS[TENANT.vertical];
  const sections = [...CORE_SECTIONS, ...(pack?.sections ?? [])];

  const label = sections.flatMap((s) => s.items).find((i) => i.key === active)?.label ?? active;

  return (
    <Layout tenant={TENANT} sections={sections} activeKey={active} onNavigate={setActive}>
      {active === 'dashboard' ? <Dashboard tenant={TENANT} /> : <Placeholder label={label} />}
    </Layout>
  );
}
