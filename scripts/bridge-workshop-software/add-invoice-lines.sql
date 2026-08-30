-- Optional. Only needed if you want Workshop Software's invoice LINE ITEMS
-- stored alongside each imported invoice.
--
-- Slim's `invoices` table has no line-item storage (jobs do, invoices do not),
-- which is why the 2026-07-30 MechanicDesk import dropped its invoiceItem CSV
-- on the floor. This adds the same jsonb shape jobs already uses, so the
-- bridge can carry line detail across. The bridge probes for this column at
-- runtime: without it, invoices still import, just without their lines.
alter table invoices add column if not exists lines jsonb not null default '[]';
