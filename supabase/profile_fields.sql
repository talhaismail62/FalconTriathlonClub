-- Profile fields: occupation, city, and primary sport storage.
-- Run this in the Supabase SQL editor.
--
-- primary_sport is stored in the existing `sport_discipline` text column
-- as a single value (Cycling | Running | Swimming). No column rename needed.

alter table public.myusers
  add column if not exists occupation text;

alter table public.myusers
  add column if not exists city text;
