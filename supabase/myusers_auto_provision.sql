-- Auto-provision a public.myusers row for every new auth account.
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Why a trigger instead of client code:
--   The email/password path creates the myusers row by hand in signup.tsx, but
--   the Google OAuth path never did, so Google sign-ups ended up with an
--   auth.users record and no myusers row (broken profile, admin checks, RSVPs).
--   A trigger on auth.users fires for EVERY sign-up method and cannot be skipped
--   by a client that closes the OAuth browser early, so it fixes Google sign-up
--   and makes the manual client insert redundant (but harmless — see below).

-- ---------------------------------------------------------------------------
-- PRE-FLIGHT (optional): run these two SELECTs on their own FIRST to see what
-- the backfill will do. Neither changes any data.
--
--   -- How many auth users are missing a myusers row (these get created):
--   select count(*) from auth.users u
--    where u.email is not null
--      and not exists (select 1 from public.myusers m
--                       where lower(m.email) = lower(u.email));
--
--   -- Duplicate emails in auth.users. If this returns ANY rows, STOP and read
--   -- the note at the bottom before running the backfill — the dedupe assumes
--   -- one auth account per email.
--   select lower(email) as email, count(*)
--     from auth.users where email is not null
--    group by lower(email) having count(*) > 1;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Function: copy the essentials from the new auth user into myusers.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer            -- runs as the function owner so it can write myusers
set search_path = public    -- avoid search_path hijacking in a SECURITY DEFINER fn
as $$
declare
  -- Google returns the display name under one of these metadata keys; email/
  -- password sign-up passes it as full_name (see options.data in signup.tsx).
  display_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  );
  normalized_email text := lower(new.email);
begin
  -- A row may already exist for this email: created up-front by an admin, or by
  -- the manual insert in signup.tsx that races this trigger. In that case just
  -- backfill auth_uid (and the name if we have one and it's currently blank)
  -- rather than inserting a duplicate.
  update public.myusers
     set auth_uid = new.id,
         name = case
                  when coalesce(name, '') = '' and display_name <> '' then display_name
                  else name
                end
   where lower(email) = normalized_email;

  if not found then
    insert into public.myusers (auth_uid, email, name)
    values (new.id, normalized_email, display_name);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: fire once per newly created auth user.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- One-time backfill for accounts that were created BEFORE this trigger existed.
--
-- Two cases, both handled:
--   A) An auth user whose email already has a myusers row, but auth_uid is
--      unset (e.g. an email sign-up where the client insert never linked it):
--      link it.
--   B) An auth user with no myusers row at all (the Google users, and any email
--      sign-ups whose client-side insert failed): create one.
--
-- Safe to re-run: A) only touches rows missing auth_uid, B) only inserts where
-- no row exists for that email. Idempotent either way.
-- ---------------------------------------------------------------------------

-- A) Link existing myusers rows to their auth account by email.
update public.myusers m
   set auth_uid = u.id
  from auth.users u
 where lower(m.email) = lower(u.email)
   and m.auth_uid is null;

-- B) Insert a myusers row for auth users that still have none.
insert into public.myusers (auth_uid, email, name)
select
  u.id,
  lower(u.email),
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    ''
  )
from auth.users u
where u.email is not null
  and not exists (
    select 1 from public.myusers m
    where lower(m.email) = lower(u.email)
  );
