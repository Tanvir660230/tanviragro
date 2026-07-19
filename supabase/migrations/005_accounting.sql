-- ================================================================
-- Tanvir Agro ERP — Double-Entry Accounting & Fixed Assets
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- ── Fixed Assets Registry ────────────────────────────────────────
create table if not exists fixed_assets (
  id                   uuid primary key default uuid_generate_v4(),
  business_id          uuid not null references businesses(id) on delete cascade,
  name                 text not null,
  category             text not null default 'infrastructure'
                       check (category in ('infrastructure','equipment','vehicle','other')),
  description          text,
  purchase_date        date not null,
  purchase_cost        numeric(15,2) not null check (purchase_cost > 0),
  salvage_value        numeric(15,2) not null default 0 check (salvage_value >= 0),
  useful_life_years    numeric(5,1)  not null check (useful_life_years > 0),
  depreciation_method  text not null default 'straight_line'
                       check (depreciation_method in ('straight_line','declining_balance')),
  declining_rate       numeric(6,4),           -- e.g. 0.20 for 20%; NULL uses 1/useful_life
  is_active            boolean not null default true,
  disposed_at          date,
  disposal_value       numeric(15,2),
  notes                text,
  created_at           timestamptz not null default now()
);

create index if not exists idx_fixed_assets_business on fixed_assets (business_id);
alter table fixed_assets enable row level security;
create policy "owner access fixed_assets" on fixed_assets
  using (business_id in (select id from businesses where owner_id = auth.uid()))
  with check (business_id in (select id from businesses where owner_id = auth.uid()));

-- ── Journal Entries (for manual accounting entries) ──────────────
create table if not exists journal_entries (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  entry_date   date not null,
  reference    text,
  description  text not null,
  source_type  text not null default 'manual'
               check (source_type in ('manual','sale','purchase','cost','depreciation')),
  source_id    uuid,
  is_posted    boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_journal_entries_business on journal_entries (business_id, entry_date);
alter table journal_entries enable row level security;
create policy "owner access journal_entries" on journal_entries
  using (business_id in (select id from businesses where owner_id = auth.uid()))
  with check (business_id in (select id from businesses where owner_id = auth.uid()));

-- ── Journal Lines ─────────────────────────────────────────────────
create table if not exists journal_lines (
  id           uuid primary key default uuid_generate_v4(),
  entry_id     uuid not null references journal_entries(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  description  text,
  debit        numeric(15,2) not null default 0 check (debit >= 0),
  credit       numeric(15,2) not null default 0 check (credit >= 0),
  constraint chk_one_side check (
    (debit > 0 and credit = 0) or (debit = 0 and credit > 0)
  )
);

create index if not exists idx_journal_lines_entry on journal_lines (entry_id);
-- No RLS needed on lines; access via entry
