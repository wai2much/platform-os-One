// One-time MechanicDesk -> Platform OS migration for Haus of Technik / TyrePlus
// Thomastown. Dry-run by default (no writes). Pass --write to actually insert,
// and only once SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ORG_ID are set as
// real env vars (never hardcode them here).
//
// Design notes / assumptions (flag anything wrong — these are best-effort
// reads of an unfamiliar export format, not confirmed against docs):
//  - Platform OS's schema stores customer/owner names as plain text, not
//    foreign keys (confirmed in src/core/store.jsx's *ToRow mappers), so no
//    relational-ID resolution is needed — vehicles/invoices link to customers
//    by matching display_name text, same as the source export already does.
//  - invoice_type: "I" = real invoice (1829 rows), "Q" = quote (15 rows).
//    Quotes are EXCLUDED from the invoices import (not billed, would misstate
//    real revenue) but still counted in the customer's job history? -> no,
//    excluded entirely for now; flag if quotes should be tracked separately.
//  - invoice_status: C=1313 (assumed Closed/Paid), O=485 (assumed Open/unpaid),
//    P=46 (assumed Pending). Mapped to Paid / Sent / Sent respectively.
//    balance_due > 0 overrides to "Overdue" regardless of status code.
//  - Rows whose customer display_name is a literal placeholder ("DO NOT USE",
//    "DO NOT USE THIS ONE", "Cash Sale") are skipped from the customers
//    import by default, but invoices/vehicles referencing them still import
//    (the money/vehicle was real) — just won't get a matching customer record.
//  - product_type "T" -> tyre_stock. Everything else -> parts, EXCEPT rows
//    that look like a tyre size in item_code (e.g. "205/55R16") even when
//    typed "S" in the source data (confirmed this happens on real rows) also
//    route to tyre_stock. This heuristic will misclassify some edge cases —
//    review tyre_stock/parts counts below before trusting it blindly.
//  - Duplicate item_code parts (same code, multiple rows — confirmed common,
//    e.g. many separate "AIR FILTER" rows with blank codes) are NOT deduped;
//    each source row becomes its own part row. Dedup would need a real
//    decision (sum stock? keep latest?) that isn't mine to make silently.

import { readFileSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// Point this at the folder holding the 5 exported CSVs (vendor/customer/
// vehicle/invoice/product) — via CSV_DIR env var, or defaults to ./data
// next to this script.
const DIR = process.env.CSV_DIR || new URL('./data', import.meta.url).pathname;
const WRITE = process.argv.includes('--write');

// Identifies each export file by its HEADER COLUMNS, not its filename.
// Filenames proved unreliable in both directions: the vendor ships
// "invoice-*.csv" alongside a genuinely different "invoiceItem-*.csv"
// (so a substring match grabs the wrong one), while an uploaded copy can
// arrive as "<hash>-invoiceHaus_of_Technik...csv" (so a strict "starts with"
// or "followed by punctuation" rule rejects the right one). Header columns
// are intrinsic to the data and can't be mangled by either.
const FILE_SIGNATURES = {
  vendor:   ['company_name', 'vendor_account_number'],
  customer: ['first_name', 'last_name', 'cash_or_account'],
  vehicle:  ['plate_number', 'make', 'model', 'vin'],
  invoice:  ['invoice_number', 'invoice_type', 'invoice_status'],
  product:  ['item_code', 'product_type', 'quantity_on_hand'],
};

function findFile(entity) {
  const required = FILE_SIGNATURES[entity];
  if (!required) throw new Error(`No signature defined for entity "${entity}"`);
  const files = readdirSync(DIR).filter((f) => f.endsWith('.csv'));
  const matches = files.filter((f) => {
    let header;
    try {
      header = readFileSync(`${DIR}/${f}`, 'utf-8').split('\n', 1)[0];
    } catch { return false; }
    const cols = header.replace(/^﻿/, '').split(',').map((c) => c.trim().toLowerCase());
    return required.every((r) => cols.includes(r));
  }).sort();
  if (matches.length === 0) {
    throw new Error(`No CSV in ${DIR} has the ${entity} columns (${required.join(', ')}) — check CSV_DIR and that all 5 export files are present.`);
  }
  if (matches.length > 1) console.warn(`  WARNING: ${matches.length} files look like ${entity} data — using "${matches[0]}". Others: ${matches.slice(1).join(', ')}`);
  return matches[0];
}

const PLACEHOLDER_NAMES = new Set(['DO NOT USE', 'DO NOT USE THIS ONE', 'CASH SALE']);
const isPlaceholder = (name) => PLACEHOLDER_NAMES.has((name || '').trim().toUpperCase());

const TYRE_SIZE_RE = /^\d{2,3}\/\d{2}\/?R?\d{2}/i;

function loadCsv(prefix) {
  const filename = findFile(prefix);
  const raw = readFileSync(`${DIR}/${filename}`, 'utf-8');
  console.log(`  loading ${prefix} <- ${filename}`);
  return parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
}

function money(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// --- Load all five source files -------------------------------------------
console.log(`Reading CSVs from: ${DIR}`);
const vendors = loadCsv('vendor');
const customersRaw = loadCsv('customer');
const vehiclesRaw = loadCsv('vehicle');
const invoicesRaw = loadCsv('invoice');
const productsRaw = loadCsv('product');

console.log(`Loaded: ${vendors.length} vendors, ${customersRaw.length} customers, ${vehiclesRaw.length} vehicles, ${invoicesRaw.length} invoices, ${productsRaw.length} products`);

// --- Invoices (real invoices only — excludes quotes) -----------------------
const realInvoices = invoicesRaw.filter((r) => (r.invoice_type || '').trim().toUpperCase() === 'I');
const quotesSkipped = invoicesRaw.length - realInvoices.length;

// Verified against the real data (cross-tabbed invoice_status vs balance_due):
// balance_due is the reliable signal, not the O/C/P status code — 8 rows are
// coded "Open" but already carry a zero balance (paid, just not marked
// closed in the source system). No due-date field exists anywhere in this
// export, so "Overdue" would be an unsupported claim — Sent just means
// "balance still owing," not that it's actually late.
function invoiceStatus(r) {
  return money(r.balance_due) <= 0 ? 'Paid' : 'Sent';
}

// Invoice numbers and job-card numbers share ONE counter in the source system,
// so a job card can carry the same digits as an unrelated invoice. 471 rows
// have no invoice_number and fall back to their job-card number — without
// separate INV-/JC- namespaces those collide with real invoices (confirmed:
// 341 collisions, e.g. invoice #50458 vs job card #50458, different customers,
// dates and amounts). The unique constraint rejects the whole batch when that
// happens, so namespacing isn't cosmetic — it's what makes the insert work.
function invoiceId(r) {
  const inv = (r.invoice_number || '').trim();
  if (inv) return 'INV-' + inv;
  const jc = (r.job_card_number || '').trim();
  return jc ? 'JC-' + jc : null;
}

const invoicesOut = realInvoices.map((r) => ({
  id: invoiceId(r),
  customer: (r.display_name || '').trim(),
  job: r.job_card_number ? `Job #${r.job_card_number.trim()}` : '',
  terms: (r.invoice_payment_terms || '').trim(),
  dueBy: '',
  status: invoiceStatus(r),
  amount: money(r.total),
  fromJob: true,
  onAccount: (r.cash_or_account || '').trim().toUpperCase() === 'A',
})).filter((inv) => inv.id);

// Fail loudly rather than letting the DB reject a whole batch mid-import.
const seenIds = new Set();
for (const inv of invoicesOut) {
  if (seenIds.has(inv.id)) throw new Error(`Duplicate invoice id ${inv.id} — ID scheme is wrong, aborting before any writes.`);
  seenIds.add(inv.id);
}

// Group invoices by customer display_name for spend + job history + vehicle history.
const invoicesByCustomer = new Map();
for (const inv of invoicesOut) {
  const key = inv.customer.toUpperCase();
  if (!invoicesByCustomer.has(key)) invoicesByCustomer.set(key, []);
  invoicesByCustomer.get(key).push(inv);
}
const invoicesByPlate = new Map();
for (const r of realInvoices) {
  const plate = (r.plate_number || '').trim().toUpperCase();
  if (!plate) continue;
  if (!invoicesByPlate.has(plate)) invoicesByPlate.set(plate, []);
  invoicesByPlate.get(plate).push(r);
}

// --- Vendors -> suppliers ---------------------------------------------------
const suppliersOut = vendors
  .filter((v) => !isPlaceholder(v.company_name))
  .map((v) => ({
    name: (v.company_name || '').trim(),
    suburb: (v.suburb || '').trim(),
    phone: (v.phone || v.contact1_phone || '').trim(),
    website: (v.web || '').trim(),
  }))
  .filter((s) => s.name);

// --- Customers ---------------------------------------------------------------
const customersOut = customersRaw
  .filter((c) => !isPlaceholder(c.display_name))
  .map((c) => {
    const name = (c.display_name || '').trim();
    const custInvoices = invoicesByCustomer.get(name.toUpperCase()) || [];
    const spend = custInvoices.reduce((s, i) => s + i.amount, 0);
    const jobHistory = custInvoices
      .map((i) => ({ service: i.job || i.id, date: i.postDate || '', total: '$' + i.amount.toFixed(2) }));
    return {
      name,
      phone: (c.phone || c.mobile || c.contact_phone || '').trim(),
      email: (c.email || c.contact_email || '').trim(),
      vehicle: '',
      lastVisit: '',
      status: (c.cash_or_account || '').trim().toUpperCase() === 'A' ? 'Account' : 'Retail',
      spend,
      jobHistory,
    };
  })
  .filter((c) => c.name);

// --- Vehicles ------------------------------------------------------------
const vehiclesOut = vehiclesRaw.map((v) => {
  const plate = (v.plate_number || '').trim();
  const plateInvoices = invoicesByPlate.get(plate.toUpperCase()) || [];
  const history = plateInvoices.map((r) => ({
    service: r.description || r.job_card_number || '',
    date: r.post_date || '',
    total: '$' + money(r.total).toFixed(2),
  }));
  return {
    model: [v.make, v.model].filter(Boolean).join(' ').trim(),
    rego: plate,
    owner: (v.display_name || '').trim(),
    odo: v.odometer && v.odometer !== '0' ? `${v.odometer} km` : '',
    lastService: (v.last_service || '').trim(),
    nextDue: (v.next_service || '').trim(),
    status: '',
    history,
  };
});

// --- Products -> parts / tyre_stock ---------------------------------------
// Verified against the real data: product_type "J" (8 rows) is labour/fee
// line items — "Labour", "Data Fee", "Registration Data Fee" — not physical
// stock. Importing those into a parts table with a stock count would be
// nonsensical (always stock=0, not a real inventory item), so they're
// excluded entirely rather than misclassified as a part.
const tyresOut = [];
const partsOut = [];
let labourSkipped = 0;
for (const p of productsRaw) {
  const type = (p.product_type || '').trim().toUpperCase();
  if (type === 'J') { labourSkipped++; continue; }
  const looksLikeTyreSize = TYRE_SIZE_RE.test((p.item_code || '').trim());
  const isTyre = type === 'T' || looksLikeTyreSize;
  const stock = parseInt(p.quantity_on_hand, 10) || 0;
  if (isTyre) {
    tyresOut.push({
      brand: (p.brand || '').trim(),
      model: (p.description || '').trim(),
      size: (p.item_code || '').trim(),
      rating: '',
      qty: stock,
      cost: money(p.cost),
      sell: money(p.retail_price),
      reorder: parseInt(p.minimum, 10) || 4,
    });
  } else {
    partsOut.push({
      name: (p.description || p.item_code || '').trim(),
      size: (p.description2 || '').trim(),
      stock,
      price: money(p.retail_price),
      status: stock <= 0 ? 'Ordered' : (p.minimum && stock <= parseInt(p.minimum, 10) ? 'Low' : 'In stock'),
    });
  }
}

// --- Report ------------------------------------------------------------------
console.log('\n=== Transform summary (dry run) ===');
console.log(`Suppliers:  ${suppliersOut.length} (${vendors.length - suppliersOut.length} placeholder/blank skipped)`);
console.log(`Customers:  ${customersOut.length} (${customersRaw.length - customersOut.length} placeholder skipped)`);
console.log(`  - total computed spend across all customers: $${customersOut.reduce((s, c) => s + c.spend, 0).toFixed(2)}`);
console.log(`Vehicles:   ${vehiclesOut.length}`);
console.log(`Invoices:   ${invoicesOut.length} (${quotesSkipped} quotes excluded, not billed)`);
console.log(`  - total invoice amount: $${invoicesOut.reduce((s, i) => s + i.amount, 0).toFixed(2)}`);
console.log(`  - status breakdown: ${JSON.stringify(invoicesOut.reduce((acc, i) => (acc[i.status] = (acc[i.status] || 0) + 1, acc), {}))}`);
console.log(`Tyre stock: ${tyresOut.length}`);
console.log(`Parts:      ${partsOut.length}`);
console.log(`  - ${labourSkipped} labour/fee line items excluded (not physical stock)`);

console.log('\n=== Sample transformed rows ===');
console.log('Supplier sample:', JSON.stringify(suppliersOut[0]));
console.log('Customer sample:', JSON.stringify(customersOut.find((c) => c.spend > 0) || customersOut[0]));
console.log('Vehicle sample:', JSON.stringify(vehiclesOut.find((v) => v.history.length > 0) || vehiclesOut[0]));
console.log('Invoice sample:', JSON.stringify(invoicesOut[0]));
console.log('Tyre sample:', JSON.stringify(tyresOut[0]));
console.log('Part sample:', JSON.stringify(partsOut[0]));

if (!WRITE) {
  console.log('\nDry run only — pass --write with real SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ORG_ID env vars set to actually import.');
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orgId = process.env.ORG_ID;
if (!url || !key || !orgId) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ORG_ID — refusing to write.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function insertBatch(table, rows, toRow, batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(toRow);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`FAILED inserting ${table} batch ${i}-${i + batch.length}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

const uuid = () => randomUUID();

console.log('\n=== Writing to Supabase ===');
console.log('suppliers:', await insertBatch('suppliers', suppliersOut, (s) => ({ id: uuid(), org_id: orgId, name: s.name, suburb: s.suburb, phone: s.phone, website: s.website })));
console.log('customers:', await insertBatch('customers', customersOut, (c) => ({ id: uuid(), org_id: orgId, name: c.name, phone: c.phone, email: c.email, vehicle: c.vehicle, last_visit: c.lastVisit, status: c.status, spend: c.spend, job_history: c.jobHistory })));
console.log('vehicles:', await insertBatch('vehicles', vehiclesOut, (v) => ({ id: uuid(), org_id: orgId, model: v.model, rego: v.rego, owner: v.owner, odo: v.odo, last_service: v.lastService, next_due: v.nextDue, status: v.status, history: v.history })));
console.log('invoices:', await insertBatch('invoices', invoicesOut, (i) => ({ id: i.id, org_id: orgId, customer: i.customer, job: i.job, terms: i.terms, due_by: i.dueBy, status: i.status, amount: i.amount, from_job: i.fromJob, on_account: i.onAccount })));
console.log('tyre_stock:', await insertBatch('tyre_stock', tyresOut, (t) => ({ id: uuid(), org_id: orgId, brand: t.brand, model: t.model, size: t.size, rating: t.rating, qty: t.qty, cost: t.cost, sell: t.sell, reorder: t.reorder })));
console.log('parts:', await insertBatch('parts', partsOut, (p) => ({ id: uuid(), org_id: orgId, name: p.name, size: p.size, stock: p.stock, price: p.price, status: p.status })));

console.log('\nDone.');
