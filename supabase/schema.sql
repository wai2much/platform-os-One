-- Platform OS (Slim) — demo/dev schema.
-- Run this once in a NEW Supabase project's SQL editor (Project Settings ->
-- SQL Editor -> New query). Do NOT run this against v2.5's production
-- project (uffloapilsxezsjbqxzj) — that's TyrePlus's live business data;
-- Slim gets its own project so a demo write can never touch it.

create table if not exists jobs (
  id text primary key,
  customer text not null default '',
  vehicle text not null default '',
  tech text not null default '',
  status text not null default 'Booked',
  total numeric not null default 0,
  lines jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id text primary key,
  customer text not null default '',
  job text not null default '',
  terms text not null default '',
  due_by text not null default '',
  status text not null default 'Sent',
  amount numeric not null default 0,
  credit_hold boolean not null default false,
  from_job boolean not null default false,
  on_account boolean not null default false,
  created_at timestamptz not null default now()
);

-- Bookings — both internal (staff-created) and portal (customer-submitted,
-- via the public Customer Booking Portal) rows live here, distinguished by
-- `source`. Replaces the prototype's localStorage bridge now that there's a
-- real backend: the portal inserts, the internal Bookings screen reads.
create table if not exists bookings (
  id text primary key,
  customer text not null default '',
  phone text not null default '',
  vehicle text not null default '',
  service text not null default '',
  day text not null default '',
  time text not null default '',
  notes text not null default '',
  source text not null default 'internal', -- 'internal' | 'portal'
  bay text not null default '',
  created_at timestamptz not null default now()
);

-- Xero OAuth tokens — written only by api/xero/callback.js (server-side).
-- Single row keyed 'default' since this is one workshop; a real multi-tenant
-- build would key this by tenant/organisation id instead.
create table if not exists xero_tokens (
  id text primary key default 'default',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  tenant_id text not null default '',
  updated_at timestamptz not null default now()
);

alter table jobs enable row level security;
alter table invoices enable row level security;
alter table bookings enable row level security;
alter table xero_tokens enable row level security;

-- Permissive demo policies — anon can read/write everything. This is fine for
-- a prototype/demo project with no real customer data. Before onboarding a
-- real tenant, replace these with per-tenant, auth-scoped policies (the
-- multi-tenant work tracked separately).
create policy "demo anon read jobs" on jobs for select using (true);
create policy "demo anon write jobs" on jobs for insert with check (true);
create policy "demo anon update jobs" on jobs for update using (true);

create policy "demo anon read invoices" on invoices for select using (true);
create policy "demo anon write invoices" on invoices for insert with check (true);
create policy "demo anon update invoices" on invoices for update using (true);

create policy "demo anon read bookings" on bookings for select using (true);
create policy "demo anon write bookings" on bookings for insert with check (true);
create policy "demo anon update bookings" on bookings for update using (true);

-- xero_tokens holds real OAuth secrets, unlike the demo tables above.
-- Deliberately NO policies at all — RLS is enabled with zero grants, so the
-- public anon key (which is embedded in the browser bundle) can do NOTHING
-- to this table. It's readable/writable only via the service role key
-- (SUPABASE_SERVICE_ROLE_KEY, server-side env var only), which bypasses RLS.
-- Never add an anon policy here — that would let anyone with the public
-- anon key read live OAuth tokens straight out of the REST API.

-- ============================================================================
-- Phase 1: Auth + Multi-Tenancy
-- Run this AFTER the tables above already exist, once Google sign-in is
-- configured in this project (Authentication -> Providers -> Google). Safe to
-- re-paste/re-run: every create uses IF NOT EXISTS / OR REPLACE, and every
-- policy is dropped before being recreated.
-- ============================================================================

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  vertical text not null default 'workshop',
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

alter table jobs add column if not exists org_id uuid references organizations(id);
alter table invoices add column if not exists org_id uuid references organizations(id);
alter table bookings add column if not exists org_id uuid references organizations(id);

-- Auto-provision: the first time a brand-new Google account signs in, give
-- them their own organization + an owner membership row. No manual setup
-- step, no invite flow needed — every distinct sign-in is its own tenant.
-- SECURITY DEFINER so it can write to organizations/memberships even though
-- the brand-new user doesn't have a membership row yet (chicken-and-egg).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name, vertical)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My Business'), 'workshop')
  returning id into new_org_id;

  insert into memberships (user_id, org_id, role)
  values (new.id, new_org_id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table organizations enable row level security;
alter table memberships enable row level security;

drop policy if exists "member read own org" on organizations;
create policy "member read own org" on organizations for select
  using (id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read own memberships" on memberships;
create policy "member read own memberships" on memberships for select
  using (user_id = auth.uid());

-- Replace the permissive "demo anon" policies above with real, membership-
-- scoped ones. A signed-in user can only see/write rows in an org they
-- belong to (checked via the memberships table on every query).
drop policy if exists "demo anon read jobs" on jobs;
drop policy if exists "demo anon write jobs" on jobs;
drop policy if exists "demo anon update jobs" on jobs;
drop policy if exists "member read jobs" on jobs;
drop policy if exists "member write jobs" on jobs;
drop policy if exists "member update jobs" on jobs;
create policy "member read jobs" on jobs for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write jobs" on jobs for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update jobs" on jobs for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "demo anon read invoices" on invoices;
drop policy if exists "demo anon write invoices" on invoices;
drop policy if exists "demo anon update invoices" on invoices;
drop policy if exists "member read invoices" on invoices;
drop policy if exists "member write invoices" on invoices;
drop policy if exists "member update invoices" on invoices;
create policy "member read invoices" on invoices for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write invoices" on invoices for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update invoices" on invoices for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "demo anon read bookings" on bookings;
drop policy if exists "demo anon write bookings" on bookings;
drop policy if exists "demo anon update bookings" on bookings;
drop policy if exists "member read bookings" on bookings;
drop policy if exists "member update bookings" on bookings;
drop policy if exists "member write bookings" on bookings;
create policy "member read bookings" on bookings for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update bookings" on bookings for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write bookings" on bookings for insert
  to authenticated
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));

-- The Customer Booking Portal (/book) is deliberately unauthenticated — a
-- customer submits a request with no login. This keeps one narrow anon
-- INSERT-only policy on bookings so the portal keeps working. It only
-- requires org_id to reference a real organization (the FK above already
-- enforces that); the portal itself only ever sends the one org id it's
-- configured with (VITE_DEFAULT_ORG_ID), and org ids are random UUIDs, not
-- guessable. A tighter per-tenant booking-link scheme (validating org_id
-- against a public slug/token) is follow-up work once there's a second real
-- tenant to design it against — tracked separately, not blocking this round.
drop policy if exists "portal anon insert bookings" on bookings;
create policy "portal anon insert bookings" on bookings for insert
  to anon
  with check (org_id is not null);

-- ============================================================================
-- Phase 2: Customers + Vehicles
-- Same org-scoped pattern as jobs/invoices/bookings above. job_history/history
-- stay as embedded jsonb for now (matching the sample-data shape the screens
-- already expect) rather than a real join against jobs — jobs.customer is
-- still a free-text name, not a customer_id FK, so proper linking is a
-- follow-up refactor, not blocking this round.
-- ============================================================================

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  vehicle text not null default '',
  last_visit text not null default '',
  status text not null default 'Regular',
  spend numeric not null default 0,
  job_history jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  model text not null default '',
  rego text not null default '',
  owner text not null default '',
  odo text not null default '',
  last_service text not null default '',
  next_due text not null default '',
  status text not null default 'Serviced',
  history jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table customers add column if not exists email text not null default '';

alter table customers enable row level security;
alter table vehicles enable row level security;

drop policy if exists "member read customers" on customers;
drop policy if exists "member write customers" on customers;
drop policy if exists "member update customers" on customers;
create policy "member read customers" on customers for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write customers" on customers for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update customers" on customers for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read vehicles" on vehicles;
drop policy if exists "member write vehicles" on vehicles;
drop policy if exists "member update vehicles" on vehicles;
create policy "member read vehicles" on vehicles for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write vehicles" on vehicles for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update vehicles" on vehicles for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

-- ============================================================================
-- Phase 3: Team + Suppliers
-- Same org-scoped pattern again. Team's jobs/revenue stats are computed
-- client-side from the real jobs table (matching on tech name) rather than
-- stored here — no reason to duplicate numbers that already live in jobs.
-- ============================================================================

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  role text not null default '',
  email text not null default '',
  status text not null default 'On shift',
  avg_time text not null default '',
  certs text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  suburb text not null default '',
  phone text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);

alter table team_members enable row level security;
alter table suppliers enable row level security;

drop policy if exists "member read team_members" on team_members;
drop policy if exists "member write team_members" on team_members;
drop policy if exists "member update team_members" on team_members;
create policy "member read team_members" on team_members for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write team_members" on team_members for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update team_members" on team_members for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read suppliers" on suppliers;
drop policy if exists "member write suppliers" on suppliers;
drop policy if exists "member update suppliers" on suppliers;
create policy "member read suppliers" on suppliers for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write suppliers" on suppliers for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update suppliers" on suppliers for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

-- ============================================================================
-- Phase 4: Reviews
-- Reviews themselves come from external platforms (Google/Facebook) in a
-- real system — pulling those in automatically is a future integration, not
-- this round. This table just persists the reply flow (currently local-only
-- state that resets on refresh) so a staff reply actually sticks.
-- ============================================================================

create table if not exists reviews (
  id text primary key,
  org_id uuid not null references organizations(id),
  name text not null default '',
  rating int not null default 5,
  platform text not null default '',
  review_date text not null default '',
  review_text text not null default '',
  replied boolean not null default false,
  sent_reply text not null default '',
  created_at timestamptz not null default now()
);

alter table reviews enable row level security;

drop policy if exists "member read reviews" on reviews;
drop policy if exists "member write reviews" on reviews;
drop policy if exists "member update reviews" on reviews;
create policy "member read reviews" on reviews for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write reviews" on reviews for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update reviews" on reviews for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

-- ============================================================================
-- Phase 5: HR
-- Four sub-features, four tables. Payroll's "Run payroll" toggle stays
-- local-only (not persisted) — there's no real pay-period/processing engine
-- behind it yet, same as Accounts/Reports leaving cost tracking illustrative
-- until that's built. hours/rate/leave accrual themselves are real and saved.
-- ============================================================================

create table if not exists hires (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  role text not null default '',
  start_date text not null default '',
  tasks jsonb not null default '[]',
  docs jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  leave_type text not null default '',
  dates text not null default '',
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists payroll_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  hours numeric not null default 0,
  rate numeric not null default 0,
  annual_leave_hours numeric not null default 0,
  sick_leave_hours numeric not null default 0,
  accrual_rate text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists disciplinary_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  severity text not null default 'Minor',
  note_date text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table hires enable row level security;
alter table leave_requests enable row level security;
alter table payroll_entries enable row level security;
alter table disciplinary_notes enable row level security;

drop policy if exists "member read hires" on hires;
drop policy if exists "member write hires" on hires;
drop policy if exists "member update hires" on hires;
create policy "member read hires" on hires for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write hires" on hires for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update hires" on hires for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read leave_requests" on leave_requests;
drop policy if exists "member write leave_requests" on leave_requests;
drop policy if exists "member update leave_requests" on leave_requests;
create policy "member read leave_requests" on leave_requests for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write leave_requests" on leave_requests for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update leave_requests" on leave_requests for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read payroll_entries" on payroll_entries;
drop policy if exists "member write payroll_entries" on payroll_entries;
drop policy if exists "member update payroll_entries" on payroll_entries;
create policy "member read payroll_entries" on payroll_entries for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write payroll_entries" on payroll_entries for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update payroll_entries" on payroll_entries for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read disciplinary_notes" on disciplinary_notes;
drop policy if exists "member write disciplinary_notes" on disciplinary_notes;
drop policy if exists "member update disciplinary_notes" on disciplinary_notes;
create policy "member read disciplinary_notes" on disciplinary_notes for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write disciplinary_notes" on disciplinary_notes for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update disciplinary_notes" on disciplinary_notes for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

-- ============================================================================
-- Phase 6: Loan Cars, Parts, Tyre Stock, Stock Take
-- Same org-scoped pattern. Stock Take's "Finalize count" stays a local-only
-- toggle (not persisted) — it's a session action, not data; the counts
-- themselves are real and saved.
-- ============================================================================

create table if not exists loan_cars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  car text not null default '',
  status text not null default 'Available',
  assigned_to text not null default '',
  out_since text not null default '',
  due_back text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  size text not null default '',
  stock int not null default 0,
  price numeric not null default 0,
  status text not null default 'In stock',
  created_at timestamptz not null default now()
);

create table if not exists tyre_stock (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  brand text not null default '',
  model text not null default '',
  size text not null default '',
  rating text not null default '',
  qty int not null default 0,
  cost numeric not null default 0,
  sell numeric not null default 0,
  reorder int not null default 4,
  created_at timestamptz not null default now()
);

create table if not exists stock_take_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null default '',
  system_qty int not null default 0,
  counted text not null default '',
  created_at timestamptz not null default now()
);

alter table loan_cars enable row level security;
alter table parts enable row level security;
alter table tyre_stock enable row level security;
alter table stock_take_items enable row level security;

drop policy if exists "member read loan_cars" on loan_cars;
drop policy if exists "member write loan_cars" on loan_cars;
drop policy if exists "member update loan_cars" on loan_cars;
create policy "member read loan_cars" on loan_cars for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write loan_cars" on loan_cars for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update loan_cars" on loan_cars for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read parts" on parts;
drop policy if exists "member write parts" on parts;
drop policy if exists "member update parts" on parts;
create policy "member read parts" on parts for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write parts" on parts for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update parts" on parts for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read tyre_stock" on tyre_stock;
drop policy if exists "member write tyre_stock" on tyre_stock;
drop policy if exists "member update tyre_stock" on tyre_stock;
create policy "member read tyre_stock" on tyre_stock for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write tyre_stock" on tyre_stock for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update tyre_stock" on tyre_stock for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

drop policy if exists "member read stock_take_items" on stock_take_items;
drop policy if exists "member write stock_take_items" on stock_take_items;
drop policy if exists "member update stock_take_items" on stock_take_items;
create policy "member read stock_take_items" on stock_take_items for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write stock_take_items" on stock_take_items for insert
  with check (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update stock_take_items" on stock_take_items for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));

-- ============================================================================
-- Phase 7: Mercedes (Hyper Agent)
-- Adds the one column her update_job tool needs that didn't exist yet —
-- everything else she reads/writes (jobs, invoices, customers, vehicles,
-- team_members, parts, tyre_stock) already exists from the phases above.
-- See supabase/functions/mercedesChat/.
-- ============================================================================

alter table jobs add column if not exists notes text not null default '';
-- Phase 7: Voice Agent Events (Grok Voice Agent / "London")
-- Raw log of realtime.call.incoming webhook payloads from api/grok/voice-webhook.js.
-- No org_id yet (single-tenant during this phase; add when multi-tenancy lands).
-- Same lockdown pattern as xero_tokens: RLS on, ZERO policies. Call events can
-- carry customer phone numbers and transcripts — only the service role key
-- (server-side only) can read/write this table. Never add an anon policy here.
-- ============================================================================

create table if not exists voice_agent_events (
  id uuid primary key default gen_random_uuid(),
  agent text not null default 'london',
  event_type text not null default 'unknown',
  call_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table voice_agent_events enable row level security;

-- ============================================================================
-- Phase 8: Historical vs live data
-- ============================================================================
-- The 2026-07-30 MechanicDesk migration brought in 1,830 invoices carrying
-- whatever state the old system had them in. Spot-checking showed 446 of them
-- (~$293k) sitting 90+ days unpaid, which for a shop where most retail
-- customers pay at pickup is far more likely to be invoices that were paid in
-- person and never closed off than genuinely uncollected debt.
--
-- Those records are still worth keeping — the job history is real work that
-- was really done. What isn't safe is letting their PAYMENT STATE drive live
-- financial figures: accounts receivable, GST, P&L. That would make the new
-- system report the old system's bookkeeping errors as fact, and staff would
-- correctly learn to distrust every number on the screen.
--
-- So: migrated rows are flagged, and live financial totals exclude them.
-- History stays browsable; the balance sheet starts clean from the cutover.
-- Clearing the backlog is a separate, human, at-your-own-pace job.

alter table invoices add column if not exists migrated boolean not null default false;
alter table invoices add column if not exists migrated_source text not null default '';

-- Backfill: everything that existed before this migration ran came from the
-- import. Safe to re-run; only ever marks rows created on or before the
-- cutover, never anything entered in Platform OS afterwards.
update invoices
   set migrated = true,
       migrated_source = 'mechanicdesk-2026-07-30'
 where migrated = false
   and created_at <= '2026-07-31T00:00:00Z';

-- ============================================================================
-- Phase 9: Mercedes conversation history
-- Chat threads were living only in React state — a page reload wiped the
-- HISTORY list back to empty. Persisted per user (not shared org-wide; a
-- staff member's chats with Mercedes are theirs), scoped by org for the same
-- defense-in-depth as everywhere else. `messages` stores the same shape the
-- UI already keeps in memory; attachment bytes are stripped before saving
-- (see stripFilesForStorage in Mercedes.jsx) so a handful of photos in a
-- thread don't turn into megabytes of jsonb.
-- ============================================================================

create table if not exists mercedes_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  created_by uuid not null references auth.users(id),
  title text not null default 'Untitled',
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table mercedes_conversations enable row level security;

drop policy if exists "member read own mercedes_conversations" on mercedes_conversations;
drop policy if exists "member write own mercedes_conversations" on mercedes_conversations;
drop policy if exists "member update own mercedes_conversations" on mercedes_conversations;
drop policy if exists "member delete own mercedes_conversations" on mercedes_conversations;
create policy "member read own mercedes_conversations" on mercedes_conversations for select
  using (created_by = auth.uid() and org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member write own mercedes_conversations" on mercedes_conversations for insert
  with check (created_by = auth.uid() and org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update own mercedes_conversations" on mercedes_conversations for update
  using (created_by = auth.uid());
create policy "member delete own mercedes_conversations" on mercedes_conversations for delete
  using (created_by = auth.uid());

create index if not exists invoices_migrated_idx on invoices (org_id, migrated);

-- ============================================================================
-- Phase 10: Mercedes' own memory
-- Ported from platform-os-ver-2.5's mercedes-memory.sql. There she runs
-- single-tenant so the table carries no org_id at all — every row is just
-- "the shop's memory." Slim is multi-tenant, so unlike that version every
-- row here is scoped to org_id and every read/write in tools.ts filters on
-- it, the same pattern as jobs/invoices/customers — one tenant's memory can
-- never leak into another's.
--
-- Same as voice_agent_events/xero_tokens: RLS on, zero policies. Only the
-- mercedesChat edge function touches this (service-role client, bypasses
-- RLS regardless), no anon-facing UI reads it directly.
-- ============================================================================

create table if not exists mercedes_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  category text,
  content text not null,
  created_date timestamptz not null default now()
);

create index if not exists mercedes_memory_org_idx on mercedes_memory (org_id, created_date desc);
create index if not exists mercedes_memory_category_idx on mercedes_memory (org_id, category);

alter table mercedes_memory enable row level security;
