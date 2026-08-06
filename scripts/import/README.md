# MechanicDesk → Platform OS import

One-time migration of TyrePlus Thomastown's real workshop data (exported from
MechanicDesk as 5 CSVs) into Platform OS's Supabase tables.

**Status: already run successfully on 2026-07-30.** Kept here as the record of
what was imported and how, and so a second tenant's data can be migrated the
same way. Re-running against the same org would create duplicates for every
table except `invoices` (which has real primary keys and would be rejected).

## What was imported

| Table | Rows |
|---|---|
| suppliers | 13 |
| customers | 792 |
| vehicles | 1,489 |
| invoices | 1,830 |
| tyre_stock | 211 |
| parts | 2,055 |
| **total** | **6,390** |

$1,064,220.15 of invoice history.

## Usage

```
npm install                       # in this directory
export CSV_DIR=~/Downloads        # folder holding the 5 exported CSVs
node import.mjs                   # dry run — prints what would happen, writes nothing

export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key, NOT anon>"
export ORG_ID="<uuid from the organizations table>"
node import.mjs --write           # real import
```

Run `supabase/purge-sample-data.sql` first if the app has ever been opened
against the target project — it auto-seeds fake demo rows into empty tables.

### Getting the key in without corrupting it

The `service_role` key repeatedly arrived mangled when pasted into a terminal
(Supabase's masked display copies as bullet characters; long pastes also got
truncated). What worked: copy the key from Supabase, then have a script read
the clipboard directly, so the key never passes through a terminal paste:

```bash
cat > go.sh << 'EOF'
#!/bin/bash
export SUPABASE_SERVICE_ROLE_KEY=$(pbpaste | tr -cd 'A-Za-z0-9._-')
export CSV_DIR=~/Downloads
export SUPABASE_URL="https://<project>.supabase.co"
export ORG_ID="<org uuid>"
node import.mjs --write
EOF
```
Then copy the key from Supabase and **type** `bash go.sh` (typing it, not
pasting, keeps the key in the clipboard). Note `bash go.sh` runs in a subshell,
so the exports don't persist afterwards — expected, not a bug.

The script validates the key up front (JWT shape + `role` claim) and refuses
to write on an `anon` key, since anon can't bypass RLS and would fail silently
partway through.

## Mapping decisions

All derived from inspecting the real export, not from MechanicDesk docs
(which weren't available). Each is a judgement call worth re-checking against
a second tenant's data:

- **Quotes excluded.** Only `invoice_type = I` imports. `Q` rows (15) were
  never billed; importing them would overstate revenue.
- **Invoice status from `balance_due`, not the status code.** `balance_due = 0`
  → Paid, otherwise → Sent. The O/C/P codes disagree with the balance on 8
  rows (coded Open, zero balance). Nothing is marked "Overdue" — there is no
  due-date field anywhere in the export, so that would be unsupported.
- **Invoice IDs are namespaced `INV-` / `JC-`.** Invoice numbers and job-card
  numbers share one counter, so 471 invoice-number-less rows collide with real
  invoices if both use the same prefix (341 collisions — different customers,
  dates, amounts). This is what rejected the first invoice import attempt.
- **Placeholder customers skipped, their invoices kept.** Rows literally named
  "DO NOT USE", "DO NOT USE THIS ONE", "Cash Sale" get no customer record, but
  invoices/vehicles referencing them still import — that money and vehicle
  history is real, it just can't be attributed to a named customer.
- **Labour/fee items excluded from parts.** `product_type = J` (8 rows:
  "Labour", "Data Fee", "Registration Data Fee") aren't physical stock.
- **Tyres split from parts by type OR item-code shape.** `product_type = T`,
  plus anything whose item code looks like a tyre size (`205/55R16`-style),
  since real tyre rows are inconsistently typed `S` in the source.
- **Duplicate item codes deliberately NOT merged.** 162 codes repeat, but 105
  of those have differing prices because the same code covers different line
  items — e.g. `18X9.50-8` is both "NEW TYRE" ($160) and "PUNCTURE" ($50).
  Merging would silently destroy real pricing.
- **Vehicle service dates left blank.** 0 of 1,489 vehicles have
  `last_service`/`next_service` in the export — nothing to import.

## Known gaps

- Customer `spend` and `jobHistory` are computed by matching invoices on
  customer name text (the export has no customer IDs). Totals come out close
  to but not exactly equal to the invoice sum, since some invoices belong to
  placeholder-named customers.
- `invoiceItem-*.csv` (line-item detail) exists in the export but is not
  imported — Platform OS has no line-item table for historical invoices.
