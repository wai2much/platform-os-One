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
