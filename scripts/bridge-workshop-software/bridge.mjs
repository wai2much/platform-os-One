#!/usr/bin/env node
// Workshop Software -> Platform OS Slim: invoice bridge.
//
// Reads a Workshop Software CSV export (Actions -> Export -> History), keeps
// only invoices dated inside a window (default 1 July 2026 -> today), and
// writes the ones Slim does not already have into the `invoices` table.
//
// DRY RUN BY DEFAULT. Nothing is written without --write.
//
// Design decisions, so they are visible rather than buried:
//
//  - REPEATABLE, NOT ONE-SHOT. Every run reads the ids already in Slim and
//    inserts only what is missing, so running it weekly is safe and running
//    it twice in a row is a no-op. Rows that exist but whose amount or status
//    changed in Workshop Software are reported, and only updated if you pass
//    --update. Silent overwrites of live data are not something a bridge
//    should do on its own.
//
//  - IDS ARE NAMESPACED "WS-". Slim already holds MechanicDesk rows under
//    INV-/JC- and mints its own new invoices as INV-<n> (store.jsx nextNum).
//    Workshop Software numbers its invoices from its own counter, so an
//    unprefixed import would collide on the primary key and the whole batch
//    would be rejected. WS- keeps the three sources apart permanently.
//
//  - migrated = false. Your call: July and August are real trading you want
//    counted, so these rows land as LIVE revenue and show up in Dashboard,
//    Reports and Heather's money answers. migrated_source is still stamped
//    so the provenance is not lost. (The 1,830 MechanicDesk rows stay
//    migrated = true and stay out of live totals.)
//
//  - created_at IS THE REAL INVOICE DATE, not the import time. Otherwise
//    every July invoice would report as August revenue and the whole exercise
//    would be pointless. Written as noon Melbourne so it cannot drift into
//    the wrong month through a UTC conversion at either end of the window.
//
//  - COLUMN NAMES ARE RESOLVED, NOT ASSUMED. Workshop Software does not
//    publish its export column names and I have not seen one of your files.
//    So the script matches headers against an alias table, prints exactly
//    what it matched, and REFUSES TO RUN if it cannot find a required field
//    rather than guessing and quietly importing zeros. If it misses a column,
//    add the real header to ALIASES below. That is the only edit needed.

import { readFileSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// --- Config ----------------------------------------------------------------

const DIR = process.env.CSV_DIR || new URL('./data', import.meta.url).pathname;
const WRITE = process.argv.includes('--write');
const UPDATE = process.argv.includes('--update');
const WITH_CUSTOMERS = process.argv.includes('--with-customers');
const ADOPT = process.argv.includes('--adopt');
const SQL_OUT = process.argv.includes('--sql');
// The target tenant. This project has 10 organizations; 'wai' is the one
// holding the real TyrePlus data (793 customers, 1,490 vehicles).
const ORG = process.env.ORG_ID || '26a3a65c-8355-455c-a74a-42d50e234cc1';

const FROM = process.env.FROM || '2026-07-01';
const TO = process.env.TO || new Date().toISOString().slice(0, 10);
const TZ = process.env.TZ_OFFSET || '+10:00';        // Melbourne
const ID_PREFIX = process.env.ID_PREFIX || 'WS-';
const SOURCE_TAG = process.env.SOURCE_TAG || 'workshop-software';
const DATE_ORDER = (process.env.DATE_ORDER || 'auto').toLowerCase(); // auto | dmy | mdy

// Explicit file overrides, if header sniffing picks the wrong file.
const INVOICES_CSV = process.env.INVOICES_CSV || '';
const ITEMS_CSV = process.env.ITEMS_CSV || '';

// --- Header aliases ---------------------------------------------------------
// Compared after stripping everything that is not a letter or digit, so
// "Invoice No.", "invoice_no" and "INVOICE NO" are all the same key.
// Order matters: the first alias that matches wins.

const ALIASES = {
  invoiceNumber: ['invoiceno', 'invoicenumber', 'invno', 'invoiceid', 'taxinvoiceno', 'documentno', 'docno', 'invoice', 'number'],
  jobNumber:     ['jobcardno', 'jobcardnumber', 'jobno', 'jobnumber', 'jobcard', 'workorderno', 'wono', 'repairorderno', 'rono'],
  date:          ['invoicedate', 'dateinvoiced', 'issuedate', 'dateissued', 'postdate', 'posteddate', 'transactiondate', 'invoiceddate', 'date'],
  customer:      ['customername', 'clientname', 'displayname', 'accountname', 'billtoname', 'billto', 'customer', 'client', 'companyname', 'company'],
  total:         ['totalincgst', 'totalinctax', 'totalinc', 'invoicetotal', 'grandtotal', 'totalamount', 'invoiceamount', 'invoicevalue', 'amounttotal', 'total', 'amount'],
  balance:       ['balancedue', 'balanceowing', 'amountdue', 'outstanding', 'amountowing', 'balance', 'owing'],
  amountPaid:    ['amountpaid', 'totalpaid', 'paidamount', 'paymentsreceived', 'paid'],
  status:        ['invoicestatus', 'paymentstatus', 'paidstatus', 'status', 'state'],
  type:          ['invoicetype', 'documenttype', 'doctype', 'recordtype', 'type'],
  dueDate:       ['duedate', 'datedue', 'paymentduedate', 'due'],
  terms:         ['paymentterms', 'invoicepaymentterms', 'accountterms', 'terms'],
  accountType:   ['cashoraccount', 'accounttype', 'customertype', 'cashaccount'],
  rego:          ['platenumber', 'registrationnumber', 'registration', 'regonumber', 'rego', 'plate'],
  vehicle:       ['vehicledescription', 'vehiclename', 'makemodel'],
  subtotal:      ['totalexgst', 'totalextax', 'totalex', 'subtotal', 'netamount'],
  gst:           ['gsttotal', 'totalgst', 'taxtotal', 'totaltax', 'gst', 'tax'],
  // invoice ITEMS file
  itemInvoiceNo: ['invoiceno', 'invoicenumber', 'invno', 'invoiceid', 'taxinvoiceno', 'documentno', 'invoice'],
  itemCode:      ['itemcode', 'partno', 'partnumber', 'productcode', 'sku', 'code'],
  itemDesc:      ['description', 'itemdescription', 'partdescription', 'details', 'comments', 'item'],
  itemQty:       ['quantity', 'qty', 'qtysold', 'units'],
  itemPrice:     ['unitprice', 'sellprice', 'retailprice', 'priceeach', 'price', 'rate'],
  itemTotal:     ['linetotal', 'lineamount', 'extended', 'extendedprice', 'total', 'amount'],
};

const norm = (s) => String(s ?? '').replace(/^﻿/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

// Resolve a set of fields against a file's headers. Exact matches first for
// every field, then a looser contains-match for whatever is still unresolved,
// and a header can only ever be claimed once so "total" cannot steal the
// column that "totaltax" should have had.
function resolve(headers, fields) {
  const byNorm = new Map();
  for (const h of headers) { const n = norm(h); if (n && !byNorm.has(n)) byNorm.set(n, h); }
  const claimed = new Set();
  const map = {};

  for (const f of fields) {
    for (const a of (ALIASES[f] || [])) {
      const n = norm(a);
      if (byNorm.has(n) && !claimed.has(n)) { map[f] = byNorm.get(n); claimed.add(n); break; }
    }
  }
  for (const f of fields) {
    if (map[f]) continue;
    for (const a of (ALIASES[f] || [])) {
      const n = norm(a);
      let hit = null;
      for (const [hn, orig] of byNorm) {
        if (claimed.has(hn)) continue;
        if (hn.includes(n)) { hit = [hn, orig]; break; }
      }
      if (hit) { map[f] = hit[1]; claimed.add(hit[0]); break; }
    }
  }
  return map;
}

// --- Parsers ----------------------------------------------------------------

function money(v) {
  if (v === null || v === undefined) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

// Returns YYYY-MM-DD, or null. `order` is 'dmy' or 'mdy' for slash dates.
function parseDate(v, order) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) > 70 ? '19' : '20') + y;
    const day = order === 'mdy' ? b : a;
    const mon = order === 'mdy' ? a : b;
    return `${y}-${mon.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Look at every date in the column and decide d/m vs m/d rather than assuming.
// Any value with a first component above 12 settles it as day-first.
function detectDateOrder(rows, col) {
  if (DATE_ORDER === 'dmy' || DATE_ORDER === 'mdy') return { order: DATE_ORDER, why: `forced by DATE_ORDER=${DATE_ORDER}` };
  let firstOver12 = 0, secondOver12 = 0, slash = 0;
  for (const r of rows) {
    const m = String(r[col] ?? '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) continue;
    slash++;
    if (parseInt(m[1], 10) > 12) firstOver12++;
    if (parseInt(m[2], 10) > 12) secondOver12++;
  }
  if (!slash) return { order: 'dmy', why: 'no slash dates found (ISO dates parse unambiguously)' };
  if (firstOver12 && !secondOver12) return { order: 'dmy', why: `${firstOver12} rows have a first component above 12` };
  if (secondOver12 && !firstOver12) return { order: 'mdy', why: `${secondOver12} rows have a second component above 12` };
  if (firstOver12 && secondOver12) {
    console.error('\nFATAL: the date column is internally inconsistent - some rows read day-first, some month-first.');
    console.error('Set DATE_ORDER=dmy or DATE_ORDER=mdy explicitly after checking a few invoices in Workshop Software.');
    process.exit(1);
  }
  return { order: 'dmy', why: 'ambiguous (no component above 12); assuming Australian day-first - set DATE_ORDER=mdy if wrong' };
}

// --- Find and load the export files -----------------------------------------

function csvFiles() {
  let files;
  try { files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.csv')); }
  catch { console.error(`FATAL: cannot read CSV_DIR "${DIR}". Set CSV_DIR to the folder holding the export.`); process.exit(1); }
  if (!files.length) { console.error(`FATAL: no .csv files in ${DIR}.`); process.exit(1); }
  return files;
}

function headersOf(file) {
  const firstLine = readFileSync(`${DIR}/${file}`, 'utf-8').split(/\r?\n/, 1)[0];
  return parse(firstLine, { relax_column_count: true, bom: true })[0] || [];
}

// The invoice HEADER file is the one that has an invoice number, a date and a
// money total. The invoice ITEMS file has an invoice number and a line
// description/qty but no per-invoice total-and-date pair. Filenames are not
// trusted: "invoice.csv" and "invoiceItem.csv" both contain "invoice", and an
// uploaded copy can arrive with a hash bolted onto the front.
function classify(files) {
  const scored = files.map((f) => {
    const h = headersOf(f);
    const inv = resolve(h, ['invoiceNumber', 'date', 'customer', 'balance', 'subtotal', 'gst', 'total']);
    const item = resolve(h, ['itemInvoiceNo', 'itemDesc', 'itemQty']);
    return {
      file: f,
      headers: h,
      invScore: ['invoiceNumber', 'date', 'total', 'customer'].filter((k) => inv[k]).length,
      itemScore: ['itemInvoiceNo', 'itemDesc', 'itemQty'].filter((k) => item[k]).length,
      hasDate: !!inv.date,
      hasTotal: !!inv.total,
    };
  });
  const header = INVOICES_CSV
    ? scored.find((s) => s.file === INVOICES_CSV)
    : scored.filter((s) => s.hasDate && s.hasTotal).sort((a, b) => b.invScore - a.invScore)[0];
  const items = ITEMS_CSV
    ? scored.find((s) => s.file === ITEMS_CSV)
    : scored.filter((s) => s !== header && s.itemScore === 3).sort((a, b) => b.itemScore - a.itemScore)[0];
  return { header, items, scored };
}

console.log(`Workshop Software -> Platform OS Slim invoice bridge`);
console.log(`Reading CSVs from: ${DIR}`);
console.log(`Date window:       ${FROM} .. ${TO}  (inclusive)\n`);

const files = csvFiles();
const { header: headerFile, items: itemsFile, scored } = classify(files);

if (!headerFile) {
  console.error('FATAL: none of these CSVs look like a Workshop Software invoice header export.');
  console.error('An invoice header file needs, at minimum, a date column and a money total column.\n');
  for (const s of scored) console.error(`  ${s.file}\n    headers: ${s.headers.join(' | ')}`);
  console.error('\nEither point INVOICES_CSV at the right file, or add its real column names to ALIASES at the top of this script.');
  process.exit(1);
}

// Field order is deliberate. `balance` and `amountPaid` are resolved BEFORE
// `total` so that in an export whose only money columns are "Amount" and
// "Amount Due", the specific name is claimed first and "Amount" is left for
// the total - rather than `total` fuzzy-matching "Amount Due" and importing
// everyone's outstanding balance as their invoice value.
const COLS = resolve(headerFile.headers, [
  'invoiceNumber', 'jobNumber', 'date', 'customer', 'balance', 'amountPaid', 'subtotal', 'gst', 'total',
  'status', 'type', 'dueDate', 'terms', 'accountType', 'rego', 'vehicle',
]);

console.log(`Invoice headers <- ${headerFile.file}`);
console.log(`Line items      <- ${itemsFile ? itemsFile.file : '(none found - line detail will not be imported)'}\n`);
console.log('Column mapping (check this before trusting anything below):');
for (const f of ['invoiceNumber', 'jobNumber', 'date', 'customer', 'total', 'balance', 'amountPaid', 'status', 'type', 'dueDate', 'terms', 'accountType', 'rego', 'vehicle']) {
  console.log(`  ${f.padEnd(14)} -> ${COLS[f] ? `"${COLS[f]}"` : '(not found)'}`);
}
const unmapped = headerFile.headers.filter((h) => !Object.values(COLS).includes(h));
if (unmapped.length) console.log(`  unused columns: ${unmapped.join(', ')}`);

// Refuse to run half-blind. A missing date column makes the whole date-window
// premise impossible; a missing total means importing zeros; a missing
// customer or invoice number means unattributable, un-keyable rows.
const REQUIRED = ['date', 'total', 'customer'];
const missing = REQUIRED.filter((f) => !COLS[f]);
if (!COLS.invoiceNumber && !COLS.jobNumber) missing.push('invoiceNumber or jobNumber');
if (missing.length) {
  console.error(`\nFATAL: could not find required column(s): ${missing.join(', ')}`);
  console.error(`Actual headers in ${headerFile.file}:\n  ${headerFile.headers.join('\n  ')}`);
  console.error('\nAdd the real header name to the matching entry in ALIASES at the top of this script and re-run.');
  process.exit(1);
}

const raw = parse(readFileSync(`${DIR}/${headerFile.file}`, 'utf-8'), {
  columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, trim: true,
});
console.log(`\nLoaded ${raw.length} invoice header rows.`);

const { order: DORDER, why: DWHY } = detectDateOrder(raw, COLS.date);
console.log(`Date format:    ${DORDER === 'dmy' ? 'day/month/year' : 'month/day/year'} - ${DWHY}`);

// --- Line items (optional) ---------------------------------------------------

const itemsByInvoice = new Map();
if (itemsFile) {
  const ICOLS = resolve(itemsFile.headers, ['itemInvoiceNo', 'itemCode', 'itemDesc', 'itemQty', 'itemPrice', 'itemTotal']);
  const itemRows = parse(readFileSync(`${DIR}/${itemsFile.file}`, 'utf-8'), {
    columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, trim: true,
  });
  for (const r of itemRows) {
    const key = String(r[ICOLS.itemInvoiceNo] ?? '').trim();
    if (!key) continue;
    if (!itemsByInvoice.has(key)) itemsByInvoice.set(key, []);
    itemsByInvoice.get(key).push({
      code: ICOLS.itemCode ? String(r[ICOLS.itemCode] ?? '').trim() : '',
      desc: ICOLS.itemDesc ? String(r[ICOLS.itemDesc] ?? '').trim() : '',
      qty: ICOLS.itemQty ? (parseFloat(r[ICOLS.itemQty]) || 0) : 0,
      price: ICOLS.itemPrice ? money(r[ICOLS.itemPrice]) : 0,
      total: ICOLS.itemTotal ? money(r[ICOLS.itemTotal]) : 0,
    });
  }
  console.log(`Line items:     ${itemRows.length} rows across ${itemsByInvoice.size} invoices.`);
}

// --- Transform ---------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);
const stats = { quotes: 0, undated: 0, outOfWindow: 0, noId: 0, zero: 0, dupes: 0 };

const isQuote = (r) => {
  const t = COLS.type ? String(r[COLS.type] ?? '').trim().toLowerCase() : '';
  const s = COLS.status ? String(r[COLS.status] ?? '').trim().toLowerCase() : '';
  return /^(q|quote|quotation|estimate|est)$/.test(t) || /quote|estimate/.test(t) || /^(quote|quotation|estimate|draft)$/.test(s);
};

// Balance is the truth about whether money is owed; a status code can lag
// behind reality (this was already true of the MechanicDesk export, where 8
// rows were coded Open on a zero balance). Only fall back to the status text
// when there is no balance column at all.
function statusOf(r, due) {
  if (COLS.balance) {
    const bal = money(r[COLS.balance]);
    if (bal <= 0.005) return 'Paid';
    return due && due < TODAY ? 'Overdue' : 'Sent';
  }
  if (COLS.amountPaid && COLS.total) {
    if (money(r[COLS.amountPaid]) + 0.005 >= money(r[COLS.total])) return 'Paid';
    return due && due < TODAY ? 'Overdue' : 'Sent';
  }
  const s = COLS.status ? String(r[COLS.status] ?? '').trim().toLowerCase() : '';
  if (/paid|closed|settled|complete/.test(s)) return 'Paid';
  if (/overdue|late/.test(s)) return 'Overdue';
  return due && due < TODAY ? 'Overdue' : 'Sent';
}

const out = [];
const seen = new Set();

for (const r of raw) {
  if (isQuote(r)) { stats.quotes++; continue; }

  const date = parseDate(r[COLS.date], DORDER);
  if (!date) { stats.undated++; continue; }
  if (date < FROM || date > TO) { stats.outOfWindow++; continue; }

  const invNo = COLS.invoiceNumber ? String(r[COLS.invoiceNumber] ?? '').trim() : '';
  const jobNo = COLS.jobNumber ? String(r[COLS.jobNumber] ?? '').trim() : '';
  const key = invNo || jobNo;
  if (!key) { stats.noId++; continue; }
  const id = ID_PREFIX + key;

  if (seen.has(id)) { stats.dupes++; continue; }
  seen.add(id);

  const due = COLS.dueDate ? parseDate(r[COLS.dueDate], DORDER) : null;
  const amount = money(r[COLS.total]);
  if (amount === 0) stats.zero++;

  out.push({
    id,
    sourceNo: key,
    date,
    customer: String(r[COLS.customer] ?? '').trim(),
    job: jobNo ? `Job #${jobNo}` : '',
    jobNo,
    terms: COLS.terms ? String(r[COLS.terms] ?? '').trim() : '',
    due_by: due || '',
    status: statusOf(r, due),
    amount,
    from_job: !!jobNo,
    on_account: COLS.accountType ? /^(a|account|acct|oncredit|credit)$/i.test(String(r[COLS.accountType] ?? '').trim()) : false,
    rego: COLS.rego ? String(r[COLS.rego] ?? '').trim() : '',
    lines: itemsByInvoice.get(key) || [],
  });
}

out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

const total = out.reduce((s, i) => s + i.amount, 0);
const byMonth = {};
for (const i of out) {
  const m = i.date.slice(0, 7);
  byMonth[m] = byMonth[m] || { n: 0, amount: 0 };
  byMonth[m].n++; byMonth[m].amount += i.amount;
}
const byStatus = out.reduce((a, i) => (a[i.status] = (a[i.status] || 0) + 1, a), {});

console.log('\n=== In the window ===');
console.log(`Invoices:       ${out.length}`);
console.log(`Value:          $${total.toFixed(2)}`);
console.log(`Status:         ${JSON.stringify(byStatus)}`);
for (const m of Object.keys(byMonth).sort()) {
  console.log(`  ${m}:        ${String(byMonth[m].n).padStart(4)} invoices, $${byMonth[m].amount.toFixed(2)}`);
}
console.log('\n=== Skipped ===');
console.log(`  quotes / estimates / drafts:  ${stats.quotes}`);
console.log(`  outside ${FROM}..${TO}:  ${stats.outOfWindow}`);
console.log(`  unreadable or empty date:     ${stats.undated}`);
console.log(`  no invoice or job number:     ${stats.noId}`);
console.log(`  duplicate id within the file: ${stats.dupes}`);
if (stats.zero) console.log(`  (${stats.zero} imported invoices have a $0 total - worth a look, but zero-value invoices are legitimate)`);

if (out.length) {
  console.log('\nFirst:', JSON.stringify({ ...out[0], lines: `${out[0].lines.length} line items` }));
  console.log('Last: ', JSON.stringify({ ...out[out.length - 1], lines: `${out[out.length - 1].lines.length} line items` }));
}
if (!out.length) {
  console.log('\nNothing in the window. Check FROM/TO and that the export actually covers these dates.');
  process.exit(0);
}

// --- SQL output ---------------------------------------------------------------
// An alternative to talking to Supabase over the network: emit one script to
// paste into the Supabase SQL editor, which is already authenticated in the
// browser. Nobody handles a service_role key, which removes the most dangerous
// and most error-prone step in the whole process.
//
// Idempotent. Run it twice and the second run changes nothing: adoption only
// touches rows still flagged migrated, and the insert only fires where neither
// the WS- id nor its old twin exists.

if (SQL_OUT) {
  const { writeFileSync } = await import('fs');
  const q = (v) => "'" + String(v ?? '').replace(/'/g, "''") + "'";
  const num = (v) => (Number.isFinite(v) ? v : 0);
  const bool = (v) => (v ? 'true' : 'false');

  const values = out.map((i) =>
    `  (${q(i.sourceNo)}, ${q(i.jobNo || '')}, ${q(i.id)}, ${q(i.customer)}, ${q(i.job)}, ${q(i.terms)}, ${q(i.due_by)}, ${q(i.status)}, ${num(i.amount)}, ${bool(i.from_job)}, ${bool(i.on_account)}, ${q(i.date)}::date)`
  ).join(',\n');

  const sql = `-- Workshop Software -> Platform OS Slim, invoices ${FROM} to ${TO}
-- Generated ${new Date().toISOString()} by scripts/bridge-workshop-software.
-- ${out.length} invoices, $${total.toFixed(2)}.
--
-- Paste into the Supabase SQL editor and press Run. Safe to run more than
-- once: a second run reports 0 adopted and 0 inserted.

begin;

-- Refuse to guess which tenant this belongs to.
do $$
begin
  if not exists (select 1 from organizations where id = '${ORG}') then
    raise exception 'Target organization ${ORG} not found - refusing to write.';
  end if;
end $$;

create temporary table ws_import (
  source_no  text,
  job_no     text,
  id         text,
  customer   text,
  job        text,
  terms      text,
  due_by     text,
  status     text,
  amount     numeric,
  from_job   boolean,
  on_account boolean,
  inv_date   date
) on commit drop;

insert into ws_import (source_no, job_no, id, customer, job, terms, due_by, status, amount, from_job, on_account, inv_date) values
${values};

-- 1. Adopt. These invoices are already in Slim from the 30 July migration,
--    flagged as history and carrying the import timestamp instead of the real
--    invoice date. Give them their date back and count them as live revenue,
--    rather than inserting a duplicate under a WS- id. Only ever touches rows
--    still flagged migrated, so an invoice Slim raised itself is never altered
--    even if its number happens to collide.
update invoices i
   set created_at      = ((w.inv_date + time '12:00') at time zone 'Australia/Melbourne'),
       migrated        = false,
       migrated_source = 'workshop-software',
       amount          = w.amount,
       status          = w.status,
       terms           = w.terms,
       due_by          = w.due_by
  from ws_import w
 where i.org_id = '${ORG}'
   and i.migrated = true
   and (i.id = 'INV-' || w.source_no
        or (w.job_no <> '' and i.id = 'JC-' || w.job_no));

-- 2. Insert everything with no prior record in Slim at all. August, mostly.
insert into invoices (id, org_id, customer, job, terms, due_by, status, amount,
                      credit_hold, from_job, on_account, created_at, migrated, migrated_source)
select w.id, '${ORG}', w.customer, w.job, w.terms, w.due_by, w.status, w.amount,
       false, w.from_job, w.on_account,
       ((w.inv_date + time '12:00') at time zone 'Australia/Melbourne'),
       false, 'workshop-software'
  from ws_import w
 where not exists (select 1 from invoices x where x.id = w.id)
   and not exists (select 1 from invoices x where x.id = 'INV-' || w.source_no)
   and not exists (select 1 from invoices x where w.job_no <> '' and x.id = 'JC-' || w.job_no);

commit;

-- What landed.
select migrated_source,
       count(*)              as invoices,
       sum(amount)           as value,
       min(created_at)::date as earliest,
       max(created_at)::date as latest
  from invoices
 where org_id = '${ORG}' and migrated_source = 'workshop-software'
 group by migrated_source;
`;

  const file = new URL('./import.sql', import.meta.url).pathname;
  writeFileSync(file, sql, 'utf8');
  console.log(`\nWrote ${file}`);
  console.log(`${out.length} invoices, $${total.toFixed(2)}. Paste it into the Supabase SQL editor and press Run.`);
  console.log('No Supabase key is needed for this route.');
  process.exit(0);
}

// --- Talk to Supabase --------------------------------------------------------

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let orgId = process.env.ORG_ID;

if (!url || !key) {
  console.log('\n=== Delta check skipped ===');
  console.log('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not both set, so this run cannot');
  console.log('see what Slim already holds. Set them (see README) to get the real new-vs-existing split.');
  console.log('\nDry run complete. Nothing was written.');
  process.exit(0);
}

// An anon key cannot bypass RLS. It would not error loudly - it would insert
// nothing and report success on an empty result, which is the worst possible
// failure mode for a migration. Check the claim before doing anything.
try {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
  if (claims.role !== 'service_role') {
    console.error(`\nFATAL: that key has role "${claims.role}", not "service_role". Writes would silently do nothing.`);
    process.exit(1);
  }
} catch {
  console.error('\nFATAL: SUPABASE_SERVICE_ROLE_KEY is not a readable JWT - it probably got mangled on paste (see README).');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ORG_ID is a uuid nobody has memorised, and getting it wrong writes real
// invoices into the wrong tenant. With a service_role key it can just be read.
// Only auto-selects when there is exactly one organisation - with more than
// one, guessing is not acceptable, so it stops and lists them.
if (!orgId) {
  const { data, error } = await supabase.from('organizations').select('id, name');
  if (error) { console.error(`FATAL: could not read organizations to resolve ORG_ID: ${error.message}`); process.exit(1); }
  if (data.length === 1) {
    orgId = data[0].id;
    console.log(`\nORG_ID not set - using the only organisation in this project: ${data[0].name || '(unnamed)'} (${orgId})`);
  } else {
    console.error(`\nFATAL: ORG_ID is not set and this project has ${data.length} organisations. Set ORG_ID to one of:`);
    for (const o of data) console.error(`  ${o.id}  ${o.name || '(unnamed)'}`);
    process.exit(1);
  }
}

// PostgREST caps a response at 1000 rows; Slim already holds 1,830+ invoices,
// so paging is not optional here.
async function fetchAll(table, select, apply = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(supabase.from(table).select(select)).range(from, from + 999);
    if (error) { console.error(`FATAL: reading ${table}: ${error.message}`); process.exit(1); }
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const existingRows = await fetchAll('invoices', 'id, amount, status, migrated', (q) => q.eq('org_id', orgId));
const existing = new Map(existingRows.map((r) => [r.id, r]));
console.log(`\nSlim currently holds ${existingRows.length} invoices for this org (${existingRows.filter((r) => !r.migrated).length} live, ${existingRows.filter((r) => r.migrated).length} historical).`);

// The 2026-07-30 migration already loaded most of July into Slim as INV-<n>
// (or JC-<n> where the invoice had no number), flagged migrated = true, and it
// did NOT keep the invoice dates - every one of those 1,830 rows carries the
// import timestamp as created_at. So the same invoice can already be sitting in
// Slim under a different id, dateless and excluded from revenue.
//
// Inserting a WS- row for it would put it on the Invoices screen twice. The
// right move is to ADOPT the row that is already there: give it its real date,
// clear the historical flag so it counts as revenue, and refresh the amount and
// status. One row, correct date, correct totals, nothing duplicated.
//
// Only ever adopts a row that is flagged migrated - a live invoice Slim minted
// itself is never touched, even if its number happens to collide.
function twinOf(i) {
  const inv = 'INV-' + i.sourceNo;
  if (existing.has(inv)) return inv;
  const jobNo = i.job.replace(/^Job #/, '');
  const jc = jobNo ? 'JC-' + jobNo : null;
  if (jc && existing.has(jc)) return jc;
  return null;
}

const collisions = [];
const toAdopt = [];
const toInsert = [];
for (const i of out) {
  if (existing.has(i.id)) continue;
  const twin = twinOf(i);
  if (!twin) { toInsert.push(i); continue; }
  if (existing.get(twin).migrated) toAdopt.push({ ...i, twin });
  else { collisions.push({ ...i, twin }); toInsert.push(i); }
}
const alreadyThere = out.filter((i) => existing.has(i.id));
const changed = alreadyThere.filter((i) => {
  const e = existing.get(i.id);
  return Math.abs(Number(e.amount) - i.amount) > 0.005 || e.status !== i.status;
});

console.log('\n=== Delta ===');
console.log(`New, will be inserted:        ${toInsert.length}  ($${toInsert.reduce((s, i) => s + i.amount, 0).toFixed(2)})`);
console.log(`Already here as history:      ${toAdopt.length}  ($${toAdopt.reduce((s, i) => s + i.amount, 0).toFixed(2)})${toAdopt.length ? (ADOPT ? '  (will be dated and switched to live revenue)' : '  (pass --adopt to date them and count them as revenue)') : ''}`);
for (const a of toAdopt.slice(0, 10)) console.log(`  ${a.twin} -> real date ${a.date}, $${a.amount.toFixed(2)}, ${a.status}`);
if (toAdopt.length > 10) console.log(`  ... and ${toAdopt.length - 10} more`);
if (collisions.length) {
  console.log(`\n  WARNING: ${collisions.length} invoice number(s) match a LIVE Slim invoice that Slim minted itself.`);
  console.log('  Those are left completely alone and imported under their WS- id instead. Check them by hand:');
  for (const c of collisions.slice(0, 10)) console.log(`    source #${c.sourceNo} vs existing ${c.twin}`);
}
console.log(`Already in Slim, unchanged:   ${alreadyThere.length - changed.length}`);
console.log(`Already in Slim, CHANGED:     ${changed.length}${changed.length && !UPDATE ? '  (pass --update to apply)' : ''}`);
for (const c of changed.slice(0, 20)) {
  const e = existing.get(c.id);
  console.log(`  ${c.id}: $${Number(e.amount).toFixed(2)} ${e.status}  ->  $${c.amount.toFixed(2)} ${c.status}`);
}
if (changed.length > 20) console.log(`  ... and ${changed.length - 20} more`);

// --- Customers ---------------------------------------------------------------
// Slim links invoices to customers by name text, not by foreign key (see
// store.jsx), so an invoice for an unknown customer still displays correctly.
// Creating the customer row is therefore optional, and opt-in: --with-customers.

let customersToAdd = [];
{
  const custRows = await fetchAll('customers', 'id, name', (q) => q.eq('org_id', orgId));
  const known = new Set(custRows.map((c) => (c.name || '').trim().toUpperCase()));
  const wanted = new Map();
  for (const i of toInsert) {
    const n = i.customer.trim();
    if (!n || known.has(n.toUpperCase())) continue;
    if (!wanted.has(n.toUpperCase())) wanted.set(n.toUpperCase(), { name: n, spend: 0, count: 0, onAccount: i.on_account });
    const w = wanted.get(n.toUpperCase());
    w.spend += i.amount; w.count++;
  }
  customersToAdd = [...wanted.values()];
  console.log(`\nCustomers on these invoices not yet in Slim: ${customersToAdd.length}` +
    (customersToAdd.length ? (WITH_CUSTOMERS ? '  (will be created)' : '  (pass --with-customers to create them)') : ''));
  for (const c of customersToAdd.slice(0, 10)) console.log(`  ${c.name} - ${c.count} invoice(s), $${c.spend.toFixed(2)}`);
  if (customersToAdd.length > 10) console.log(`  ... and ${customersToAdd.length - 10} more`);
}

// --- Does invoices have a lines column? --------------------------------------
// Probe rather than assume, so this script keeps working whether or not the
// optional migration in add-invoice-lines.sql has been run.
let hasLines = false;
{
  const { error } = await supabase.from('invoices').select('lines').limit(1);
  hasLines = !error;
}
const withLines = out.filter((i) => i.lines.length).length;
if (withLines) {
  console.log(`\nLine items: ${withLines} of these invoices have line detail. ` +
    (hasLines ? 'invoices.lines exists, so it will be stored.' : 'invoices has no `lines` column, so line detail will be DROPPED - run add-invoice-lines.sql first if you want it.'));
}

if (!WRITE) {
  console.log('\nDry run complete. Nothing was written. Re-run with --write to apply.');
  process.exit(0);
}

// --- Write -------------------------------------------------------------------

const toRow = (i) => {
  const row = {
    id: i.id,
    org_id: orgId,
    customer: i.customer,
    job: i.job,
    terms: i.terms,
    due_by: i.due_by,
    status: i.status,
    amount: i.amount,
    credit_hold: false,
    from_job: i.from_job,
    on_account: i.on_account,
    // The real invoice date, not now(). Noon Melbourne so a UTC conversion
    // cannot push a 1st-of-month or end-of-month invoice into the wrong month.
    created_at: `${i.date}T12:00:00${TZ}`,
    // Live revenue by your decision, but the provenance is still recorded.
    migrated: false,
    migrated_source: SOURCE_TAG,
  };
  if (hasLines && i.lines.length) row.lines = i.lines;
  return row;
};

console.log('\n=== Writing ===');

let inserted = 0, failed = 0;
for (let n = 0; n < toInsert.length; n += 500) {
  const batch = toInsert.slice(n, n + 500).map(toRow);
  const { error } = await supabase.from('invoices').insert(batch);
  if (error) { console.error(`  FAILED rows ${n}-${n + batch.length}: ${error.message}`); failed += batch.length; }
  else { inserted += batch.length; console.log(`  inserted ${inserted}/${toInsert.length}`); }
}

let adopted = 0;
if (ADOPT && toAdopt.length) {
  for (const a of toAdopt) {
    const { error } = await supabase.from('invoices')
      .update({
        created_at: `${a.date}T12:00:00${TZ}`,
        migrated: false,
        migrated_source: SOURCE_TAG,
        amount: a.amount,
        status: a.status,
        terms: a.terms,
        due_by: a.due_by,
      })
      .eq('id', a.twin).eq('org_id', orgId).eq('migrated', true);
    if (error) console.error(`  FAILED adopt ${a.twin}: ${error.message}`);
    else adopted++;
  }
  console.log(`  adopted ${adopted}/${toAdopt.length}`);
}

let updated = 0;
if (UPDATE && changed.length) {
  for (const c of changed) {
    const { error } = await supabase.from('invoices')
      .update({ amount: c.amount, status: c.status, due_by: c.due_by })
      .eq('id', c.id).eq('org_id', orgId);
    if (error) console.error(`  FAILED update ${c.id}: ${error.message}`);
    else updated++;
  }
}

let custAdded = 0;
if (WITH_CUSTOMERS && customersToAdd.length) {
  const rows = customersToAdd.map((c) => ({
    id: randomUUID(), org_id: orgId, name: c.name, phone: '', email: '', vehicle: '',
    last_visit: '', status: c.onAccount ? 'Account' : 'Retail', spend: c.spend, job_history: [],
  }));
  for (let n = 0; n < rows.length; n += 500) {
    const { error } = await supabase.from('customers').insert(rows.slice(n, n + 500));
    if (error) console.error(`  FAILED customers ${n}: ${error.message}`);
    else custAdded += Math.min(500, rows.length - n);
  }
}

console.log(`\nInvoices inserted: ${inserted}${failed ? `  (${failed} failed)` : ''}`);
if (ADOPT) console.log(`Invoices adopted:  ${adopted}  (existing history, now dated and counting as revenue)`);
if (UPDATE) console.log(`Invoices updated:  ${updated}`);
if (WITH_CUSTOMERS) console.log(`Customers created: ${custAdded}`);
console.log(`\nDone. Safe to re-run - a second run will find these ${inserted} already present and skip them.`);
