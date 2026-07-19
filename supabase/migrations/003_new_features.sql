-- ================================================================
-- Tanvir Agro ERP — New Features Migration
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- ── New Enums ─────────────────────────────────────────────────────
create type photo_type               as enum ('purchase', 'current', 'other');
create type health_event_type        as enum ('vaccine', 'checkup', 'deworming', 'treatment', 'other');
create type vendor_type              as enum ('cattle', 'feed', 'medicine', 'other');
create type partner_transaction_type as enum ('investment', 'withdrawal', 'profit');

-- ── Alter existing tables ─────────────────────────────────────────
alter table cattle          add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table inventory_items add column if not exists vendor_id uuid references vendors(id) on delete set null;

-- ── Vendors ───────────────────────────────────────────────────────
create table vendors (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name        text not null,
  type        vendor_type not null default 'other',
  phone       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Cattle Photos (Supabase Storage paths) ────────────────────────
create table cattle_photos (
  id           uuid primary key default uuid_generate_v4(),
  cattle_id    uuid references cattle(id) on delete cascade,
  photo_type   photo_type not null default 'current',
  storage_path text not null,
  taken_at     date,
  created_at   timestamptz not null default now()
);

-- ── Health & Vaccine Calendar ─────────────────────────────────────
create table health_events (
  id           uuid primary key default uuid_generate_v4(),
  cattle_id    uuid references cattle(id) on delete cascade,
  business_id  uuid references businesses(id) on delete cascade,
  title        text not null,
  event_type   health_event_type not null default 'checkup',
  scheduled_at date not null,
  completed_at date,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ── Partners / Investors ──────────────────────────────────────────
create table partners (
  id                 uuid primary key default uuid_generate_v4(),
  business_id        uuid references businesses(id) on delete cascade,
  name               text not null,
  investment_amount  numeric(14,2) not null default 0,
  profit_share_pct   numeric(5,2) not null default 0 check (profit_share_pct between 0 and 100),
  joined_at          date not null default current_date,
  notes              text,
  created_at         timestamptz not null default now()
);

create table partner_transactions (
  id          uuid primary key default uuid_generate_v4(),
  partner_id  uuid references partners(id) on delete cascade,
  amount      numeric(14,2) not null,
  type        partner_transaction_type not null,
  recorded_at date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Web Push Subscriptions ────────────────────────────────────────
create table push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

-- ── Row Level Security ────────────────────────────────────────────
alter table vendors              enable row level security;
alter table cattle_photos        enable row level security;
alter table health_events        enable row level security;
alter table partners             enable row level security;
alter table partner_transactions enable row level security;
alter table push_subscriptions   enable row level security;

create policy "vendors in own business"
  on vendors for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "cattle_photos in own business"
  on cattle_photos for all using (
    cattle_id in (
      select c.id from cattle c
      join businesses b on c.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );

create policy "health_events in own business"
  on health_events for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "partners in own business"
  on partners for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "partner_transactions for own partners"
  on partner_transactions for all using (
    partner_id in (
      select p.id from partners p
      join businesses b on p.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );

create policy "own push subscriptions"
  on push_subscriptions for all using (user_id = auth.uid());

-- ── Supabase Storage Bucket ───────────────────────────────────────
-- Run separately in Storage section or via API:
-- insert into storage.buckets (id, name, public) values ('cattle-photos', 'cattle-photos', true);
--
-- Storage RLS policy (run after creating bucket):
-- create policy "users can upload own cattle photos"
--   on storage.objects for insert with check (
--     bucket_id = 'cattle-photos' and auth.uid() is not null
--   );
-- create policy "anyone can view cattle photos"
--   on storage.objects for select using (bucket_id = 'cattle-photos');
-- create policy "users can delete own cattle photos"
--   on storage.objects for delete using (
--     bucket_id = 'cattle-photos' and auth.uid() is not null
--   );
