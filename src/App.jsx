import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useStore } from '@/core/store';
import { useAuth } from '@/core/auth';
import { SECTIONS } from '@/core/registry';
import { Dashboard } from '@/core/pages/Dashboard';
import { Customers } from '@/core/pages/Customers';
import { Invoices } from '@/core/pages/Invoices';
import { Jobs } from '@/core/pages/Jobs';
import { Bookings } from '@/core/pages/Bookings';
import { LeadsFunnel } from '@/core/pages/LeadsFunnel';
import { JobCard } from '@/verticals/workshop/JobCard';
import { Mercedes } from '@/core/pages/Mercedes';
import { Team } from '@/core/pages/Team';
import { Comms } from '@/core/pages/Comms';
import { Accounts } from '@/core/pages/Accounts';
import { Reports } from '@/core/pages/Reports';
import { Suppliers } from '@/core/pages/Suppliers';
import { Vehicles } from '@/verticals/workshop/Vehicles';
import { Statements } from '@/core/pages/Statements';
import { Reviews } from '@/core/pages/Reviews';
import { Products } from '@/verticals/workshop/Products';
import { TyreStock } from '@/verticals/workshop/TyreStock';
import { LoanCars } from '@/verticals/workshop/LoanCars';
import { Settings } from '@/core/pages/Settings';
import { HR } from '@/core/pages/HR';
import { PublicBooking } from '@/core/pages/PublicBooking';
import { Phone } from '@/core/pages/Phone';
import { StockTake } from '@/verticals/workshop/StockTake';

const SCREENS = { dashboard: Dashboard, customers: Customers, invoices: Invoices, jobs: Jobs, bookings: Bookings, leadsFunnel: LeadsFunnel, inspections: JobCard, assistant: Mercedes, team: Team, comms: Comms, accounts: Accounts, reports: Reports, suppliers: Suppliers, vehicles: Vehicles, statements: Statements, reviews: Reviews, products: Products, tyreStock: TyreStock, loanCars: LoanCars, settings: Settings, hr: HR, pubBooking: PublicBooking, phone: Phone, stock: StockTake };

const TITLES = { bookings: "Today's bookings", assistant: 'Mercedes', settings: 'Settings' };

/**
 * Dashboard greeting. Was hardcoded "Good morning" — which read as wrong for
 * most of a workshop's day, since the shop is open well past noon and staff
 * have this on screen until close. Boundaries chosen for a trade business:
 * morning until midday, afternoon until 5, then evening.
 */
function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

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

// Nav badges the store has real data for. Everything else (comms, stock,
// etc.) keeps registry.js's static placeholder until that screen is real.
const useLiveBadges = () => {
  const { jobs, invoices, bookings, leave, loanCars } = useStore();
  return {
    jobs: String(jobs.length),
    invoices: String(invoices.length),
    bookings: String(bookings.length),
    hr: String(leave.filter((l) => l.status === 'Pending').length),
    loanCars: String(loanCars.filter((c) => c.status === 'Out').length),
  };
};

export default function App() {
  const { active, setActive } = useStore();
  const { user, org, signOut } = useAuth();
  const liveBadges = useLiveBadges();

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // Re-evaluated every 5 min so the greeting rolls over on a screen that
  // sits open from open to close, rather than being fixed at page load.
  const [greet, setGreet] = useState(() => greeting(new Date().getHours()));
  useEffect(() => {
    const id = setInterval(() => setGreet(greeting(new Date().getHours())), 300000);
    return () => clearInterval(id);
  }, []);

  // Filter nav by the tenant's vertical: core items always show; pack items only
  // when their pack matches the tenant's vertical. Badges swap in live counts
  // where the store has real data (see useLiveBadges).
  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.pack || i.pack === org.vertical).map((i) => (i.key in liveBadges ? { ...i, badge: liveBadges[i.key] } : i)) }))
    .filter((s) => s.items.length);

  const label = sections.flatMap((s) => s.items).find((i) => i.key === active)?.label ?? active;
  const title = active === 'dashboard' ? `${greet}, ${firstName}` : (TITLES[active] ?? label);

  const Screen = SCREENS[active];

  return (
    <Layout title={title} sections={sections} activeKey={active} onNavigate={setActive} user={user} org={org} onSignOut={signOut}>
      {Screen ? <Screen /> : <Placeholder label={label} />}
    </Layout>
  );
}
