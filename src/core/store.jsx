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

const SEED_TEAM = [
  { id: crypto.randomUUID(), name: 'Sam Okafor', role: 'Senior Technician', status: 'On shift', avgTime: '52m', certs: 'Cert III · Auto Elec' },
  { id: crypto.randomUUID(), name: 'Dean Whitlock', role: 'Technician', status: 'On shift', avgTime: '61m', certs: 'Cert III Light Vehicle' },
  { id: crypto.randomUUID(), name: 'Anthony Ruiz', role: 'Apprentice, Yr 3', status: 'Break', avgTime: '74m', certs: 'RWC in progress' },
];

const SEED_REVIEWS = [
  { id: 'rv1', name: 'M. Petrakis', rating: 5, platform: 'Google', date: '24 Jul', text: 'Quick turnaround on the alignment, explained everything clearly. Will be back.', replied: true, sentReply: 'Thanks so much for the kind words, see you next time!' },
  { id: 'rv2', name: 'A. Costa', rating: 5, platform: 'Google', date: '20 Jul', text: 'Best tyre shop in Thomastown, fair pricing and no upselling.', replied: true, sentReply: 'Really appreciate that, thank you!' },
  { id: 'rv3', name: 'T. Nguyen', rating: 3, platform: 'Facebook', date: '15 Jul', text: 'Good work but took longer than quoted. Would appreciate better time estimates.', replied: false, sentReply: '' },
  { id: 'rv4', name: 'S. Bianchi', rating: 5, platform: 'Google', date: '10 Jul', text: 'Friendly staff, honest advice on what actually needed doing.', replied: false, sentReply: '' },
  { id: 'rv5', name: 'L. Farrow', rating: 4, platform: 'Google', date: '2 Jul', text: 'Solid service, a bit of a wait on a Saturday morning but worth it.', replied: false, sentReply: '' },
];

const SEED_HIRES = [
  { id: crypto.randomUUID(), name: 'J. Alvarez', role: 'Apprentice Technician', startDate: '4 Aug', tasks: [
    { label: 'Contract signed', done: true }, { label: 'Uniform issued', done: true },
    { label: 'Toolbox & PPE allocated', done: false }, { label: 'Induction & site tour', done: false },
  ], docs: ['📄 Contract', '📄 Tax file declaration', '📄 Super choice form'] },
];

const SEED_LEAVE = [
  { id: crypto.randomUUID(), name: 'Dean Whitlock', type: 'Annual leave', dates: '4–8 Aug', status: 'Pending' },
  { id: crypto.randomUUID(), name: 'Anthony Ruiz', type: 'Sick leave', dates: '26 Jul', status: 'Approved' },
];

const SEED_PAYROLL = [
  { id: crypto.randomUUID(), name: 'Sam Okafor', hours: 76, rate: 38, annual: 84, sick: 42, accrualRate: '2.9h' },
  { id: crypto.randomUUID(), name: 'Dean Whitlock', hours: 74, rate: 34, annual: 61, sick: 38, accrualRate: '2.9h' },
  { id: crypto.randomUUID(), name: 'Anthony Ruiz', hours: 72, rate: 24, annual: 55, sick: 30, accrualRate: '2.9h' },
];

const SEED_NOTES = [
  { id: crypto.randomUUID(), name: 'Anthony Ruiz', severity: 'Minor', date: '2 Jul 2026', note: 'Arrived 20 minutes late without notice, discussed expectations.' },
];

const SEED_SUPPLIERS = [
  { id: crypto.randomUUID(), name: 'Burson Auto Parts', suburb: 'Thomastown', phone: '(03) 9462 1100', website: 'burson.com.au' },
  { id: crypto.randomUUID(), name: 'Repco', suburb: 'Preston', phone: '(03) 9478 2200', website: 'repco.com.au' },
  { id: crypto.randomUUID(), name: 'BMW Genuine Parts', suburb: 'Docklands', phone: '(03) 8560 5000', website: 'bmw.com.au' },
  { id: crypto.randomUUID(), name: 'Penrite Oil', suburb: 'Bayswater', phone: '(03) 9720 0500', website: 'penriteoil.com.au' },
  { id: crypto.randomUUID(), name: 'NGK Spark Plugs', suburb: 'Rydalmere', phone: '(02) 9684 6688', website: 'ngk.com.au' },
  { id: crypto.randomUUID(), name: 'Ryco Filters', suburb: 'Somerton', phone: '(03) 9305 8900', website: 'ryco.com.au' },
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
  const [team, setTeam] = useState(SEED_TEAM);
  const [suppliers, setSuppliers] = useState(SEED_SUPPLIERS);
  const [reviews, setReviews] = useState(SEED_REVIEWS);
  const [hires, setHires] = useState(SEED_HIRES);
  const [leave, setLeave] = useState(SEED_LEAVE);
  const [payroll, setPayroll] = useState(SEED_PAYROLL);
  const [disciplinaryNotes, setDisciplinaryNotes] = useState(SEED_NOTES);
  const [payrollRun, setPayrollRun] = useState(false);
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
        { data: teamRows, error: teamErr },
        { data: supRows, error: supErr },
        { data: revRows, error: revErr },
        { data: hireRows, error: hireErr },
        { data: leaveRows, error: leaveErr },
        { data: payRows, error: payErr },
        { data: noteRows, error: noteErr },
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

      if (!teamErr && teamRows && teamRows.length === 0) {
        await supabase.from('team_members').upsert(SEED_TEAM.map((t) => teamToRow(t, orgId)));
        setTeam(SEED_TEAM);
      } else if (!teamErr && teamRows) {
        setTeam(teamRows.map(teamFromRow));
      }

      if (!supErr && supRows && supRows.length === 0) {
        await supabase.from('suppliers').upsert(SEED_SUPPLIERS.map((s) => supplierToRow(s, orgId)));
        setSuppliers(SEED_SUPPLIERS);
      } else if (!supErr && supRows) {
        setSuppliers(supRows.map(supplierFromRow));
      }

      if (!revErr && revRows && revRows.length === 0) {
        await supabase.from('reviews').upsert(SEED_REVIEWS.map((r) => reviewToRow(r, orgId)));
        setReviews(SEED_REVIEWS);
      } else if (!revErr && revRows) {
        setReviews(revRows.map(reviewFromRow));
      }

      if (!hireErr && hireRows && hireRows.length === 0) {
        await supabase.from('hires').upsert(SEED_HIRES.map((h) => hireToRow(h, orgId)));
        setHires(SEED_HIRES);
      } else if (!hireErr && hireRows) {
        setHires(hireRows.map(hireFromRow));
      }

      if (!leaveErr && leaveRows && leaveRows.length === 0) {
        await supabase.from('leave_requests').upsert(SEED_LEAVE.map((l) => leaveToRow(l, orgId)));
        setLeave(SEED_LEAVE);
      } else if (!leaveErr && leaveRows) {
        setLeave(leaveRows.map(leaveFromRow));
      }

      if (!payErr && payRows && payRows.length === 0) {
        await supabase.from('payroll_entries').upsert(SEED_PAYROLL.map((p) => payrollToRow(p, orgId)));
        setPayroll(SEED_PAYROLL);
      } else if (!payErr && payRows) {
        setPayroll(payRows.map(payrollFromRow));
      }

      if (!noteErr && noteRows && noteRows.length === 0) {
        await supabase.from('disciplinary_notes').upsert(SEED_NOTES.map((n) => noteToRow(n, orgId)));
        setDisciplinaryNotes(SEED_NOTES);
      } else if (!noteErr && noteRows) {
        setDisciplinaryNotes(noteRows.map(noteFromRow));
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

  return (
    <Ctx.Provider value={{
      active, setActive,
      jobs, setJobs,
      invoices, setInvoices,
      bookings, setBookings, addPortalBooking,
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
      jobCard, updateJobCard,
      startJobCard, generateInvoice, saveJobLines, markInvoicePaid,
      flash, setFlash,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export { fmt };
