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

alter table jobs enable row level security;
alter table invoices enable row level security;

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
