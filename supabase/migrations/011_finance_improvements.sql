-- ================================================================
-- Tanvir Agro ERP — Finance Improvements
-- Opening cash balance + Liability tracking
-- ================================================================

-- ── Opening cash balance on businesses ───────────────────────────
alter table businesses
  add column if not exists opening_cash_balance numeric(15,2) not null default 0;

-- ── Liabilities (loans, payables, credit) ────────────────────────
create table liabilities (
  id               uuid primary key default uuid_generate_v4(),
  business_id      uuid not null references businesses(id) on delete cascade,
  name             text not null,
  category         text not null default 'loan',  -- loan | payable | credit
  principal        numeric(15,2) not null check (principal > 0),
  outstanding      numeric(15,2) not null check (outstanding >= 0),
  recorded_at      date not null default current_date,
  due_date         date,
  lender           text,
  notes            text,
  settled_at       date,
  created_at       timestamptz not null default now()
);

alter table liabilities enable row level security;

create policy "owner_all" on liabilities
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  )
  with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create index liabilities_business on liabilities (business_id, recorded_at desc);
