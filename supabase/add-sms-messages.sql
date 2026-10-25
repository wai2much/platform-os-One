-- Two-way SMS for the Comms screen (supplier: LinkedUp Communications).
--
-- NOT APPLIED. Needs Wai's approval before running on ysavtiiezxbqcnkkjnjo.
-- Safe to run more than once.
--
-- One row per SMS, in or out, scoped to an org like every other table
-- (see supabase/schema.sql). Threads are derived in the UI by grouping on
-- the customer's number (`contact`), so there is no separate threads table.
--   direction    'in' (customer -> us) or 'out' (us -> customer)
--   contact      the customer's phone number
--   our_number   the LinkedUp sending/receiving number
--   status       out: 'sent' | 'failed' | 'delivered'; in: 'received'
--   provider_id  LinkedUp's message id, once their API is known
--   raw_payload  untouched provider body (inbound shape is not yet documented)
--   resolved     staff "Mark resolved" flag, kept per message row so the
--                thread is resolved when its latest row is.
--
-- Inserts come from the server routes (api/sms/send.js, api/sms/inbound.js)
-- using the service role, which bypasses RLS. Members can read their own
-- org's rows and update them (read/resolved flags) but never insert from
-- the browser, so nothing can fake a "sent" message without the server.

create table if not exists sms_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  contact text not null,
  our_number text,
  body text not null default '',
  status text not null default 'received',
  provider_id text,
  error text,
  read boolean not null default false,
  resolved boolean not null default false,
  sent_by uuid references auth.users(id),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_org_contact_idx on sms_messages (org_id, contact, created_at);

alter table sms_messages enable row level security;

drop policy if exists "member read sms" on sms_messages;
drop policy if exists "member update sms" on sms_messages;
create policy "member read sms" on sms_messages for select
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
create policy "member update sms" on sms_messages for update
  using (org_id in (select org_id from memberships where user_id = auth.uid()));
