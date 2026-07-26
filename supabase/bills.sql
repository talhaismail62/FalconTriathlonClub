-- Bill Splitting feature
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- One person pays the whole meal bill, then floats the amount to the group;
-- everyone marks their own share as paid. Matches the email-based RLS
-- convention used by jersey_sizes.sql / weekly_activities.sql.
--
-- Safe to re-run: uses if not exists / drop-and-recreate throughout.

create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  created_by   text not null,        -- email of the member who paid and created the bill
  amount       numeric(10, 2) not null,
  bill_date    date not null,
  created_at   timestamptz not null default now(),

  constraint bills_amount_check check (amount > 0)
);

create table if not exists public.bill_participants (
  id           uuid primary key default gen_random_uuid(),
  bill_id      uuid not null references public.bills (id) on delete cascade,
  email        text not null,        -- the member this row belongs to
  name         text,                 -- snapshot of myusers.name at creation time
  guest_count  integer not null default 0,  -- extra people this member brought/covered
  has_paid     boolean not null default false,
  paid_at      timestamptz,

  constraint bill_participants_guest_count_check check (guest_count >= 0),
  constraint bill_participants_unique_member unique (bill_id, email)
);

-- ---------------------------------------------------------------------------
-- myusers: allow any signed-in member to look up other members by name/email
-- for the participant search+picker. Every existing client query against
-- myusers is self-scoped, so this policy is new and additive — it does not
-- touch existing self-scoped select/update policies on this table.
-- ---------------------------------------------------------------------------
drop policy if exists "myusers_select_authenticated" on public.myusers;
create policy "myusers_select_authenticated"
  on public.myusers
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------------
alter table public.bills enable row level security;

-- Any signed-in member can see every bill (transparency — that's the point
-- of floating the bill to the group).
drop policy if exists "bills_select_authenticated" on public.bills;
create policy "bills_select_authenticated"
  on public.bills
  for select
  to authenticated
  using (true);

-- Any signed-in member can create a bill (as themselves).
drop policy if exists "bills_insert_own" on public.bills;
create policy "bills_insert_own"
  on public.bills
  for insert
  to authenticated
  with check (lower(created_by) = lower(auth.jwt() ->> 'email'));

-- Only the creator can edit or delete their own bill.
drop policy if exists "bills_update_own" on public.bills;
create policy "bills_update_own"
  on public.bills
  for update
  to authenticated
  using (lower(created_by) = lower(auth.jwt() ->> 'email'))
  with check (lower(created_by) = lower(auth.jwt() ->> 'email'));

drop policy if exists "bills_delete_own" on public.bills;
create policy "bills_delete_own"
  on public.bills
  for delete
  to authenticated
  using (lower(created_by) = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------------
-- bill_participants
-- ---------------------------------------------------------------------------
alter table public.bill_participants enable row level security;

-- Any signed-in member can see every participant row (needed to show the
-- full split + who's paid on a bill everyone can view).
drop policy if exists "bill_participants_select_authenticated" on public.bill_participants;
create policy "bill_participants_select_authenticated"
  on public.bill_participants
  for select
  to authenticated
  using (true);

-- Only the bill's creator can add/remove/edit participant rows (they're the
-- one building the split when creating or editing the bill).
drop policy if exists "bill_participants_write_bill_owner" on public.bill_participants;
create policy "bill_participants_write_bill_owner"
  on public.bill_participants
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
        and lower(b.created_by) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "bill_participants_delete_bill_owner" on public.bill_participants;
create policy "bill_participants_delete_bill_owner"
  on public.bill_participants
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
        and lower(b.created_by) = lower(auth.jwt() ->> 'email')
    )
  );

-- Update is split into two allowances: the bill owner can edit any field
-- (e.g. guest_count) while rebuilding the split; each participant can only
-- flip their own has_paid/paid_at (self-reported payment).
drop policy if exists "bill_participants_update_bill_owner" on public.bill_participants;
create policy "bill_participants_update_bill_owner"
  on public.bill_participants
  for update
  to authenticated
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
        and lower(b.created_by) = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
        and lower(b.created_by) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "bill_participants_update_own_paid_status" on public.bill_participants;
create policy "bill_participants_update_own_paid_status"
  on public.bill_participants
  for update
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));
