-- Platform OS (Slim) — give every org its own business profile + bank details
-- Fixes a real bug: these fields used to be hardcoded in Settings.jsx, so
-- EVERY org (including new demo signups) displayed Wai's real business name,
-- address, phone, email, and real bank BSB/account number. Run this once in
-- the Slim Supabase project's SQL Editor (ref ysavtiiezxbqcnkkjnjo).
-- Safe to re-run: every ALTER uses IF NOT EXISTS, the policy is dropped
-- before being recreated, and the backfill only ever targets one org (the
-- one with the most customers — i.e. your real business, not a demo org).

alter table organizations add column if not exists business_name text not null default '';
alter table organizations add column if not exists trading_as text not null default '';
alter table organizations add column if not exists address text not null default '';
alter table organizations add column if not exists phone text not null default '';
alter table organizations add column if not exists email text not null default '';
alter table organizations add column if not exists bank_name text not null default '';
alter table organizations add column if not exists bank_bsb text not null default '';
alter table organizations add column if not exists bank_account text not null default '';

-- Previously only a read policy existed on organizations — members could
-- never actually save changes to their own org's profile fields.
drop policy if exists "member update own org" on organizations;
create policy "member update own org" on organizations for update
  using (id in (select org_id from memberships where user_id = auth.uid()));

-- Backfill: give your real business its real profile back (the org with by
-- far the most customers is unambiguously the real one, not a demo). Every
-- other org — including the Dion demo — stays blank, which the app now
-- handles gracefully instead of showing your details.
update organizations
   set business_name = 'Haus Of Technik Pty. Ltd.',
       trading_as = 'TyrePlus Thomastown',
       address = '218 Mahoneys Rd, Thomastown VIC',
       phone = '03 9462 4400',
       email = 'info@hausoftechnik.com.au',
       bank_name = 'Zeller Australia',
       bank_bsb = '803-439',
       bank_account = '242373674'
 where id = (
   select org_id from customers group by org_id order by count(*) desc limit 1
 );
