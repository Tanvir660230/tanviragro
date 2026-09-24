-- ============================================================================
-- Correction C13 — "stock finished" was feed eaten, not a loss
-- Owner (2026-09-24): every time an item was marked finished, the cattle had eaten it.
-- The old app booked the remainder as adjustment_out ("True-Up: Physical stock
-- finished") = General Expenses (loss). For each such row this batch adds:
--   1. adjustment_in, same qty and cost, pointing at it (reverses_id) → cancels the loss;
--   2. herd consumption, same qty and cost (declared: cost_source 'manual'), covering the
--      days since the item's previous count (covers_from) → feed expense, spread over
--      those days by the weight of the animals present.
-- Stock quantity and stock value do not change. Nothing is edited or deleted.
-- Requires migration 20260925140000. Idempotent. Rollback:
-- supabase/rollback/20260925_c13_trueup_is_feed_down.sql
-- ============================================================================
begin;

create temp table c13 on commit drop as
select t.id, t.item_id, t.qty, t.unit_cost, t.recorded_at,
       coalesce(
         (select max(p.recorded_at) + 1 from public.inventory_transactions p
          where p.item_id = t.item_id and p.movement_type = 'adjustment_out' and p.notes ilike 'True-Up%'
            and p.recorded_at < t.recorded_at),
         (select min(x.recorded_at) from public.inventory_transactions x where x.item_id = t.item_id)
       ) as covers_from
from public.inventory_transactions t
where t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%' and t.unit_cost is not null;

-- 1. cancel the loss
with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select c.item_id, 'purchase', 'adjustment_in', c.qty, c.unit_cost, 'correction', c.recorded_at,
         'Correction C13: stock finished = eaten, not a loss (cancels ' || c.id || ')',
         'correction:C13:cancel-loss:' || c.id, c.id
  from c13 c
  where not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'correction:C13:cancel-loss:' || c.id)
  returning id, reverses_id, qty, unit_cost
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260925-c13-trueup-is-feed', 'movement_type', 'adjustment_out', 'adjustment_in',
       'Owner 2026-09-24: marked finished = the cattle ate it; the loss is cancelled',
       'cancels ' || reverses_id || '; ' || qty || ' @ ' || unit_cost
from ins;

-- 2. the same quantity and value as feed eaten over the days it covers
with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, covers_from, notes, idempotency_key)
  select c.item_id, 'consumption', 'consumption', c.qty, c.unit_cost, 'manual', c.recorded_at, c.covers_from,
         'Correction C13: feed eaten ' || c.covers_from || ' .. ' || c.recorded_at || ' (recorded as stock finished ' || c.id || ')',
         'correction:C13:feed:' || c.id
  from c13 c
  where not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'correction:C13:feed:' || c.id)
  returning id, qty, unit_cost, covers_from, recorded_at
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260925-c13-trueup-is-feed', 'movement_type', null, 'consumption',
       'Owner 2026-09-24: marked finished = the cattle ate it; booked as feed',
       'covers ' || covers_from || ' .. ' || recorded_at || '; ' || qty || ' @ ' || unit_cost
from ins;

commit;

-- check (read-only): losses from stock-finished rows are now 0; stock value unchanged
select
  (select round(sum(t.qty * t.unit_cost), 2) from public.inventory_transactions t
   where t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%')                         as trueup_loss_booked,
  (select round(sum(t.qty * t.unit_cost), 2) from public.inventory_transactions t
   where t.idempotency_key like 'correction:C13:cancel-loss:%')                                    as loss_cancelled,
  (select round(sum(t.qty * t.unit_cost), 2) from public.inventory_transactions t
   where t.idempotency_key like 'correction:C13:feed:%')                                           as moved_to_feed,
  (select round(sum(value_on_hand), 2) from public.v_inventory_balance)                             as stock_value;
