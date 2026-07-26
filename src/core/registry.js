import {
  LayoutDashboard, Users, Briefcase, FileText, MessageSquare,
  CalendarDays, Sparkles, UsersRound, Wallet, Settings,
} from 'lucide-react';

/**
 * CORE navigation — generic to ANY business. The core must never assume a
 * vertical. Vertical packs (see src/verticals/*) append their own sections.
 */
export const CORE_SECTIONS = [
  {
    title: 'Operate',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'jobs', label: 'Jobs', icon: Briefcase },
      { key: 'bookings', label: 'Bookings', icon: CalendarDays },
      { key: 'comms', label: 'Comms', icon: MessageSquare },
      { key: 'assistant', label: 'Assistant', icon: Sparkles },
    ],
  },
  {
    title: 'Records',
    items: [
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    title: 'Business',
    items: [
      { key: 'team', label: 'Team', icon: UsersRound },
      { key: 'accounts', label: 'Accounts', icon: Wallet },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];
