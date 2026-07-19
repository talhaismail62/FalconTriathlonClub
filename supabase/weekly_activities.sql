-- Weekly Activities feature
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Creates the dedicated table the Schedule tab reads/writes, separate from
-- `posts` (the home feed), and restricts editing to admins.

create table if not exists public.weekly_activities (
  id          uuid primary key default gen_random_uuid(),
  day         text not null,           -- 'Monday' … 'Sunday'
  title       text not null,
  description text not null,
  time        text,                    -- optional, e.g. '6:00 AM - 7:30 AM'
  created_at  timestamptz not null default now()
);

alter table public.weekly_activities enable row level security;

-- Anyone signed in can view the schedule.
drop policy if exists "weekly_activities_select" on public.weekly_activities;
create policy "weekly_activities_select"
  on public.weekly_activities
  for select
  to authenticated
  using (true);

-- Only admins (myusers.is_admin = true, matched by email) can add/edit/remove.
drop policy if exists "weekly_activities_admin_write" on public.weekly_activities;
create policy "weekly_activities_admin_write"
  on public.weekly_activities
  for all
  to authenticated
  using (
    exists (
      select 1 from public.myusers m
      where lower(m.email) = lower(auth.jwt() ->> 'email')
        and m.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.myusers m
      where lower(m.email) = lower(auth.jwt() ->> 'email')
        and m.is_admin = true
    )
  );
