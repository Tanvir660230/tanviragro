-- ================================================================
-- Tanvir Agro ERP — Profiles & Business Details
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- ── 1. Create Profiles Table ───────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  title       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using (true);

create policy "Users can insert their own profile."
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile."
  on profiles for update
  using (auth.uid() = id);

-- ── Trigger to auto-create profile on signup ──────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. Add columns to businesses ──────────────────────────────────
alter table businesses add column if not exists logo_url text;
alter table businesses add column if not exists address text;
alter table businesses add column if not exists phone text;
alter table businesses add column if not exists email text;


-- ── 3. Create Storage Buckets ─────────────────────────────────────
-- Note: 'storage.buckets' and 'storage.objects' policies need to be executed carefully

insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- ── 4. Storage Policies ───────────────────────────────────────────
-- Avatars
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Anyone can upload an avatar."
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Anyone can update their avatar."
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Logos
create policy "Logo images are publicly accessible."
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Authenticated users can upload logos."
  on storage.objects for insert
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');

create policy "Authenticated users can update logos."
  on storage.objects for update
  using (bucket_id = 'logos' and auth.role() = 'authenticated');
