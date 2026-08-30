# Workshop Software to Platform OS Slim: invoice bridge

Brings invoices out of Workshop Software and into Slim's `invoices` table.
Built for the July 2026 to date catch up, but written to be re-run on any
window, as often as you like.

Not the same thing as `scripts/import/`. That was the one shot MechanicDesk
migration on 30 July 2026 (6,390 rows, all six tables, flagged historical).
This one does invoices only, on a date window, repeatably, and the rows it
writes count as **live revenue**.

## What it does

* Reads the CSVs from Workshop Software's export (Actions to Export to History)
* Keeps only invoices dated inside the window, default 1 July 2026 to today
* Drops quotes, estimates and drafts, since they were never billed
* Compares against what Slim already holds and inserts only what is missing
* Writes each invoice with its **real invoice date** as `created_at`, so July
  invoices report as July revenue instead of landing in whatever month you
  happened to run the import
* Stamps `migrated_source = 'workshop-software'` but leaves `migrated = false`,
  so these rows appear in Dashboard revenue, Reports, Statements and Heather's
  money answers, while still being traceable back to their source

## Before you start

Export from Workshop Software: **Actions to Export to History**, which gives
you two files, Invoice Headers and Invoice Items. Put them both in one folder.
Nothing else needs to be exported. If you also want customer records created
for names Slim has never seen, that is a flag below, not another export.

## 1. Dry run

```bash
cd scripts/bridge-workshop-software
npm install
CSV_DIR=~/Downloads/workshop-export node bridge.mjs
```

This writes nothing. It prints the column mapping it worked out, the invoice
count and dollar value per month, what it skipped and why, and a first and last
row so you can eyeball them against the real thing in Workshop Software.

**Read the column mapping before anything else.** Workshop Software does not
publish its export column names, so the script matches headers against an alias
table rather than assuming. If a line reads `total -> (not found)` it stops
instead of importing zeros. To fix it, open `bridge.mjs`, find `ALIASES` near
the top, and add the real header name to the right list. That is a one line
edit and the only maintenance this script should ever need.

## 2. Dry run against the real database

Same command, with credentials set. Still writes nothing, but now it can tell
you how many of those invoices Slim already has:

```bash
export SUPABASE_URL="https://ysavtiiezxbqcnkkjnjo.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key, NOT anon>"
export ORG_ID="<uuid from the organizations table>"
CSV_DIR=~/Downloads/workshop-export node bridge.mjs
```

`ORG_ID` comes from Supabase, table `organizations`, the id column.

### Getting the service key in without corrupting it

Same trap as last time. Supabase's masked display copies as bullet characters
and long pastes get truncated, so the key arrives mangled and the script
refuses it. What works is having a script read the clipboard directly:

```bash
cat > go.sh << 'EOF'
#!/bin/bash
export SUPABASE_SERVICE_ROLE_KEY=$(pbpaste | tr -cd 'A-Za-z0-9._-')
export SUPABASE_URL="https://ysavtiiezxbqcnkkjnjo.supabase.co"
export ORG_ID="<org uuid>"
export CSV_DIR=~/Downloads/workshop-export
node bridge.mjs "$@"
EOF
```

Copy the key from Supabase, then **type** `bash go.sh` rather than pasting it,
so the key stays in the clipboard. `go*.sh` is gitignored here.

The script checks the key's `role` claim before touching anything. An anon key
cannot bypass RLS, so it would insert nothing and report success on an empty
result, which is the one failure mode a migration must never have.

## 3. Write

```bash
bash go.sh --write
```

Then reload Slim and check the Invoices screen and the Dashboard revenue tile.

## Flags

| Flag | Effect |
|---|---|
| *(none)* | Dry run. Always start here. |
| `--write` | Insert the new invoices. |
| `--adopt` | For invoices the 30 July migration already loaded as historical: give them their real date and switch them to live revenue in place, instead of importing a second copy. See below. |
| `--update` | Also push changed amounts and statuses onto invoices Slim already has. Off by default, because overwriting live financial rows is not a decision a script should make quietly. |
| `--with-customers` | Create customer records for names on these invoices that Slim has never seen. Off by default. Invoices display correctly without it, since Slim links customers by name text rather than by foreign key. |

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `CSV_DIR` | `./data` | Folder holding the exported CSVs. |
| `FROM` | `2026-07-01` | Window start, inclusive. |
| `TO` | today | Window end, inclusive. |
| `SUPABASE_URL` | | Required to write. |
| `SUPABASE_SERVICE_ROLE_KEY` | | Required to write. Must be service_role. |
| `ORG_ID` | | Required to write. |
| `DATE_ORDER` | `auto` | `dmy` or `mdy` to force it. Auto detects from the data. |
| `ID_PREFIX` | `WS-` | See below. |
| `TZ_OFFSET` | `+10:00` | Melbourne. Only matters at month boundaries. |
| `INVOICES_CSV` | | Filename override if it picks the wrong file. |
| `ITEMS_CSV` | | Same, for the line items file. |

## The July overlap, and why `--adopt` exists

The 30 July migration already loaded 1,830 invoices into Slim, July's included,
flagged historical. It also threw the invoice dates away: every one of those
rows carries the import timestamp as `created_at`, not the day the work was
invoiced. So July revenue cannot be recovered by flipping a flag, because there
is no date left to filter on.

Importing July again as fresh `WS-` rows would put every July invoice on the
Invoices screen twice.

So the bridge checks whether each invoice is already in Slim under its old
`INV-` or `JC-` id, and if it is, adopts that row rather than inserting a new
one: real date written on, historical flag cleared, amount and status
refreshed. One row, correct date, correct totals, nothing duplicated. August
invoices have no old twin, so they simply insert.

It only ever adopts a row flagged `migrated`. If a Workshop Software invoice
number happens to collide with an invoice Slim minted itself, that live row is
left completely alone and the import lands under its `WS-` id, with a warning
naming both so you can look at it.

## Decisions worth knowing about

**Invoice ids are namespaced `WS-`.** Slim holds MechanicDesk rows under
`INV-` and `JC-`, and mints its own new invoices as `INV-<n>`. Workshop
Software numbers from its own counter, so an unprefixed import would collide on
the primary key and Postgres would reject the entire batch. `WS-` keeps the
three sources apart permanently, and it means you can see at a glance where any
invoice in Slim came from.

**Paid status comes from the balance, not the status code.** If a balance
column exists, a zero balance means Paid and anything else means Sent, or
Overdue when the due date has passed. Status codes lag behind reality. The
MechanicDesk export had eight rows coded Open on a zero balance, and there is
no reason to expect this one to be cleaner.

**Running it twice is safe.** The second run finds the same ids already
present and skips them. That is what makes this something you can run monthly
rather than a one shot you have to be careful with.

**Line items are only stored if there is somewhere to put them.** Slim's
`invoices` table has no line item column, which is why the MechanicDesk import
dropped its item file. If you want the detail, run `add-invoice-lines.sql` in
the Supabase SQL editor first. The bridge probes for the column at runtime, so
it works either way and tells you which is happening.

## What it does not do

* Vehicles, products, stock and suppliers. Invoices only, by design. Those came
  across in the July MechanicDesk migration and a second source writing into
  the same tables would create duplicates, not updates.
* Payments and part payment history. Slim stores a single status per invoice,
  not a payment ledger.
* Deletions. An invoice voided in Workshop Software after being imported stays
  in Slim. Run with `--update` to catch amount and status changes, but a
  deleted row cannot be seen in an export that no longer contains it.
