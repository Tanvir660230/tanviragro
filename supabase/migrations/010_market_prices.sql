-- ================================================================
-- Tanvir Agro ERP — Market Price Log (replaces localStorage)
-- ================================================================

create table market_prices (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  date         date not null,
  price_per_kg numeric(10,2) not null check (price_per_kg > 0),
  notes        text,
  created_at   timestamptz not null default now(),
  unique (business_id, date)
);

alter table market_prices enable row level security;

create policy "owner_all" on market_prices
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

create index market_prices_business_date on market_prices (business_id, date desc);
