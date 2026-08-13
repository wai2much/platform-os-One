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

// Mock/demo seed data removed 2026-07-30 — the app is going in front of real
// front-office staff now, and this used to auto-write fake rows (T. Nguyen,
// Burson Auto Parts, etc.) into the real Supabase database the first time a
// table came back empty (see the removed bootstrap block in the load effect
// below). Every list below now genuinely starts empty. If any fake rows from
// that old bootstrap are already sitting in production, they need clearing
// out via Supabase's Table Editor — removing this code doesn't retroactively
// delete anything that already got written.

export const blankJobCard = () => ({
  customer: '', vehicle: '', workTypes: {},
  parts: Array.from({ length: 8 }, () => ({ qty: '', desc: '', partNo: '', unit: '', productId: null })),
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
// `migrated` marks rows imported from MechanicDesk on 2026-07-30 (see schema
// Phase 8). Their payment state reflects the old system's bookkeeping, which
// is known to be unreliable, so live financial figures must exclude them —
// use the isLive/isHistorical helpers below rather than testing the flag
// ad hoc, so every screen agrees on what counts.
const invoiceFromRow = (r) => ({ id: r.id, customer: r.customer, job: r.job, terms: r.terms, dueBy: r.due_by, status: r.status, amount: Number(r.amount), creditHold: r.credit_hold, fromJob: r.from_job, onAccount: r.on_account, createdAt: r.created_at, migrated: !!r.migrated });

/** Invoices raised in Platform OS — the only ones safe to report money from. */
export const liveInvoices = (invoices) => invoices.filter((i) => !i.migrated);
/** Imported history — real work, unreliable payment state. Reference only. */
export const historicalInvoices = (invoices) => invoices.filter((i) => i.migrated);
const bookingToRow = (b, orgId) => ({ id: b.id, org_id: orgId, customer: b.customer, phone: b.phone || '', vehicle: b.vehicle, service: b.service, day: b.day || '', time: b.time, notes: b.notes || '', source: b.source, bay: b.bay || '' });
const bookingFromRow = (r) => ({ id: r.id, customer: r.customer, phone: r.phone, vehicle: r.vehicle, service: r.service, day: r.day, time: r.time, notes: r.notes, source: r.source, bay: r.bay || (r.source === 'portal' ? 'TBC' : ''), createdAt: r.created_at });
const customerToRow = (c, orgId) => ({ id: c.id, org_id: orgId, name: c.name, phone: c.phone || '', email: c.email || '', vehicle: c.vehicle || '', last_visit: c.lastVisit || '', status: c.status, spend: c.spend, job_history: c.jobHistory || [] });
const customerFromRow = (r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email || '', vehicle: r.vehicle, lastVisit: r.last_visit, status: r.status, spend: Number(r.spend), jobHistory: r.job_history || [] });
const vehicleToRow = (v, orgId) => ({ id: v.id, org_id: orgId, model: v.model, rego: v.rego || '', owner: v.owner || '', odo: v.odo || '', last_service: v.lastService || '', next_due: v.nextDue || '', status: v.status, history: v.history || [] });
const vehicleFromRow = (r) => ({ id: r.id, model: r.model, rego: r.rego, owner: r.owner, odo: r.odo, lastService: r.last_service, nextDue: r.next_due, status: r.status, history: r.history || [] });
const teamToRow = (t, orgId) => ({ id: t.id, org_id: orgId, name: t.name, role: t.role || '', email: t.email || '', status: t.status || 'On shift', avg_time: t.avgTime || '', certs: t.certs || '' });
const teamFromRow = (r) => ({ id: r.id, name: r.name, role: r.role, email: r.email || '', status: r.status, avgTime: r.avg_time, certs: r.certs });
const supplierToRow = (s, orgId) => ({ id: s.id, org_id: orgId, name: s.name, suburb: s.suburb || '', phone: s.phone || '', website: s.website || '' });
const supplierFromRow = (r) => ({ id: r.id, name: r.name, suburb: r.suburb, phone: r.phone, website: r.website });
const reviewToRow = (r, orgId) => ({ id: r.id, org_id: orgId, name: r.name, rating: r.rating, platform: r.platform, review_date: r.date, review_text: r.text, replied: !!r.replied, sent_reply: r.sentReply || '' });
const reviewFromRow = (r) => ({ id: r.id, name: r.name, rating: r.rating, platform: r.platform, date: r.review_date, text: r.review_text, replied: r.replied, sentReply: r.sent_reply });
const hireToRow = (h, orgId) => ({ id: h.id, org_id: orgId, name: h.name, role: h.role || '', start_date: h.startDate || '', tasks: h.tasks || [], docs: h.docs || [] });
const hireFromRow = (r) => ({ id: r.id, name: r.name, role: r.role, startDate: r.start_date, tasks: r.tasks || [], docs: r.docs || [] });
const leaveToRow = (l, orgId) => ({ id: l.id, org_id: orgId, name: l.name, leave_type: l.type || '', dates: l.dates || '', status: l.status || 'Pending' });
const leaveFromRow = (r) => ({ id: r.id, name: r.name, type: r.leave_type, dates: r.dates, status: r.status });
const payrollToRow = (p, orgId) => ({ id: p.id, org_id: orgId, name: p.name, hours: p.hours, rate: p.rate, annual_leave_hours: p.annual, sick_leave_hours: p.sick, accrual_rate: p.accrualRate || '' });
const payrollFromRow = (r) => ({ id: r.id, name: r.name, hours: Number(r.hours), rate: Number(r.rate), annual: Number(r.annual_leave_hours), sick: Number(r.sick_leave_hours), accrualRate: r.accrual_rate });
const noteToRow = (n, orgId) => ({ id: n.id, org_id: orgId, name: n.name, severity: n.severity || 'Minor', note_date: n.date || '', note: n.note || '' });
const noteFromRow = (r) => ({ id: r.id, name: r.name, severity: r.severity, date: r.note_date, note: r.note });
const loanCarToRow = (c, orgId) => ({ id: c.id, org_id: orgId, car: c.car, status: c.status || 'Available', assigned_to: c.assignedTo || '', out_since: c.outSince || '', due_back: c.dueBack || '' });
const loanCarFromRow = (r) => ({ id: r.id, car: r.car, status: r.status, assignedTo: r.assigned_to, outSince: r.out_since, dueBack: r.due_back });
const partToRow = (p, orgId) => ({ id: p.id, org_id: orgId, name: p.name, size: p.size || '', stock: p.stock, price: p.price, status: p.status || 'In stock' });
const partFromRow = (r) => ({ id: r.id, name: r.name, size: r.size, stock: Number(r.stock), price: Number(r.price), status: r.status });
const tyreToRow = (t, orgId) => ({ id: t.id, org_id: orgId, brand: t.brand, model: t.model || '', size: t.size || '', rating: t.rating || '', qty: t.qty, cost: t.cost, sell: t.sell, reorder: t.reorder });
const tyreFromRow = (r) => ({ id: r.id, brand: r.brand, model: r.model, size: r.size, rating: r.rating, qty: Number(r.qty), cost: Number(r.cost), sell: Number(r.sell), reorder: Number(r.reorder) });
const stockTakeToRow = (s, orgId) => ({ id: s.id, org_id: orgId, name: s.name, system_qty: s.systemQty, counted: s.counted ?? '' });
const stockTakeFromRow = (r) => ({ id: r.id, name: r.name, systemQty: Number(r.system_qty), counted: r.counted ?? '' });

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
async function persistTeamMember(t, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('team_members').upsert(teamToRow(t, orgId));
  if (error) console.error('Supabase: failed to save team member', t.id, error);
}
async function persistSupplier(s, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('suppliers').upsert(supplierToRow(s, orgId));
  if (error) console.error('Supabase: failed to save supplier', s.id, error);
}
async function persistReview(r, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('reviews').upsert(reviewToRow(r, orgId));
  if (error) console.error('Supabase: failed to save review', r.id, error);
}
async function persistHire(h, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('hires').upsert(hireToRow(h, orgId));
  if (error) console.error('Supabase: failed to save hire', h.id, error);
}
async function persistLeave(l, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('leave_requests').upsert(leaveToRow(l, orgId));
  if (error) console.error('Supabase: failed to save leave request', l.id, error);
}
async function persistNote(n, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('disciplinary_notes').upsert(noteToRow(n, orgId));
  if (error) console.error('Supabase: failed to save disciplinary note', n.id, error);
}
async function persistLoanCar(c, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('loan_cars').upsert(loanCarToRow(c, orgId));
  if (error) console.error('Supabase: failed to save loan car', c.id, error);
}
async function persistPart(p, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('parts').upsert(partToRow(p, orgId));
  if (error) console.error('Supabase: failed to save part', p.id, error);
}
async function persistTyre(t, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('tyre_stock').upsert(tyreToRow(t, orgId));
  if (error) console.error('Supabase: failed to save tyre line', t.id, error);
}
async function persistStockTakeItem(s, orgId) {
  if (!isSupabaseConfigured || !orgId) return;
  const { error } = await supabase.from('stock_take_items').upsert(stockTakeToRow(s, orgId));
  if (error) console.error('Supabase: failed to save stock take item', s.id, error);
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
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [team, setTeam] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [hires, setHires] = useState([]);
  const [leave, setLeave] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [disciplinaryNotes, setDisciplinaryNotes] = useState([]);
  const [payrollRun, setPayrollRun] = useState(false);
  const [loanCars, setLoanCars] = useState([]);
  const [parts, setParts] = useState([]);
  const [tyreStock, setTyreStock] = useState([]);
  const [stockTakeItems, setStockTakeItems] = useState([]);
  const [stockTakeFinalized, setStockTakeFinalized] = useState(false);
  const [jobCard, setJobCard] = useState(blankJobCard());
  const [activeJobId, setActiveJobId] = useState(null);
  const [flash, setFlash] = useState(null); // id of a just-created/updated record to highlight

  // On mount (and whenever the tenant changes): if a Supabase project is
  // configured and we know which org we're in, load that org's real rows —
  // whatever's actually there, including nothing. No demo-data bootstrap:
  // an empty table stays empty and renders as a real empty state, it does
  // NOT get seeded with fake rows (that used to happen here — removed
  // 2026-07-30, see the comment above the old SEED_* block for why).
  // Without an orgId (Supabase not configured, or VITE_DEFAULT_ORG_ID isn't
  // set) every list just stays at its empty initial state — no mock data.
  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;
    (async () => {
      const [
        { data: jobRows, error: jobsErr },
        { data: invRows, error: invErr },
        { data: bookRows, error: bookErr },
        { data: custRows, error: custErr },
        { data: vehRows, error: vehErr },
        { data: teamRows, error: teamErr },
        { data: supRows, error: supErr },
        { data: revRows, error: revErr },
        { data: hireRows, error: hireErr },
        { data: leaveRows, error: leaveErr },
        { data: payRows, error: payErr },
        { data: noteRows, error: noteErr },
        { data: carRows, error: carErr },
        { data: partRows, error: partErr },
        { data: tyreRows, error: tyreErr },
        { data: stRows, error: stErr },
      ] = await Promise.all([
        supabase.from('jobs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('team_members').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('hires').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('leave_requests').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('payroll_entries').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('disciplinary_notes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('loan_cars').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('parts').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('tyre_stock').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('stock_take_items').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      ]);
      if (jobsErr) console.error('Supabase: failed to load jobs', jobsErr);
      if (invErr) console.error('Supabase: failed to load invoices', invErr);
      if (bookErr) console.error('Supabase: failed to load bookings', bookErr);
      if (custErr) console.error('Supabase: failed to load customers', custErr);
      if (vehErr) console.error('Supabase: failed to load vehicles', vehErr);
      if (teamErr) console.error('Supabase: failed to load team members', teamErr);
      if (supErr) console.error('Supabase: failed to load suppliers', supErr);
      if (revErr) console.error('Supabase: failed to load reviews', revErr);
      if (hireErr) console.error('Supabase: failed to load hires', hireErr);
      if (leaveErr) console.error('Supabase: failed to load leave requests', leaveErr);
      if (payErr) console.error('Supabase: failed to load payroll entries', payErr);
      if (noteErr) console.error('Supabase: failed to load disciplinary notes', noteErr);
      if (carErr) console.error('Supabase: failed to load loan cars', carErr);
      if (partErr) console.error('Supabase: failed to load parts', partErr);
      if (tyreErr) console.error('Supabase: failed to load tyre stock', tyreErr);
      if (stErr) console.error('Supabase: failed to load stock take items', stErr);

      if (!jobsErr && jobRows) setJobs(jobRows.map(jobFromRow));
      if (!invErr && invRows) setInvoices(invRows.map(invoiceFromRow));
      if (!bookErr && bookRows) setBookings(bookRows.map(bookingFromRow));
      if (!custErr && custRows) setCustomers(custRows.map(customerFromRow));
      if (!vehErr && vehRows) setVehicles(vehRows.map(vehicleFromRow));
      if (!teamErr && teamRows) setTeam(teamRows.map(teamFromRow));
      if (!supErr && supRows) setSuppliers(supRows.map(supplierFromRow));
      if (!revErr && revRows) setReviews(revRows.map(reviewFromRow));
      if (!hireErr && hireRows) setHires(hireRows.map(hireFromRow));
      if (!leaveErr && leaveRows) setLeave(leaveRows.map(leaveFromRow));
      if (!payErr && payRows) setPayroll(payRows.map(payrollFromRow));
      if (!noteErr && noteRows) setDisciplinaryNotes(noteRows.map(noteFromRow));
      if (!carErr && carRows) setLoanCars(carRows.map(loanCarFromRow));
      if (!partErr && partRows) setParts(partRows.map(partFromRow));
      if (!tyreErr && tyreRows) setTyreStock(tyreRows.map(tyreFromRow));
      if (!stErr && stRows) setStockTakeItems(stRows.map(stockTakeFromRow));
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

  // Job-card parts rows can be linked to a real inventory item (see
  // JobCard.jsx's parts picker, keyed by row.productId). On invoice
  // generation, decrement that item's stock by the qty used — this is the
  // "push parts into the job to get paid" link Vito asked for on 11 Aug.
  const consumePartStock = (rows) => {
    rows.forEach((r) => {
      if (!r.productId) return;
      const qty = parseFloat(r.qty) || 0;
      if (qty <= 0) return;
      const existing = parts.find((p) => p.id === r.productId);
      if (!existing) return;
      const saved = { ...existing, stock: Math.max(0, existing.stock - qty), status: existing.stock - qty <= 0 ? 'Low' : existing.status };
      setParts((list) => list.map((p) => (p.id === r.productId ? saved : p)));
      persistPart(saved, orgId);
    });
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
    consumePartStock(jobCard.parts);

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

  // Invoices screen: "+ New invoice" — a standalone invoice not linked to a job
  // (e.g. account/fleet billing). GST-inclusive amount, same shape as a
  // job-generated one just without `fromJob`/`job`.
  const addInvoice = ({ customer, terms, dueBy, amount }) => {
    const invId = nextNum(invoices, 'INV-', 1055);
    const inv = { id: invId, customer, job: '', terms: terms || 'Due on receipt', dueBy: dueBy || 'Today', status: 'Sent', amount: parseFloat(amount) || 0 };
    setInvoices((list) => [inv, ...list]);
    persistInvoice(inv, orgId);
    syncInvoiceToXero(inv, 'created');
    setFlash(inv.id);
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

  // Invoices screen: mark an invoice paid. `meta` is optional — the real
  // Zeller Terminal charge (src/lib/zeller.jsx) passes { paidVia: 'zeller',
  // transactionUuid, receiptLink, status } after a live purchase() success.
  // NOTE: invoiceToRow() doesn't whitelist these fields yet, so they show up
  // in the UI immediately but aren't persisted to Supabase until that row
  // mapper + a schema migration catch up — a known gap, not a silent one.
  const markInvoicePaid = (id, meta) => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) return;
    const saved = meta
      ? { ...existing, status: 'Paid', paidVia: meta.paidVia, zellerTransactionUuid: meta.transactionUuid, zellerReceiptLink: meta.receiptLink }
      : { ...existing, status: 'Paid' };
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

  // Bookings screen: "+ New booking" (staff-created, as opposed to a portal one).
  const addBooking = ({ customer, phone, vehicle, service, time, bay }) => {
    const booking = { id: 'b-' + Date.now().toString(36), customer, phone: phone || '', vehicle, service, day: '', time, notes: '', source: 'internal', bay: bay || '' };
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

  // Team screen: "+ Add team member".
  const addTeamMember = ({ name, role, email, status, certs }) => {
    const member = { id: crypto.randomUUID(), name, role: role || '', email: email || '', status: status || 'On shift', avgTime: '', certs: certs || '' };
    setTeam((list) => [member, ...list]);
    persistTeamMember(member, orgId);
    return member;
  };

  // Suppliers screen: "+ New supplier".
  const addSupplier = ({ name, suburb, phone, website }) => {
    const supplier = { id: crypto.randomUUID(), name, suburb: suburb || '', phone: phone || '', website: website || '' };
    setSuppliers((list) => [supplier, ...list]);
    persistSupplier(supplier, orgId);
    return supplier;
  };

  // Reviews screen: send a reply.
  const markReviewReplied = (id, text) => {
    const existing = reviews.find((r) => r.id === id);
    if (!existing) return;
    const saved = { ...existing, replied: true, sentReply: text };
    setReviews((list) => list.map((r) => (r.id === id ? saved : r)));
    persistReview(saved, orgId);
  };

  // HR / Onboarding: tick a checklist task.
  const toggleHireTask = (hireId, taskIdx) => {
    const existing = hires.find((h) => h.id === hireId);
    if (!existing) return;
    const saved = { ...existing, tasks: existing.tasks.map((t, i) => (i === taskIdx ? { ...t, done: !t.done } : t)) };
    setHires((list) => list.map((h) => (h.id === hireId ? saved : h)));
    persistHire(saved, orgId);
  };

  // HR / Onboarding: "+ New hire".
  const addHire = ({ name, role, startDate }) => {
    const hire = {
      id: crypto.randomUUID(), name, role: role || '', startDate: startDate || '',
      tasks: [
        { label: 'Contract signed', done: false }, { label: 'Uniform issued', done: false },
        { label: 'Toolbox & PPE allocated', done: false }, { label: 'Induction & site tour', done: false },
      ],
      docs: ['📄 Contract', '📄 Tax file declaration', '📄 Super choice form'],
    };
    setHires((list) => [hire, ...list]);
    persistHire(hire, orgId);
    return hire;
  };

  // HR / Leave requests: "+ New request".
  const addLeaveRequest = ({ name, type, dates }) => {
    const req = { id: crypto.randomUUID(), name, type: type || 'Annual leave', dates: dates || '', status: 'Pending' };
    setLeave((list) => [req, ...list]);
    persistLeave(req, orgId);
    return req;
  };

  // HR / Disciplinary notes: "+ New note".
  const addDisciplinaryNote = ({ name, note }) => {
    const entry = { id: crypto.randomUUID(), name, severity: 'Minor', date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }), note };
    setDisciplinaryNotes((list) => [entry, ...list]);
    persistNote(entry, orgId);
    return entry;
  };

  // Loan Cars: assign an available car to a customer.
  const assignLoanCar = (carId, { assignedTo, dueBack }) => {
    const existing = loanCars.find((c) => c.id === carId);
    if (!existing) return;
    const saved = { ...existing, status: 'Out', assignedTo, outSince: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), dueBack: dueBack || '' };
    setLoanCars((list) => list.map((c) => (c.id === carId ? saved : c)));
    persistLoanCar(saved, orgId);
  };

  // Loan Cars: mark a car back in.
  const returnLoanCar = (carId) => {
    const existing = loanCars.find((c) => c.id === carId);
    if (!existing) return;
    const saved = { ...existing, status: 'Available', assignedTo: '', outSince: '', dueBack: '' };
    setLoanCars((list) => list.map((c) => (c.id === carId ? saved : c)));
    persistLoanCar(saved, orgId);
  };

  // Parts/Products screen: "+ New product".
  const addPart = ({ name, size, stock, price, status }) => {
    const part = { id: crypto.randomUUID(), name, size: size || '', stock: parseInt(stock, 10) || 0, price: parseFloat(price) || 0, status: status || 'In stock' };
    setParts((list) => [part, ...list]);
    persistPart(part, orgId);
    return part;
  };

  // Tyre Stock: inline qty edit.
  const setTyreQty = (tyreId, qty) => {
    const existing = tyreStock.find((t) => t.id === tyreId);
    if (!existing) return;
    const saved = { ...existing, qty: Math.max(0, parseInt(qty, 10) || 0) };
    setTyreStock((list) => list.map((t) => (t.id === tyreId ? saved : t)));
    persistTyre(saved, orgId);
  };

  // Tyre Stock: "+ New tyre line".
  const addTyreLine = ({ brand, model, size, rating, cost, sell }) => {
    const tyre = { id: crypto.randomUUID(), brand, model: model || '', size: size || '', rating: rating || '', qty: 0, cost: parseFloat(cost) || 0, sell: parseFloat(sell) || 0, reorder: 4 };
    setTyreStock((list) => [tyre, ...list]);
    persistTyre(tyre, orgId);
    return tyre;
  };

  // Stock Take: enter a counted qty for one line.
  const setStockCount = (itemId, counted) => {
    const existing = stockTakeItems.find((s) => s.id === itemId);
    if (!existing) return;
    const saved = { ...existing, counted };
    setStockTakeItems((list) => list.map((s) => (s.id === itemId ? saved : s)));
    persistStockTakeItem(saved, orgId);
  };

  return (
    <Ctx.Provider value={{
      active, setActive,
      jobs, setJobs,
      invoices, setInvoices, addInvoice,
      bookings, setBookings, addPortalBooking, addBooking,
      customers, setCustomers, addCustomer,
      vehicles, setVehicles, addVehicle,
      team, setTeam, addTeamMember,
      suppliers, setSuppliers, addSupplier,
      reviews, setReviews, markReviewReplied,
      hires, toggleHireTask, addHire,
      leave, addLeaveRequest,
      payroll,
      disciplinaryNotes, addDisciplinaryNote,
      payrollRun, setPayrollRun,
      loanCars, assignLoanCar, returnLoanCar,
      parts, addPart,
      tyreStock, setTyreQty, addTyreLine,
      stockTakeItems, setStockCount, stockTakeFinalized, setStockTakeFinalized,
      jobCard, updateJobCard,
      startJobCard, generateInvoice, saveJobLines, markInvoicePaid,
      flash, setFlash,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export { fmt };
