/**
 * Sidebar navigation — faithful to the Front-of-House prototype (sections, order,
 * icons, badges). Each item is tagged `pack`: undefined = generic CORE, 'workshop'
 * = the workshop vertical pack. App filters items by the tenant's vertical, so a
 * non-workshop tenant simply doesn't see the workshop-tagged items.
 *
 * Icons are the prototype's own inline SVG (24x24, stroked).
 */
const I = {
  dashboard: '<rect x="3" y="3" width="8" height="8" rx="2"></rect><rect x="13" y="3" width="8" height="5" rx="2"></rect><rect x="13" y="11" width="8" height="10" rx="2"></rect><rect x="3" y="14" width="8" height="7" rx="2"></rect>',
  mercedes: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path>',
  threecx: '<path d="M4 5c0 8.8 6.2 15 15 15l2-4-5-2-2 2c-2.5-1-4-2.5-5-5l2-2-2-5z"></path>',
  comms: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"></path>',
  bookings: '<rect x="3" y="5" width="18" height="16" rx="2.5"></rect><path d="M3 9.5h18M8 3v4M16 3v4"></path>',
  pubBooking: '<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4M16 2v4M3 10h18"></path><circle cx="12" cy="15" r="2"></circle>',
  inspections: '<path d="M12 2l8 3.5v6c0 5-3.4 8.8-8 10.5-4.6-1.7-8-5.5-8-10.5v-6L12 2z"></path><path d="M9 12l2 2 4-4"></path>',
  car: '<path d="M4 16l1.6-5.2A2.5 2.5 0 018 9h8a2.5 2.5 0 012.4 1.8L20 16"></path><rect x="2.5" y="16" width="19" height="4" rx="1.4"></rect><circle cx="7" cy="20" r="1.4"></circle><circle cx="17" cy="20" r="1.4"></circle>',
  jobs: '<path d="M14.7 6.3a3 3 0 01-4 4L5 16v3h3l5.7-5.7a3 3 0 014-4l-2.7-2.7z"></path>',
  invoices: '<path d="M6 3h12v18l-2.5-1.5L13 21l-1-1.5L11 21l-2.5-1.5L6 21z"></path><path d="M9 8h6M9 12h6"></path>',
  statements: '<path d="M7 3h10l3 4v14H4V7z"></path><path d="M8 11h8M8 15h8M8 19h5"></path>',
  customers: '<circle cx="9" cy="8" r="3"></circle><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path><circle cx="17" cy="8" r="2.5"></circle><path d="M15.5 14.2A5.4 5.4 0 0121 20"></path>',
  products: '<path d="M21 8l-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8M12 13v8"></path>',
  tyre: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3.4"></circle><path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"></path>',
  stock: '<rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M9 3h6v3H9zM8 11l2 2 4-4M8 16h6"></path>',
  suppliers: '<rect x="2" y="7" width="15" height="11" rx="1.5"></rect><path d="M17 10h3l2 3v5h-5z"></path><circle cx="6.5" cy="18.5" r="1.8"></circle><circle cx="17.5" cy="18.5" r="1.8"></circle>',
  team: '<circle cx="12" cy="8" r="3.2"></circle><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"></path>',
  hr: '<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c0-3.9 3.1-7 6-7s6 3.1 6 7"></path><path d="M17 8h4M19 6v4"></path>',
  accounts: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 9h10M7 13h6M7 17h4"></path>',
  reports: '<path d="M4 20V10M11 20V4M18 20v-7"></path>',
  reviews: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"></path>',
  leadsFunnel: '<path d="M4 4h16l-6.5 8.2V19l-3 1.5v-8.3z"></path>',
};

export const SECTIONS = [
  {
    title: 'FLOOR',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: I.dashboard },
      { key: 'assistant', label: 'Mercedes', icon: I.mercedes, badge: 'AGENT', badgeAccent: true },
      { key: 'phone', label: '3CX', icon: I.threecx },
      { key: 'comms', label: 'Comms', icon: I.comms, badge: '2' },
      { key: 'bookings', label: 'Bookings', icon: I.bookings, badge: '3' },
      { key: 'pubBooking', label: 'Public Booking', icon: I.pubBooking },
      { key: 'inspections', label: 'Inspections', icon: I.inspections, pack: 'workshop' },
      { key: 'loanCars', label: 'Loan Cars', icon: I.car, badge: '1', badgeAccent: true, pack: 'workshop' },
    ],
  },
  {
    title: 'REGISTER',
    items: [
      { key: 'leadsFunnel', label: 'Leads Funnel', icon: I.leadsFunnel },
      { key: 'jobs', label: 'Jobs', icon: I.jobs, badge: '4' },
      { key: 'invoices', label: 'Invoices', icon: I.invoices, badge: '2' },
      { key: 'statements', label: 'Statements', icon: I.statements },
      { key: 'customers', label: 'Customers', icon: I.customers },
      { key: 'vehicles', label: 'Vehicles', icon: I.car, pack: 'workshop' },
      { key: 'tyreStock', label: 'Tyre Stock', icon: I.tyre, pack: 'workshop' },
      { key: 'products', label: 'Parts', icon: I.products, pack: 'workshop' },
      { key: 'stock', label: 'Stock Take', icon: I.stock, pack: 'workshop' },
      { key: 'suppliers', label: 'Suppliers', icon: I.suppliers, pack: 'workshop' },
      { key: 'team', label: 'Team', icon: I.team },
    ],
  },
  {
    title: 'BUSINESS',
    items: [
      { key: 'hr', label: 'HR', icon: I.hr, badge: '2' },
      { key: 'accounts', label: 'Accounts', icon: I.accounts },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { key: 'reports', label: 'Reports', icon: I.reports },
      { key: 'reviews', label: 'Reviews', icon: I.reviews },
    ],
  },
];
