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

alter table jobs enable row level security;
alter table invoices enable row level security;
alter table bookings enable row level security;

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
