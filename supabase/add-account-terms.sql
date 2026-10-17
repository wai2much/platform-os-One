-- Account customers, payment terms, and a real invoice due date.
--
-- The missing half of billing. Slim could record money against an invoice (see
-- add-payments.sql) but had no idea a customer was on account, what terms they
-- were on, or when an invoice was actually due — so nothing ever went overdue.
-- This adds:
--   customers.account_type   'cash' | 'account'
--   customers.default_terms  a terms code (see src/lib/terms.js) — the terms a
--                            new invoice for this customer inherits
--   customers.credit_limit   optional ceiling for their account (numeric, null = none)
--   invoices.due_date        the date the invoice falls due, as a real date
--
-- "Overdue" is NOT stored: it is derived in src/lib/invoiceMoney.js as
-- balance owing AND due_date in the past, the same way balance due is derived
-- from the payments ledger. One rule, computed everywhere, never stale.
--
-- All columns are nullable / defaulted, and the row mappers in store.jsx
-- coalesce nulls, so existing rows need no backfill to keep working: an invoice
-- with no due_date is simply never overdue. Safe to run more than once.

alter table customers add column if not exists account_type  text not null default 'cash';
alter table customers add column if not exists default_terms  text not null default 'DUE_ON_RECEIPT';
alter table customers add column if not exists credit_limit   numeric;

alter table invoices  add column if not exists due_date       date;

-- ---------------------------------------------------------------------------
-- OPTIONAL backfill — gives existing invoices a due date so the Overdue state
-- and the Statements "past terms" count work on day one instead of only on
-- invoices raised from here on. Review before running; it only ever fills a
-- due_date that is currently empty, and never touches money.
--
-- It reads the existing free-text `terms` column, understanding both Slim's
-- own labels and the Workshop Software export codes the July/August import
-- carried, and counts from the invoice's own date (created_at, in Melbourne
-- time). EOM codes count from the end of that month, matching src/lib/terms.js.
-- ---------------------------------------------------------------------------
-- update invoices set due_date = (
--   case upper(coalesce(terms, ''))
--     when '' then (created_at at time zone 'Australia/Melbourne')::date
--     when 'CASHONDEL' then (created_at at time zone 'Australia/Melbourne')::date
--     when 'DUE ON RECEIPT' then (created_at at time zone 'Australia/Melbourne')::date
--     when '7DAYS' then (created_at at time zone 'Australia/Melbourne')::date + 7
--     when 'NET 7' then (created_at at time zone 'Australia/Melbourne')::date + 7
--     when '14DAYS' then (created_at at time zone 'Australia/Melbourne')::date + 14
--     when 'NET 14' then (created_at at time zone 'Australia/Melbourne')::date + 14
--     when '30DAYS' then (created_at at time zone 'Australia/Melbourne')::date + 30
--     when 'NET 30' then (created_at at time zone 'Australia/Melbourne')::date + 30
--     when '30DAYSAEOM' then (date_trunc('month', (created_at at time zone 'Australia/Melbourne')) + interval '1 month - 1 day')::date + 30
--     when '60DAYSAEOM' then (date_trunc('month', (created_at at time zone 'Australia/Melbourne')) + interval '1 month - 1 day')::date + 60
--     else (created_at at time zone 'Australia/Melbourne')::date
--   end
-- )
-- where due_date is null;
