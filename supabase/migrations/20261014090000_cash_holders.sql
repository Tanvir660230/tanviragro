-- ============================================================================
-- Cash holders: who has the farm's money — a partner's hand, the bank, bKash, the cash box.
--
-- 1. cash_holders      — the people and places the farm's cash sits with. A person can be linked to a
--                        partner (their capital lands with them by default) and to a login (forms start
--                        on "me", and only they confirm money handed to them).
-- 2. cash_holder_tags  — which holder got (or paid) one row of the cash ledger
--                        (lib/accounting/cash-ledger.ts). The key is that row's id: a sale id, a cattle id
--                        (its purchase), a cost entry id, a partner entry id, an inventory row id,
--                        "due-<liability>", "duepay-<liability>-<date>-<amount>-<n>", "loan-<id>",
--                        "loanpay-<id>", "fa-<asset>", "fa-sale-<asset>", a treatment id, or "opening".
--                        amount null = the whole row (or what is left of it after the parts);
--                        amount set = that part of the row (a sale split between two people, the opening
--                        cash, each memo's share of a supplier's running due). A row with no tag is
--                        "not yet said whose".
-- 3. cash_handovers    — money passed from one holder to another. Handed to someone with a login by
--                        someone else, it waits ("pending") until the receiver confirms it.
--                        It moves no farm cash, so the books never read it.
-- 4. cash_counts.holder_id — a count of one holder's cash (null = the whole farm, as before).
-- 5. cash_holder_log   — every change of who-holds-what, with who did it (never edited).
--
-- The farm's cash figure is not changed by anything here: Σ holders + not-yet-said = cash on hand.
-- A holder and everything pointing at it belong to one business (composite foreign keys).
-- Needs 20260924120000 (is_business_member), 20260927120000 (cash_counts).
-- Rollback: supabase/rollback/20261014090000_cash_holders_down.sql
-- ============================================================================
begin;

create table if not exists public.cash_holders (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  kind        text not null default 'person' check (kind in ('person', 'bank', 'mobile', 'box')),
  partner_id  uuid references public.partners(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  sort_order  int not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (business_id, id)
);
create unique index if not exists uq_cash_holder_name on public.cash_holders (business_id, lower(btrim(name))) where archived_at is null;
create unique index if not exists uq_cash_holder_user on public.cash_holders (business_id, user_id) where archived_at is null and user_id is not null;

create table if not exists public.cash_holder_tags (
  id          bigint generated always as identity unique,   -- for paged reads (backup)
  business_id uuid not null references public.businesses(id) on delete cascade,
  row_key     text not null check (length(row_key) between 1 and 120),
  holder_id   uuid not null,
  amount      numeric(14,2) check (amount is null or amount > 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (business_id, row_key, holder_id),
  foreign key (business_id, holder_id) references public.cash_holders (business_id, id) on delete cascade
);
-- one holder at most takes "the rest" of a row
create unique index if not exists uq_cash_holder_tag_rest on public.cash_holder_tags (business_id, row_key) where amount is null;
create index if not exists idx_cash_holder_tags_holder on public.cash_holder_tags (holder_id);

create table if not exists public.cash_handovers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  handed_on    date not null,
  from_holder  uuid not null,
  to_holder    uuid not null,
  amount       numeric(14,2) not null check (amount > 0),
  note         text check (note is null or length(note) <= 300),
  status       text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected')),
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz,
  check (from_holder <> to_holder),
  foreign key (business_id, from_holder) references public.cash_holders (business_id, id),
  foreign key (business_id, to_holder)   references public.cash_holders (business_id, id)
);
create index if not exists idx_cash_handovers_business_day on public.cash_handovers (business_id, handed_on desc) where deleted_at is null;

alter table public.cash_counts add column if not exists holder_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_counts_holder_fk') then
    alter table public.cash_counts add constraint cash_counts_holder_fk
      foreign key (business_id, holder_id) references public.cash_holders (business_id, id);
  end if;
end $$;
create index if not exists idx_cash_counts_holder on public.cash_counts (holder_id, counted_on desc) where holder_id is not null and deleted_at is null;

create table if not exists public.cash_holder_log (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  at          timestamptz not null default now(),
  by_user     uuid default auth.uid(),
  action      text not null check (length(action) <= 40),
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists idx_cash_holder_log_business on public.cash_holder_log (business_id, at desc);

alter table public.cash_holders     enable row level security;
alter table public.cash_holder_tags enable row level security;
alter table public.cash_handovers   enable row level security;
alter table public.cash_holder_log  enable row level security;

drop policy if exists "tenant members" on public.cash_holders;
create policy "tenant members" on public.cash_holders for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists "tenant members" on public.cash_holder_tags;
create policy "tenant members" on public.cash_holder_tags for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists "tenant members" on public.cash_handovers;
create policy "tenant members" on public.cash_handovers for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
-- the log is written and read, never changed or removed
drop policy if exists "tenant members read" on public.cash_holder_log;
create policy "tenant members read" on public.cash_holder_log for select using (public.is_business_member(business_id));
drop policy if exists "tenant members write" on public.cash_holder_log;
create policy "tenant members write" on public.cash_holder_log for insert
  with check (public.is_business_member(business_id) and by_user = auth.uid());

commit;
