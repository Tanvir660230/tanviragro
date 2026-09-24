-- ============================================================================
-- Consumption that covers several days
-- A herd consumption row may state the first day it covers (covers_from). The feed
-- engine then spreads it from covers_from to recorded_at by the weight of the animals
-- present each day, like a usage period, instead of charging it all to one day.
-- Used by correction C13 (stock-finished catch-ups). Additive; nullable; no data change.
-- Rollback: supabase/rollback/20260925140000_consumption_covers_from_down.sql
-- ============================================================================
begin;

alter table public.inventory_transactions
  add column if not exists covers_from date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_tx_covers_from_chk') then
    alter table public.inventory_transactions
      add constraint inventory_tx_covers_from_chk
      check (covers_from is null or (movement_type = 'consumption' and cattle_id is null and covers_from <= recorded_at));
  end if;
end $$;

comment on column public.inventory_transactions.covers_from is
  'Herd consumption only: first day this row covers (it ends on recorded_at). NULL = one day.';

commit;
