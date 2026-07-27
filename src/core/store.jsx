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
      const [{ data: jobRows, error: jobsErr }, { data: invRows, error: invErr }, { data: bookRows, error: bookErr }] = await Promise.all([
        supabase.from('jobs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      ]);
      if (jobsErr) console.error('Supabase: failed to load jobs', jobsErr);
      if (invErr) console.error('Supabase: failed to load invoices', invErr);
      if (bookErr) console.error('Supabase: failed to load bookings', bookErr);

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

  return (
    <Ctx.Provider value={{
      active, setActive,
      jobs, setJobs,
      invoices, setInvoices,
      bookings, setBookings, addPortalBooking,
      jobCard, updateJobCard,
      startJobCard, generateInvoice, saveJobLines, markInvoicePaid,
      flash, setFlash,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export { fmt };
