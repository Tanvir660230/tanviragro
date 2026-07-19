-- ================================================================
-- Tanvir Agro ERP — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ================================================================

-- ── Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ─────────────────────────────────────────────────────────
create type business_type as enum ('cattle', 'poultry', 'fish', 'crop', 'other');
create type user_role     as enum ('owner', 'manager', 'worker');
create type cattle_status as enum ('active', 'sold', 'dead');
create type cattle_gender as enum ('male', 'female');
create type inventory_category as enum ('feed', 'medicine', 'equipment', 'other');
create type transaction_type   as enum ('purchase', 'consumption');
create type cost_type          as enum ('fixed', 'variable');

-- ── Core: Businesses ──────────────────────────────────────────────
create table businesses (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  type       business_type not null default 'cattle',
  owner_id   uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Cattle Fattening ──────────────────────────────────────────────
create table cattle (
  id                uuid primary key default uuid_generate_v4(),
  business_id       uuid references businesses(id) on delete cascade,
  tag_id            text not null,
  breed             text,
  gender            cattle_gender not null,
  dob               date,
  purchase_date     date not null,
  purchase_price    numeric(12,2) not null,
  initial_weight_kg numeric(8,2) not null,
  status            cattle_status not null default 'active',
  notes             text,
  created_at        timestamptz not null default now(),
  unique(business_id, tag_id)
);

create table weight_logs (
  id          uuid primary key default uuid_generate_v4(),
  cattle_id   uuid references cattle(id) on delete cascade,
  recorded_at date not null,
  weight_kg   numeric(8,2) not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Inventory & Feed ──────────────────────────────────────────────
create table inventory_items (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid references businesses(id) on delete cascade,
  name                text not null,
  unit                text not null default 'kg',
  category            inventory_category not null,
  low_stock_threshold numeric(10,2),
  created_at          timestamptz not null default now()
);

create table inventory_transactions (
  id          uuid primary key default uuid_generate_v4(),
  item_id     uuid references inventory_items(id) on delete cascade,
  type        transaction_type not null,
  qty         numeric(10,2) not null,
  unit_cost   numeric(12,2),
  cattle_id   uuid references cattle(id) on delete set null,
  recorded_at date not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Finance ───────────────────────────────────────────────────────
create table cost_entries (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  type        cost_type not null,
  category    text not null,
  amount      numeric(14,2) not null,
  recorded_at date not null,
  description text,
  created_at  timestamptz not null default now()
);

create table sales (
  id               uuid primary key default uuid_generate_v4(),
  cattle_id        uuid references cattle(id) on delete restrict,
  sold_at          date not null,
  sale_price_total numeric(14,2) not null,
  buyer_name       text,
  weight_at_sale_kg numeric(8,2),
  notes            text,
  created_at       timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────
alter table businesses          enable row level security;
alter table cattle              enable row level security;
alter table weight_logs         enable row level security;
alter table inventory_items     enable row level security;
alter table inventory_transactions enable row level security;
alter table cost_entries        enable row level security;
alter table sales               enable row level security;

-- Policies: owner sees only their own business data
create policy "owner can manage own business"
  on businesses for all using (owner_id = auth.uid());

create policy "cattle in own business"
  on cattle for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "weight_logs in own business"
  on weight_logs for all using (
    cattle_id in (
      select c.id from cattle c
      join businesses b on c.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );

create policy "inventory_items in own business"
  on inventory_items for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "inventory_transactions in own business"
  on inventory_transactions for all using (
    item_id in (
      select i.id from inventory_items i
      join businesses b on i.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );

create policy "cost_entries in own business"
  on cost_entries for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "sales in own business"
  on sales for all using (
    cattle_id in (
      select c.id from cattle c
      join businesses b on c.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );
