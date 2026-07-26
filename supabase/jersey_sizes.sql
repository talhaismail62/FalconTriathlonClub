-- Jersey Sizes feature
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Stores each member's running/cycling jersey size + quantity, one row per
-- member (matched by email, same convention as weekly_activities policies).
-- Admins can view every row from the "View Jersey Sizes" block on the home screen.
--
-- Safe to re-run: uses if not exists / drop-and-recreate throughout, so running
-- this again on a table created by an earlier version of this script (before the
-- `name` column existed) will just add what's missing.

create table if not exists public.jersey_sizes (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  name              text,               -- snapshot of myusers.name at submit time, for the admin list
  running_size      text not null,      -- 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
  running_quantity  integer not null default 1,
  cycling_size      text not null,      -- 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
  cycling_quantity  integer not null default 1,
  updated_at        timestamptz not null default now(),

  constraint jersey_sizes_running_size_check
    check (running_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  constraint jersey_sizes_cycling_size_check
    check (cycling_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  constraint jersey_sizes_running_quantity_check check (running_quantity > 0),
  constraint jersey_sizes_cycling_quantity_check check (cycling_quantity > 0)
);

-- Adds `name` for installs created before this column existed.
alter table public.jersey_sizes
  add column if not exists name text;

alter table public.jersey_sizes enable row level security;

-- Members can view and manage only their own jersey size row.
drop policy if exists "jersey_sizes_select_own" on public.jersey_sizes;
create policy "jersey_sizes_select_own"
  on public.jersey_sizes
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "jersey_sizes_insert_own" on public.jersey_sizes;
create policy "jersey_sizes_insert_own"
  on public.jersey_sizes
  for insert
  to authenticated
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "jersey_sizes_update_own" on public.jersey_sizes;
create policy "jersey_sizes_update_own"
  on public.jersey_sizes
  for update
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- Admins (myusers.is_admin = true, matched by email) can view every row —
-- this is what the "View Jersey Sizes" block reads from.
drop policy if exists "jersey_sizes_admin_select" on public.jersey_sizes;
create policy "jersey_sizes_admin_select"
  on public.jersey_sizes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.myusers m
      where lower(m.email) = lower(auth.jwt() ->> 'email')
        and m.is_admin = true
    )
  );

-- Keep `updated_at` current on every edit, so the admin view can show
-- how fresh each member's submission is.
create or replace function public.jersey_sizes_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jersey_sizes_updated_at on public.jersey_sizes;
create trigger jersey_sizes_updated_at
  before update on public.jersey_sizes
  for each row
  execute function public.jersey_sizes_set_updated_at();
