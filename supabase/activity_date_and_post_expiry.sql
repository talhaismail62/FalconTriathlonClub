-- One-time calendar date for activities + announcement expiry.
-- Run in Supabase SQL editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- 1. weekly_activities.activity_at  (exact date+time of the session)
-- ---------------------------------------------------------------------------
alter table public.weekly_activities
  add column if not exists activity_at timestamptz;

create index if not exists weekly_activities_activity_at_idx
  on public.weekly_activities (activity_at);

-- ---------------------------------------------------------------------------
-- 2. posts.expires_at  (announcements disappear after this timestamp)
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists expires_at timestamptz;

-- Existing announcements: keep visible for 7 days from created_at.
update public.posts
set expires_at = coalesce(created_at, now()) + interval '7 days'
where expires_at is null
  and coalesce(is_weekly_activity, false) = false;

create index if not exists posts_expires_at_idx
  on public.posts (expires_at);
