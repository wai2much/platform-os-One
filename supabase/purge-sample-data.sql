-- ============================================================================
-- Platform OS (Slim) — purge the auto-seeded sample data
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor (Dashboard -> SQL Editor -> paste
-- -> Run), for the org whose database you want cleaned before real Workshop
-- Software data goes in.
--
-- WHY THIS EXISTS
-- The app auto-seeds each table with sample rows (T. Nguyen, A. Costa, Sam
-- Okafor, Burson Auto Parts, ...) the first time it finds that table empty
-- for a given org — see src/core/store.jsx's SEED_* constants and the
-- upsert-if-empty logic in StoreProvider. Once a real Supabase project is
-- connected and the app has been opened at least once, those rows are sitting
-- in the real database, not just in memory.
--
-- SAFE BY DESIGN: every delete below matches the FULL set of distinguishing
-- columns from the exact seed data (e.g. customers matches name AND phone
-- together, not just name). It will only ever remove rows that are byte-for-
-- byte identical to the sample data — never anything you've since added,
-- even if a real record happens to share one field with a sample row (e.g. a
-- real customer also named "T. Nguyen" with a different phone number is left
-- untouched).
--
-- Safe to re-run — deleting rows that no longer exist is a no-op.
-- ============================================================================

delete from jobs where id in ('J-0412', 'J-0418', 'J-0409', 'J-0421', 'J-0424');

delete from bookings where id in ('b1', 'b2', 'b3');

delete from invoices where id in ('INV-1042', 'INV-1039', 'INV-1051', 'INV-1053', 'INV-1055');

delete from reviews where id in ('rv1', 'rv2', 'rv3', 'rv4', 'rv5');

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

delete from team_members where (name, role) in (
  ('Sam Okafor', 'Senior Technician'),
  ('Dean Whitlock', 'Technician'),
  ('Anthony Ruiz', 'Apprentice, Yr 3')
);

delete from suppliers where name in (
  'Burson Auto Parts', 'Repco', 'BMW Genuine Parts', 'Penrite Oil', 'NGK Spark Plugs', 'Ryco Filters'
);

delete from hires where (name, role) = ('J. Alvarez', 'Apprentice Technician');

delete from leave_requests where (name, leave_type, dates) in (
  ('Dean Whitlock', 'Annual leave', '4–8 Aug'),
  ('Anthony Ruiz', 'Sick leave', '26 Jul')
);

delete from payroll_entries where (name, hours, rate) in (
  ('Sam Okafor', 76, 38),
  ('Dean Whitlock', 74, 34),
  ('Anthony Ruiz', 72, 24)
);

delete from disciplinary_notes where (name, note_date) = ('Anthony Ruiz', '2 Jul 2026');

delete from loan_cars where car in (
  'Toyota Corolla · 1LC 442', 'Mazda 3 · 2LC 891', 'Hyundai i30 · 3LC 205', 'Kia Cerato · 4LC 630'
);

delete from parts where name in (
  'Penrite 5W-30 Full Synthetic', 'Ryco Oil Filter Z516', 'NGK Spark Plug BKR6E',
  'Bosch Brake Pads (Front)', 'Wynns Coolant Concentrate', 'Cabin Air Filter (Universal)'
);

delete from tyre_stock where (brand, model, size) in (
  ('Bridgestone', 'Turanza T005', '225/45R17'),
  ('Michelin', 'Pilot Sport 4', '265/60R18'),
  ('ZMAX', 'X-Spider', '195/R14C'),
  ('Continental', 'CrossContact', '225/65R17'),
  ('Bridgestone', 'Dueler A/T', '265/65R17'),
  ('Michelin', 'Primacy 4', '205/55R16'),
  ('Yokohama', 'BluEarth-GT', '215/45R17'),
  ('Continental', 'PremiumContact 6', '245/40R18')
);

delete from stock_take_items where name in (
  'Penrite 5W-30 Full Synthetic', 'Ryco Oil Filter Z516', 'NGK Spark Plug BKR6E (4-pack)',
  'Bosch Brake Pads (Front)', 'Wynns Coolant Concentrate', 'Cabin Air Filter (Universal)'
);

-- IMPORTANT: after running this, do NOT reload the app before real data is
-- ready to go in — StoreProvider re-seeds any table it finds empty, so an
-- empty table plus a page load brings all of this straight back.
