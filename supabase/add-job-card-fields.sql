-- Make the job card persist.
--
-- Most of the job card form was bound to React component state: rego,
-- odometer, VIN, colour, year, phone, email, address, date in, promised out,
-- service advisor, booking source, estimate, the entire safety inspection and
-- its notes, the wheel alignment, and the tech notes. Type any of it, navigate
-- away, and it was gone. Parts and labour reached the store but the store never
-- wrote them anywhere, so a browser refresh lost those too.
--
--   card       the whole form, autosaved on a 700ms debounce
--   rego       lifted out so the Jobs list can show it without opening the card
--   odometer   lifted out for the same reason, and because next-service
--              reminders will need to read it
--   notes      the tech notes, lifted out so they can be searched
--
-- Nullable, no defaults: the row mappers coalesce null, so existing jobs need
-- no backfill. Safe to run more than once.

alter table jobs add column if not exists card jsonb;
alter table jobs add column if not exists rego text;
alter table jobs add column if not exists odometer text;
alter table jobs add column if not exists notes text;
