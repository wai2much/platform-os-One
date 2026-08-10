-- ============================================================================
-- Platform OS (Slim) — FRESH START (go-live)
-- ============================================================================
-- Run ONCE in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query ->
-- paste -> Run) when you're ready to start real front-office use.
--
-- WHAT IT DOES
--   • Backs every table up first into recoverable _backup_* copies (so this is
--     reversible — nothing is truly gone until you drop those).
--   • Empties every OPERATIONAL table (jobs, invoices, bookings, parts, tyre
--     stock, suppliers, staff, HR, loan cars, stock take, reviews) — a clean
--     day-one board.
--   • KEEPS your customers and their vehicles (+ the service-history summary
--     attached to each) — only the 5 demo/sample customers & vehicles are
--     removed, matched on name+phone / model+rego so real records are safe.
--
-- WHAT IT DOES NOT TOUCH: organizations, memberships (your login/tenant),
--   xero_tokens, or any auth tables.
--
-- ⚠️  Single-tenant note: these deletes are unscoped (they clear the whole
--     table). That's what you want for your one workshop's fresh start. If you
--     ever run this on a multi-tenant DB, add "where org_id = '<your-org-id>'".
-- ============================================================================

-- 1) BACKUPS (recoverable). "if not exists" keeps the FIRST backup if re-run.
create table if not exists _backup_jobs               as select * from jobs;
create table if not exists _backup_invoices           as select * from invoices;
create table if not exists _backup_bookings           as select * from bookings;
create table if not exists _backup_reviews            as select * from reviews;
create table if not exists _backup_team_members       as select * from team_members;
create table if not exists _backup_suppliers          as select * from suppliers;
create table if not exists _backup_hires              as select * from hires;
create table if not exists _backup_leave_requests     as select * from leave_requests;
create table if not exists _backup_payroll_entries    as select * from payroll_entries;
create table if not exists _backup_disciplinary_notes as select * from disciplinary_notes;
create table if not exists _backup_loan_cars          as select * from loan_cars;
create table if not exists _backup_parts              as select * from parts;
create table if not exists _backup_tyre_stock         as select * from tyre_stock;
create table if not exists _backup_stock_take_items   as select * from stock_take_items;
create table if not exists _backup_customers          as select * from customers;
create table if not exists _backup_vehicles           as select * from vehicles;

-- 2) EMPTY the operational tables (clean day-one board).
delete from jobs;
delete from invoices;
delete from bookings;
delete from reviews;
delete from team_members;
delete from suppliers;
delete from hires;
delete from leave_requests;
delete from payroll_entries;
delete from disciplinary_notes;
delete from loan_cars;
delete from parts;
delete from tyre_stock;
delete from stock_take_items;

-- 3) Remove ONLY the 5 demo customers & vehicles — real records are kept.
delete from customers where (name, phone) in (
  ('T. Nguyen', '0412 663 921'),
  ('A. Costa', '0403 118 447'),
  ('M. Petrakis', '0439 552 108'),
  ('L. Farrow', '0418 907 233'),
  ('S. Bianchi', '0421 774 560')
);

delete from vehicles where (model, rego) in (
  ('Ford Ranger', 'WLR 442'),
  ('Audi A4', '1TY 9KH'),
  ('VW Golf GTI', '8QT 3ZL'),
  ('Toyota Hilux', 'HLX 019'),
  ('Mini Cooper S', 'MCS 771')
);

-- DONE. Reload the app — you should see only your real customers/vehicles and
-- clean, empty operational screens.
--
-- To undo (restore from backup), for any table:
--   delete from jobs; insert into jobs select * from _backup_jobs;
-- Once you're happy it's all correct, clean up the safety copies:
--   drop table if exists _backup_jobs, _backup_invoices, _backup_bookings,
--     _backup_reviews, _backup_team_members, _backup_suppliers, _backup_hires,
--     _backup_leave_requests, _backup_payroll_entries, _backup_disciplinary_notes,
--     _backup_loan_cars, _backup_parts, _backup_tyre_stock, _backup_stock_take_items,
--     _backup_customers, _backup_vehicles;
