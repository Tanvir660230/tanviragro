-- ============================================================================
-- Cash counts: the owner counts the cash in hand (and bank) and writes the figure down.
-- The Money page compares it with what the books say for that day, so money spent but not
-- entered (or received but not entered) shows up as a gap instead of a silent wrong balance.
-- Needs 20260924120000 (is_business_member). Rollback: supabase/rollback/20260927120000_cash_counts_down.sql
-- ============================================================================
begin;

create table if not exists public.cash_counts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  counted_on  date not null,
  amount      numeric(14,2) not null check (amount >= 0),
  -- what the books said for that day when the count was saved (for the record; the page recomputes)
  expected    numeric(14,2),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create index if not exists idx_cash_counts_business_day on public.cash_counts (business_id, counted_on desc) where deleted_at is null;

alter table public.cash_counts enable row level security;
drop policy if exists "tenant members" on public.cash_counts;
create policy "tenant members" on public.cash_counts for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

commit;
