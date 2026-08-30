-- Vehicle and job context on the invoice.
--
-- Workshop Software carries these on every invoice: the car, the odometer, how
-- far the job got, and what the customer needs to be told. A workshop invoice
-- without a rego and an odometer reading is a receipt, not a workshop invoice.
--
-- All free text on purpose. Rego formats vary by state, odometers get written
-- as "150,000 km" or "150000", and next service is "6 months or 10,000km" as
-- often as it is a number. A typed column would fight the person using it.
--
-- Nullable, no defaults: the row mappers in store.jsx coalesce null to '', so
-- the 264 existing invoices need no backfill. Safe to run more than once.

alter table invoices add column if not exists vehicle text;
alter table invoices add column if not exists rego text;
alter table invoices add column if not exists odometer text;
alter table invoices add column if not exists next_service_km text;
alter table invoices add column if not exists job_status text;
alter table invoices add column if not exists job_status_comment text;
alter table invoices add column if not exists notes text;
