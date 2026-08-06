// Export the outstanding MechanicDesk receivables to CSV *before* the invoice
// history is purged from Platform OS (see supabase/fresh-start.sql).
//
// Why this exists: Platform OS is being reset to a clean FY2026-27 start, so
// the 1,830 imported invoices are being deleted. Roughly $312k of those are
// marked unpaid. However much of that is genuinely collectable, deleting the
// ledger without a copy means nobody ever chases it — the debt just silently
// stops existing. This writes the unpaid rows to a spreadsheet you can work
// through by hand (or hand to a bookkeeper) after the purge.
//
// This script only READS. It cannot modify or delete anything.
//
// Run BEFORE the purge:
//   export SUPABASE_URL=...
//   export SUPABASE_SERVICE_ROLE_KEY=...   # service_role, not anon
//   export ORG_ID=...
//   node export-receivables.mjs
//
// Writes ./receivables-<date>.csv next to this script.

import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ORG_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ORG_ID) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ORG_ID.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Supabase caps a single response; page through so a large ledger can't be
// silently truncated into a short, reassuring-looking export.
const PAGE = 1000;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, customer, job, terms, due_by, status, amount, created_at')
    .eq('org_id', ORG_ID)
    .neq('status', 'Paid')
    .order('due_by', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < PAGE) break;
}

if (!rows.length) {
  console.log('No unpaid invoices found — nothing to export.');
  process.exit(0);
}

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const HEADERS = ['id', 'customer', 'job', 'terms', 'due_by', 'status', 'amount', 'created_at'];
const csv = [
  HEADERS.join(','),
  ...rows.map((r) => HEADERS.map((h) => esc(r[h])).join(',')),
].join('\n');

const stamp = new Date().toISOString().slice(0, 10);
const out = new URL(`./receivables-${stamp}.csv`, import.meta.url).pathname;
writeFileSync(out, csv);

const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
console.log(`Exported ${rows.length} unpaid invoices to ${out}`);
console.log(`Total outstanding: $${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
console.log('\nKeep this file. Once the purge runs, this is the only copy inside');
console.log('Platform OS — the source of record stays MechanicDesk.');
