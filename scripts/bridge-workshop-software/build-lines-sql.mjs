// Backfills line items onto the invoices already imported from Workshop
// Software. The header export gave us the money; the item export gives us what
// the money was for. Emits one UPDATE, safe to re-run.
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const DIR = process.env.CSV_DIR || `${process.env.HOME}/Downloads/workshop-export`;
const ORG = process.env.ORG_ID || '26a3a65c-8355-455c-a74a-42d50e234cc1';

const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
const itemFile = files.find((f) => /item/i.test(f));
if (!itemFile) { console.error('No invoice item CSV found in ' + DIR); process.exit(1); }

const rows = parse(readFileSync(`${DIR}/${itemFile}`, 'utf-8'), {
  columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, trim: true,
});
const cols = Object.keys(rows[0] || {});
const find = (...names) => cols.find((c) => names.includes(c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')));
const C = {
  inv: find('invoiceno', 'invoicenumber', 'invno', 'invoiceid', 'invoice'),
  code: find('itemcode', 'partno', 'partnumber', 'productcode', 'sku', 'code'),
  desc: find('description', 'itemdescription', 'partdescription', 'details', 'item'),
  qty: find('quantity', 'qty', 'qtysold', 'units'),
  price: find('unitprice', 'sellprice', 'retailprice', 'priceeach', 'price', 'rate'),
  total: find('linetotal', 'lineamount', 'extended', 'extendedprice', 'total', 'amount'),
};
if (!C.inv) { console.error('Could not find an invoice-number column. Headers: ' + cols.join(', ')); process.exit(1); }
console.log('item file:', itemFile);
console.log('columns:', JSON.stringify(C));

const money = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const byInv = new Map();
for (const r of rows) {
  const key = String(r[C.inv] ?? '').trim();
  if (!key) continue;
  const line = {
    code: C.code ? String(r[C.code] ?? '').trim() : '',
    desc: C.desc ? String(r[C.desc] ?? '').trim() : '',
    qty: C.qty ? (parseFloat(r[C.qty]) || 0) : 0,
    price: C.price ? money(r[C.price]) : 0,
    total: C.total ? money(r[C.total]) : 0,
  };
  if (!line.desc && !line.code && !line.total) continue;
  if (!byInv.has(key)) byInv.set(key, []);
  byInv.get(key).push(line);
}

const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const values = [...byInv.entries()]
  .map(([no, lines]) => `  (${q('WS-' + no)}, ${q(JSON.stringify(lines))}::jsonb)`)
  .join(',\n');

const sql = `-- Line items for the Workshop Software invoices already imported.
-- ${byInv.size} invoices, ${rows.length} source rows. Safe to re-run.

alter table invoices add column if not exists lines jsonb not null default '[]';

update invoices i
   set lines = v.lines
  from (values
${values}
) as v(id, lines)
 where i.id = v.id
   and i.org_id = '${ORG}';

select count(*) filter (where jsonb_array_length(lines) > 0) as with_items,
       count(*)                                              as total_invoices
  from invoices
 where org_id = '${ORG}' and migrated_source = 'workshop-software';
`;
writeFileSync('lines.sql', sql);
console.log(`invoices with items: ${byInv.size}, total line rows: ${rows.length}`);
console.log('wrote lines.sql', sql.length, 'bytes');
