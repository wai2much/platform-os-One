-- Puts the sign-up trigger back after copying the database into Sydney.
--
-- Supabase's schema dump leaves out the auth schema, so a trigger that lives
-- on auth.users doesn't come across with it. The function it calls,
-- public.handle_new_user(), does. This is the same trigger as
-- supabase/schema.sql: the first time a new Google account signs in, it gets
-- its own organization and an owner membership.
--
-- Safe to run more than once.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
