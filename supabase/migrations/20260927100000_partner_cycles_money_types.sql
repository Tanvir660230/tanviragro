-- ============================================================================
-- Partner money types, expenses paid by a partner, and settlement cycles.
--
-- 1. partner_transaction_type gains:
--      advance    — a partner takes money whenever needed, against their future profit share
--                   (the labour partner has no salary or fixed day)
--      loan_in    — a partner lends money to the farm (repayable, no share of profit)
--      loan_repay — the farm pays that loan back
-- 2. partner_transactions.cost_entry_id — an expense a partner paid from their own pocket: the
--    expense and the partner's credit (capital or loan) are one record pair; editing or deleting
--    the expense keeps them together.
-- 3. partner_cycles — the owner closes a cycle on a date of their choice. The result of every animal
--    that left in the cycle is settled on its net and does not change afterwards (the books are
--    locked to that date). Animals still on the farm roll into the next cycle.
-- Needs 20260927090000. Rollback: supabase/rollback/20260927100000_partner_cycles_money_types_down.sql
-- ============================================================================
alter type public.partner_transaction_type add value if not exists 'advance';
alter type public.partner_transaction_type add value if not exists 'loan_in';
alter type public.partner_transaction_type add value if not exists 'loan_repay';

begin;

alter table public.partner_transactions
  add column if not exists cost_entry_id uuid references public.cost_entries(id) on delete set null;
create index if not exists idx_partner_transactions_cost_entry on public.partner_transactions (cost_entry_id) where cost_entry_id is not null;

create table if not exists public.partner_cycles (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  closed_on   date not null,
  note        text,
  -- what was shown when it was closed (partners' shares, net, animals) — for the record
  snapshot    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create unique index if not exists uq_partner_cycle_day on public.partner_cycles (business_id, closed_on) where deleted_at is null;

alter table public.partner_cycles enable row level security;
drop policy if exists "tenant members" on public.partner_cycles;
do $$
begin
  if to_regprocedure('public.is_business_member(uuid)') is not null then
    execute 'create policy "tenant members" on public.partner_cycles for all '
            'using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))';
  else
    execute 'create policy "tenant members" on public.partner_cycles for all '
            'using (business_id in (select b.id from public.businesses b where b.owner_id = auth.uid())) '
            'with check (business_id in (select b.id from public.businesses b where b.owner_id = auth.uid()))';
  end if;
end $$;

commit;
