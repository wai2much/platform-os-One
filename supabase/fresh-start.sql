-- Fresh start: Platform OS begins at FY2026-27.
--
-- Decision (Wai, 31 Jul 2026): the MechanicDesk history imported on 30 Jul
-- 2026 does not carry over. Platform OS opens with a clean ledger rather than
-- inheriting the old system's bookkeeping state — including the ~$293k sitting
-- in the 90+ day bucket that we established was more likely stale un-closed-off
-- records than genuinely collectable debt.
--
-- WHAT THIS DELETES: invoice history only.
-- WHAT THIS KEEPS: the customer book, vehicle register, suppliers, and current
-- stock. Those are reference data you need to trade tomorrow morning, not
-- history — deleting them would mean a 20-year workshop opening with an empty
-- customer list.
--
-- BEFORE RUNNING:
--   1. Run scripts/fresh-start/export-receivables.mjs and keep the CSV.
--      After this, Platform OS has no record of who owed what.
--   2. Do NOT cancel MechanicDesk or delete the CSV exports. The ATO requires
--      business records be kept 5 years. That obligation is satisfied by
--      MechanicDesk remaining the archive for everything before 1 Jul 2026 —
--      it is NOT satisfied by Platform OS, which is why it can start clean.
--
-- Replace :org_id with the real org UUID before running.

begin;

-- 1. The invoice ledger. This is the actual "old history".
delete from invoices where org_id = :'org_id';

-- 2. Historical money figures baked onto customer records.
--    `spend` was imported as a lifetime-total from MechanicDesk. With the
--    invoices gone it reconciles against nothing — a number on the Customers
--    screen that no longer traces to a single row anywhere in the system.
--    That is the same "figure with no source" problem we spent two PRs
--    removing from the UI, so it gets zeroed rather than left to mislead.
update customers
   set spend = 0,
       job_history = null
 where org_id = :'org_id';

-- 3. Sanity check — should report 0 invoices remaining.
select count(*) as invoices_remaining from invoices where org_id = :'org_id';

commit;

-- NOT deleted, deliberately:
--   customers  - names, phones, emails. The customer book.
--   vehicles   - rego, model, owner, last_service, next_due. `next_due` is how
--                you know a car is due back; that is forward-looking, not history.
--   suppliers  - who you buy from.
--   tyre_stock - what is on the racks right now.
--   parts      - what is on the shelves right now.
--
-- Also note: the pending Phase 8 migration (invoices.migrated /
-- migrated_source) is now unnecessary and should NOT be run. With no imported
-- invoices there is nothing to separate — every invoice is live by definition.
-- The app code handles this on its own: store.jsx reads `!!r.migrated`, which
-- is false when the column does not exist, so liveInvoices() returns
-- everything. No code change required.
