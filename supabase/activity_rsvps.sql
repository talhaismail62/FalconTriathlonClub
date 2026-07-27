-- Activity RSVP feature
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Lets members mark Going / Not Going / Maybe on a weekly activity; visible
-- to everyone once expanded on the home page or Activities tab.
--
-- Safe to re-run: uses if not exists / drop-and-recreate throughout.

create table if not exists public.activity_rsvps (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.weekly_activities (id) on delete cascade,
  email        text not null,
  name         text,               -- snapshot of myusers.name at vote time
  status       text not null,      -- 'Going' | 'Not Going' | 'Maybe'
  updated_at   timestamptz not null default now(),

  constraint activity_rsvps_status_check check (status in ('Going', 'Not Going', 'Maybe')),
  constraint activity_rsvps_unique_member unique (activity_id, email)
);

alter table public.activity_rsvps enable row level security;

-- Anyone signed in can see every vote (that's the point — visible to everyone).
drop policy if exists "activity_rsvps_select_authenticated" on public.activity_rsvps;
create policy "activity_rsvps_select_authenticated"
  on public.activity_rsvps
  for select
  to authenticated
  using (true);

-- Members can only insert/update/delete their own vote.
drop policy if exists "activity_rsvps_insert_own" on public.activity_rsvps;
create policy "activity_rsvps_insert_own"
  on public.activity_rsvps
  for insert
  to authenticated
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "activity_rsvps_update_own" on public.activity_rsvps;
create policy "activity_rsvps_update_own"
  on public.activity_rsvps
  for update
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "activity_rsvps_delete_own" on public.activity_rsvps;
create policy "activity_rsvps_delete_own"
  on public.activity_rsvps
  for delete
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Keep `updated_at` current on every edit.
create or replace function public.activity_rsvps_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists activity_rsvps_updated_at on public.activity_rsvps;
create trigger activity_rsvps_updated_at
  before update on public.activity_rsvps
  for each row
  execute function public.activity_rsvps_set_updated_at();
