import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * App store — shared data layer for the app. Runs on in-memory sample data by
 * default; when VITE_SUPABASE_URL/ANON_KEY are set (see .env.example +
 * supabase/schema.sql), it loads from and persists to Supabase instead, with
 * the exact same shape and API — no screen needs to change either way.
 */
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const fmt = (n) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SEED_JOBS = [
  { id: 'J-0412', customer: 'T. Nguyen', vehicle: 'Ford Ranger', tech: 'Sam', status: 'In progress', total: 1364,
    lines: [['Major service', 1, 420], ['Front brake pads + rotors', 1, 690], ['Wheel alignment', 1, 130]] },
  { id: 'J-0418', customer: 'A. Costa', vehicle: 'Audi A4', tech: 'Dean', status: 'Ready', total: 759,
    lines: [['Service B', 1, 560], ['Cabin filter', 1, 79]] },
  { id: 'J-0409', customer: 'M. Petrakis', vehicle: 'VW Golf GTI', tech: 'Sam', status: 'Awaiting approval', total: 594,
    lines: [['Diagnostic scan', 1, 150], ['Ignition coil pack', 1, 390]] },
  { id: 'J-0421', customer: 'S. Bianchi', vehicle: 'Mini Cooper S', tech: 'Anthony', status: 'Completed', total: 462,
    lines: [['Logbook service', 1, 420]] },
  { id: 'J-0424', customer: 'L. Farrow', vehicle: 'Toyota Hilux', tech: 'Dean', status: 'Booked', total: 0, lines: [] },
];

const SEED_BOOKINGS = [
  { id: 'b1', time: '08:30', vehicle: 'BMW 320i · WLR 442', customer: 'T. Nguyen', phone: '', service: 'Service', bay: 'Bay 1', source: 'internal', day: '', notes: '' },
  { id: 'b2', time: '10:00', vehicle: 'Golf GTI · 1TY 9KH', customer: 'A. Costa', phone: '', service: 'Brakes', bay: 'Bay 2', source: 'portal', day: '', notes: '' },
  { id: 'b3', time: '13:15', vehicle: 'Hilux SR5 · 8QT 3ZL', customer: 'L. Farrow', phone: '', service: 'Diagnostic', bay: 'Bay 3', source: 'internal', day: '', notes: '' },
];

const SEED_INVOICES = [
  { id: 'INV-1042', customer: 'T. Nguyen', job: 'Job #J-0412', terms: 'Net 14', dueBy: '26 Jun', status: 'Overdue', amount: 1364, creditHold: true, fromJob: true },
  { id: 'INV-1039', customer: 'M. Petrakis', job: 'Job #J-0409', terms: 'Net 7', dueBy: '22 Jul', status: 'Overdue', amount: 594 },
  { id: 'INV-1051', customer: 'A. Costa', job: 'Job #J-0418', terms: 'Net 30', dueBy: '17 Aug', status: 'Sent', amount: 759, fromJob: true },
  { id: 'INV-1053', customer: 'L. Farrow', job: 'Fleet · Baxter', terms: 'On account', dueBy: '—', status: 'On account', amount: 1232, onAccount: true },
  { id: 'INV-1055', customer: 'S. Bianchi', job: 'Job #J-0421', terms: 'Due on receipt', dueBy: '26 Jul', status: 'Paid', amount: 462 },
];

const SEED_CUSTOMERS = [
  { id: crypto.randomUUID(), name: 'T. Nguyen', phone: '0412 663 921', vehicle: 'Ford Ranger', lastVisit: '12 Jul', status: 'Credit hold', spend: 4820,
    jobHistory: [{ service: 'Major service + brakes', date: '12 Jul 2026', total: '$1,240' }, { service: '4× tyres 265/60R18', date: '3 Mar 2026', total: '$1,690' }] },
  { id: crypto.randomUUID(), name: 'A. Costa', phone: '0403 118 447', vehicle: 'Audi A4', lastVisit: '18 Jul', status: 'Regular', spend: 8140,
    jobHistory: [{ service: 'Service B + alignment', date: '18 Jul 2026', total: '$690' }, { service: 'Front rotors + pads', date: '2 Jun 2026', total: '$980' }] },
  { id: crypto.randomUUID(), name: 'M. Petrakis', phone: '0439 552 108', vehicle: 'VW Golf GTI', lastVisit: '20 Jul', status: 'Overdue', spend: 3260,
    jobHistory: [{ service: 'Diagnostic + coil pack', date: '20 Jul 2026', total: '$540' }] },
  { id: crypto.randomUUID(), name: 'L. Farrow', phone: '0418 907 233', vehicle: 'Toyota Hilux', lastVisit: '5 Jul', status: 'Store credit', spend: 6910,
    jobHistory: [{ service: 'Roadworthy + repairs', date: '5 Jul 2026', total: '$1,120' }, { service: '4× tyres + rotation', date: '10 Jan 2026', total: '$1,480' }] },
  { id: crypto.randomUUID(), name: 'S. Bianchi', phone: '0421 774 560', vehicle: 'Mini Cooper S', lastVisit: '22 Jul', status: 'Regular', spend: 2540,
    jobHistory: [{ service: 'Logbook service', date: '22 Jul 2026', total: '$420' }] },
];

const SEED_VEHICLES = [
  { id: crypto.randomUUID(), model: 'Ford Ranger', rego: 'WLR 442', owner: 'T. Nguyen', odo: '68,420 km', lastService: '12 Jul', nextDue: '12 Jan 2027', status: 'Serviced',
    history: [{ service: 'Major service + brakes', date: '12 Jul 2026', total: '$1,240' }, { service: '4× tyres 265/60R18', date: '3 Mar 2026', total: '$1,690' }] },
  { id: crypto.randomUUID(), model: 'Audi A4', rego: '1TY 9KH', owner: 'A. Costa', odo: '41,200 km', lastService: '18 Jul', nextDue: '18 Jan 2027', status: 'Serviced',
    history: [{ service: 'Service B + alignment', date: '18 Jul 2026', total: '$690' }] },
  { id: crypto.randomUUID(), model: 'VW Golf GTI', rego: '8QT 3ZL', owner: 'M. Petrakis', odo: '55,900 km', lastService: '20 Jul', nextDue: '20 Oct 2026', status: 'Due soon',
    history: [{ service: 'Diagnostic + coil pack', date: '20 Jul 2026', total: '$540' }] },
  { id: crypto.randomUUID(), model: 'Toyota Hilux', rego: 'HLX 019', owner: 'L. Farrow', odo: '112,600 km', lastService: '5 Jan', nextDue: '5 Jul 2026', status: 'Overdue',
    history: [{ service: 'Roadworthy + repairs', date: '5 Jan 2026', total: '$1,120' }] },
  { id: crypto.randomUUID(), model: 'Mini Cooper S', rego: 'MCS 771', owner: 'S. Bianchi', odo: '29,300 km', lastService: '22 Jul', nextDue: '22 Jan 2027', status: 'Serviced',
    history: [{ service: 'Logbook service', date: '22 Jul 2026', total: '$420' }] },
];

export const blankJobCard = () => ({
  customer: '', vehicle: '', workTypes: {},
  parts: Array.from({ length: 8 }, () => ({ qty: '', desc: '', partNo: '', unit: '' })),
  labour: '', sundries: '',
});

export const jobCardNet = (jc) => {
  const partsTotal = jc.parts.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unit) || 0), 0);
  return partsTotal + (parseFloat(jc.labour) || 0) + (parseFloat(jc.sundries) || 0);
};

const nextNum = (list, prefix, floor) => {
  let max = floor;
  let width = String(floor).length;
  for (const x of list) {
    const digits = (x.id.match(/\d+/) || [String(floor)])[0];
    const n = parseInt(digits, 10);
    if (n > max) max = n;
    if (digits.length > width) width = digits.length;
  }
  return prefix + String(max + 1).padStart(width, '0');
};

// --- Supabase row <-> app-shape mapping ------------------------------------
// Every row is scoped to the current tenant's org_id (see supabase/schema.sql
// Phase 1: Auth + Multi-Tenancy) — RLS rejects writes for any other org, this
// is just so the row shape matches on the way in.
const jobToRow = (j, orgId) => ({ id: j.id, org_id: orgId, customer: j.customer, vehicle: j.vehicle, tech: j.tech, status: j.status, total: j.total, lines: j.lines });
const jobFromRow = (r) => ({ id: r.id, customer: r.customer, vehicle: r.vehicle, tech: r.tech, status: r.status, total: Number(r.total), lines: r.lines || [] });
const invoiceToRow = (i, orgId) => ({ id: i.id, org_id: orgId, customer: i.customer, job: i.job, terms: i.terms, due_by: i.dueBy, status: i.status, amount: i.amount, credit_hold: !!i.creditHold, from_job: !!i.fromJob, on_account: !!i.onAccount });
const invoiceFromRow = (r) => ({ id: r.id, customer: r.customer, job: r.job, terms: r.terms, dueBy: r.due_by, status: r.status, amount: Number(r.amount), creditHold: r.credit_hold, fromJob: r.from_job, onAccount: r.on_account });
const bookingToRow = (b, orgId) => ({ id: b.id, org_id: orgId, customer: b.customer, phone: b.phone || '', vehicle: b.vehicle, service: b.service, day: b.day || '', time: b.time, notes: b.notes || '', source: b.source, bay: b.bay || '' });
const bookingFromRow = (r) => ({ id: r.id, customer: r.customer, phone: r.phone, vehicle: r.vehicle, service: r.service, day: r.day, time: r.time, notes: r.notes, source: r.source, bay: r.bay || (r.source === 'portal' ? 'TBC' : '') });
const customerToRow = (c, orgId) => ({ id: c.id, org_id: orgId, name: c.name, phone: c.phone || '', email: c.email || '', vehicle: c.vehicle || '', last_visit: c.lastVisit || '', status: c.status, spend: c.spend, job_history: c.jobHistory || [] });
const customerFromRow = (r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email || '', vehicle: r.vehicle, lastVisit: r.last_visit, status: r.status, spend: Number(r.spend), jobHistory: r.job_history || [] });
const vehicleToRow = (v, orgId) => ({ id: v.id, org_id: orgId, model: v.model, rego: v.rego || '', owner: v.owner || '', odo: v.odo || '', last_service: v.lastService || '', next_due: v.nextDue || '', status: v.status, history: v.history || [] });
const vehicleFromRow = (r) => ({ id: r.id, model: r.model, rego: r.rego, owner: r.owner, odo: r.odo, lastService: r.last_service, nextDue: r.next_due, status: r.status, history: r.history || [] });

async function persistJob(job, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('jobs').upsert(jobToRow(job, orgId));
  if (error) console.error('Supabase: failed to save job', job.id, error);
}
async function persistInvoice(inv, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('invoices').upsert(invoiceToRow(inv, orgId));
  if (error) console.error('Supabase: failed to save invoice', inv.id, error);
}
async function persistBooking(b, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('bookings').upsert(bookingToRow(b, orgId));
  if (error) console.error('Supabase: failed to save booking', b.id, error);
}
async function persistCustomer(c, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('customers').upsert(customerToRow(c, orgId));
  if (error) console.error('Supabase: failed to save customer', c.id, error);
}
async function persistVehicle(v, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('vehicles').upsert(vehicleToRow(v, orgId));
  if (error) console.error('Supabase: failed to save vehicle', v.id, error);
}

// Best-effort push to Xero (see XERO_INTEGRATION.md) — fires on invoice
// creation and on Mark-as-paid. Never awaited by callers and never throws:
// if Xero isn't connected, or the push fails, the local invoice flow is
// completely unaffected either way.
function syncInvoiceToXero(inv, event) {
  fetch('/api/xero/sync-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice: inv, event }),
  }).catch(() => {});
}

export function StoreProvider({ orgId, children }) {
  const [active, setActive] = useState('dashboard');
  const [jobs, setJobs] = useState(SEED_JOBS);
  const [invoices, setInvoices] = useState(SEED_INVOICES);
  const [bookings, setBookings] = useState(SEED_BOOKINGS);
  const [customers, setCustomers] = useState(SEED_CUSTOMERS);
  const [vehicles, setVehicles] = useState(SEED_VEHICLES);
  const [jobCard, setJobCard] = useState(blankJobCard());
  const [activeJobId, setActiveJobId] = useState(null);
  const [flash, setFlash] = useState(null); // id of a just-created/updated record to highlight

  // On mount (and whenever the tenant changes): if a Supabase project is
  // configured and we know which org we're in, load that org's rows,
  // bootstrapping the seed rows into it the first time so the demo data
  // lives there too. Without an orgId (Supabase not configured, or the
  // portal's VITE_DEFAULT_ORG_ID isn't set yet) this stays on in-memory
  // sample data — same fallback pattern as before.
  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;
    (async () => {
      const [
        { data: jobRows, error: jobsErr },
        { data: invRows, error: invErr },
        { data: bookRows, error: bookErr },
        { data: custRows, error: custErr },
        { data: vehRows, error: vehErr },
      ] = await Promise.all([
        supabase.from('jobs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      ]);
      if (jobsErr) console.error('Supabase: failed to load jobs', jobsErr);
      if (invErr) console.error('Supabase: failed to load invoices', invErr);
      if (bookErr) console.error('Supabase: failed to load bookings', bookErr);
      if (custErr) console.error('Supabase: failed to load customers', custErr);
      if (vehErr) console.error('Supabase: failed to load vehicles', vehErr);

      if (!jobsErr && jobRows && jobRows.length === 0) {
        await supabase.from('jobs').upsert(SEED_JOBS.map((j) => jobToRow(j, orgId)));
        setJobs(SEED_JOBS);
      } else if (!jobsErr && jobRows) {
        setJobs(jobRows.map(jobFromRow));
      }

      if (!invErr && invRows && invRows.length === 0) {
        await supabase.from('invoices').upsert(SEED_INVOICES.map((i) => invoiceToRow(i, orgId)));
        setInvoices(SEED_INVOICES);
      } else if (!invErr && invRows) {
        setInvoices(invRows.map(invoiceFromRow));
      }

      if (!bookErr && bookRows && bookRows.length === 0) {
        await supabase.from('bookings').upsert(SEED_BOOKINGS.map((b) => bookingToRow(b, orgId)));
        setBookings(SEED_BOOKINGS);
      } else if (!bookErr && bookRows) {
        setBookings(bookRows.map(bookingFromRow));
      }

      if (!custErr && custRows && custRows.length === 0) {
        await supabase.from('customers').upsert(SEED_CUSTOMERS.map((c) => customerToRow(c, orgId)));
        setCustomers(SEED_CUSTOMERS);
      } else if (!custErr && custRows) {
        setCustomers(custRows.map(customerFromRow));
      }

      if (!vehErr && vehRows && vehRows.length === 0) {
        await supabase.from('vehicles').upsert(SEED_VEHICLES.map((v) => vehicleToRow(v, orgId)));
        setVehicles(SEED_VEHICLES);
      } else if (!vehErr && vehRows) {
        setVehicles(vehRows.map(vehicleFromRow));
      }
    })();
  }, [orgId]);

  const updateJobCard = (patch) => setJobCard((jc) => ({ ...jc, ...patch }));

  // Booking/customer → job card: creates the linked job (status In progress),
  // pre-fills the front page, and jumps to Inspections.
  const startJobCard = (prefill) => {
    const id = nextNum(jobs, 'J-', 424);
    const job = { id, customer: prefill.customer || '', vehicle: prefill.vehicle || '', tech: '', status: 'In progress', total: 0, lines: [] };
    setJobs((list) => [job, ...list]);
    persistJob(job, orgId);
    setActiveJobId(id);
    setJobCard({ ...blankJobCard(), ...prefill });
    setActive('inspections');
  };

  // Filled job card → invoice: carries parts & labour + GST into Invoices, and
  // marks the linked job Completed with the same lines/total. No re-keying.
  const generateInvoice = () => {
    const net = jobCardNet(jobCard);
    if (net <= 0) return null;
    const amount = Math.round(net * 1.1 * 100) / 100;
    const lines = jobCard.parts.filter((r) => r.desc && (parseFloat(r.qty) || 0) > 0).map((r) => [r.desc, parseFloat(r.qty) || 0, (parseFloat(r.qty) || 0) * (parseFloat(r.unit) || 0)]);
    if (parseFloat(jobCard.labour) > 0) lines.push(['Labour', 1, parseFloat(jobCard.labour)]);
    if (parseFloat(jobCard.sundries) > 0) lines.push(['Sundries / disposal', 1, parseFloat(jobCard.sundries)]);

    const jobId = activeJobId || nextNum(jobs, 'J-', 424);
    const existingJob = activeJobId ? jobs.find((j) => j.id === activeJobId) : null;
    const savedJob = existingJob
      ? { ...existingJob, status: 'Completed', total: amount, lines }
      : { id: jobId, customer: jobCard.customer || 'Walk-in', vehicle: jobCard.vehicle || '', tech: '', status: 'Completed', total: amount, lines };
    setJobs((list) => (existingJob ? list.map((j) => (j.id === jobId ? savedJob : j)) : [savedJob, ...list]));
    persistJob(savedJob, orgId);

    const invId = nextNum(invoices, 'INV-', 1055);
    const inv = { id: invId, customer: jobCard.customer || 'Walk-in', job: 'Job #' + jobId, terms: 'Due on receipt', dueBy: 'Today', status: 'Sent', amount, fromJob: true };
    setInvoices((list) => [inv, ...list]);
    persistInvoice(inv, orgId);
    syncInvoiceToXero(inv, 'created');
    setFlash(inv.id);
    setJobCard(blankJobCard());
    setActiveJobId(null);
    setActive('invoices');
    return inv;
  };

  // Jobs screen: save a job's edited line items + recomputed total.
  const saveJobLines = (id, lines, total) => {
    const existing = jobs.find((j) => j.id === id);
    if (!existing) return;
    const saved = { ...existing, lines, total };
    setJobs((list) => list.map((j) => (j.id === id ? saved : j)));
    persistJob(saved, orgId);
  };

  // Invoices screen: mark an invoice paid.
  const markInvoicePaid = (id) => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) return;
    const saved = { ...existing, status: 'Paid' };
    setInvoices((list) => list.map((i) => (i.id === id ? saved : i)));
    persistInvoice(saved, orgId);
    syncInvoiceToXero(saved, 'paid');
  };

  // Customer Booking Portal → a real booking, persisted the same way staff
  // bookings are. Replaces the prototype's localStorage bridge now that
  // there's an actual shared backend.
  const addPortalBooking = ({ customer, phone, vehicle, service, day, time, notes }) => {
    const booking = { id: 'portal-' + Date.now().toString(36), customer, phone, vehicle, service, day, time, notes, source: 'portal', bay: 'TBC' };
    setBookings((list) => [booking, ...list]);
    persistBooking(booking, orgId);
    return booking;
  };

  // Customers screen: "+ New customer".
  const addCustomer = ({ name, phone, email, vehicle, status }) => {
    const customer = { id: crypto.randomUUID(), name, phone: phone || '', email: email || '', vehicle: vehicle || '', lastVisit: '', status: status || 'Regular', spend: 0, jobHistory: [] };
    setCustomers((list) => [customer, ...list]);
    persistCustomer(customer, orgId);
    return customer;
  };

  // Vehicles screen: "+ New vehicle".
  const addVehicle = ({ model, rego, owner, odo, status }) => {
    const vehicle = { id: crypto.randomUUID(), model, rego: rego || '', owner: owner || '', odo: odo || '', lastService: '', nextDue: '', status: status || 'Serviced', history: [] };
    setVehicles((list) => [vehicle, ...list]);
    persistVehicle(vehicle, orgId);
    return vehicle;
  };

  return (
    <Ctx.Provider value={{
      active, setActive,
      jobs, setJobs,
      invoices, setInvoices,
      bookings, setBookings, addPortalBooking,
      customers, setCustomers, addCustomer,
      vehicles, setVehicles, addVehicle,
      jobCard, updateJobCard,
      startJobCard, generateInvoice, saveJobLines, markInvoicePaid,
      flash, setFlash,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export { fmt };
