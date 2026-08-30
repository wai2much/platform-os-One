-- Part payments, balance due, deposits and applied credits.
--
-- Workshop Software treats an invoice as a running balance with a ledger of
-- payments against it, not a paid/unpaid flag. This is that, minimally:
--   payments      the ledger. [{ id, date, amount, method, ref, note }]
--                 method 'Credit' = account credit applied, not money moved.
--   order_number  the customer's own PO / order reference (WSS "Order Number").
--
-- Balance due is deliberately NOT stored. It is amount - sum(payments), derived
-- in one place (src/lib/invoiceMoney.js) so a stored copy can never drift from
-- the ledger. Both columns are nullable: the row mappers in store.jsx coalesce
-- null to [] and '', so pre-existing invoices need no backfill and invoices
-- already settled before the ledger existed keep their 'Paid' status, which
-- balanceDue() reads as "owed nothing". Safe to run more than once.
--
-- APPLIED to the live project (ysavtiiezxbqcnkkjnjo) on 2026-08-30 — 264
-- invoices, none carrying payments yet.

alter table invoices add column if not exists payments jsonb;
alter table invoices add column if not exists order_number text;
