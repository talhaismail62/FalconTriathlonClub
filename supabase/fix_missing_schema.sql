-- Fix missing database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- 1. posts: add missing image_url column
-- 2. myusers: add missing auth_uid column
-- 3. weekly_activities: create the missing table (Schedule tab)

-- ---------------------------------------------------------------------------
-- 1. posts.image_url
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists image_url text;

-- ---------------------------------------------------------------------------
-- 2. myusers.auth_uid  (links a row to the auth.users account)
-- ---------------------------------------------------------------------------
alter table public.myusers
  add column if not exists auth_uid uuid references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. weekly_activities table
-- ---------------------------------------------------------------------------
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
