-- ============================================================================
-- Feed ledger reconciliation — AFTER migration 20260925100000 (movement_type aware).
-- READ-ONLY: SELECT statements only. Safe to run in the Supabase SQL Editor.
-- For the pre-migration schema use docs/sql/feed_reconciliation.sql.
-- Covers every business the caller can read (production has one business with feed data).
-- ============================================================================

-- 1. Per item: quantity and value by movement type, signed stock, cost-quality counters
select i.name, i.unit, i.category, i.kg_per_unit,
       t.movement_type,
       count(*)                                            as rows,
       round(sum(t.qty), 2)                                as qty,
       round(sum(t.qty * coalesce(t.unit_cost, 0)), 2)     as value_bdt,
       count(*) filter (where t.cost_source = 'missing')   as rows_cost_missing,
       count(*) filter (where t.cost_source = 'zero_unconfirmed') as rows_zero_unconfirmed,
       count(*) filter (where t.is_estimate)               as rows_estimated
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where i.category in ('feed', 'roughage')
group by i.name, i.unit, i.category, i.kg_per_unit, t.movement_type
order by i.name, t.movement_type;

-- 2. Signed stock and value per item (never clamped) — from the balance view
select name, unit, kg_per_unit, round(qty_on_hand, 2) as qty_on_hand, round(value_on_hand, 2) as value_on_hand,
       rows_missing_cost, rows_zero_unconfirmed, rows_estimated,
       case when qty_on_hand < -0.0001 then 'NEGATIVE — stock-in missing' else '' end as flag
from public.v_inventory_balance
where category in ('feed', 'roughage')
order by name;

-- 3. Totals by accounting meaning (one path per movement)
select
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'purchase'), 2)                              as cash_purchases,
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'opening_balance'), 2)                       as opening_balance,
  round(sum(qty) filter (where movement_type = 'own_production'), 2)                                          as own_production_qty,
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'feed_mix_output'), 2)                       as mix_output,
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'feed_mix_input'), 2)                        as mix_input,
  -- consumption net of audited reversals (consumption_reversal undoes a consumption row)
  round(coalesce(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'consumption' and cattle_id is null), 0)
      - coalesce(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'consumption_reversal' and cattle_id is null), 0), 2) as herd_feed_consumed,
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type = 'consumption' and cattle_id is not null), 2) as animal_feed_consumed,
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type in ('wastage','adjustment_out')), 2)           as losses_and_count_out,
  round(sum(qty * coalesce(unit_cost,0)) filter (where movement_type in ('adjustment_in','return')), 2)             as count_in,
  round(sum(case when type = 'purchase' then qty * coalesce(unit_cost,0) else -qty * coalesce(unit_cost,0) end), 2) as inventory_value_signed
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where i.category in ('feed', 'roughage');

-- 4. Days where the old engine deducted an item twice, and what remains after the C1 reversal
select i.name, t.recorded_at::date as day,
       count(*) filter (where t.is_estimate) as formula_rows,
       count(*) filter (where t.idempotency_key like 'correction:C1:reversal:%') as reversals,
       round(sum(case when t.type = 'purchase' then -t.qty else t.qty end), 3) as net_qty
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where t.is_estimate or t.idempotency_key like 'correction:C1:%'
group by i.name, t.recorded_at::date
having count(*) filter (where t.is_estimate) > 1
order by day, i.name;

-- 5. Days with NO recorded feed consumption since the first movement (shown as NOT RECORDED)
with span as (
  select min(recorded_at)::date as d0, max(recorded_at)::date as d1
  from public.inventory_transactions where movement_type = 'consumption'
),
fed as (   -- a day counts as recorded only if its consumption is not fully reversed
  select t.recorded_at::date as d from public.inventory_transactions t
  join public.inventory_items i on i.id = t.item_id
  where t.movement_type in ('consumption', 'consumption_reversal') and i.category in ('feed', 'roughage')
  group by 1
  having sum(case when t.movement_type = 'consumption' then t.qty else -t.qty end) > 0.0001
)
select g::date as day_not_recorded
from span, generate_series(span.d0, span.d1, interval '1 day') g
where g::date not in (select d from fed)
order by 1;

-- 6. Zero-price and missing-price stock-in waiting for the owner's decision
select i.name, t.recorded_at::date, t.movement_type, t.qty, t.unit_cost, t.cost_source, left(coalesce(t.notes,''), 60) as notes
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where t.type = 'purchase' and t.cost_source in ('zero_unconfirmed', 'missing')
order by t.recorded_at;

-- 7. Integrity: every check below must return 0
select
  (select count(*) from public.inventory_transactions where movement_type is null)                                   as rows_without_meaning,
  (select count(*) from public.inventory_transactions where qty <= 0)                                                 as non_positive_qty,
  (select count(*) from public.inventory_transactions where (type = 'purchase') <>
      (movement_type in ('purchase','opening_balance','own_production','feed_mix_output','adjustment_in','return','consumption_reversal'))) as direction_mismatch,
  (select count(*) from (select idempotency_key from public.inventory_transactions where idempotency_key is not null
                         group by 1 having count(*) > 1) d)                                                          as duplicate_keys,
  (select count(*) from public.feed_recipes r where r.is_active and abs(r.output_qty -
      (select coalesce(sum(qty_per_batch),0) from public.recipe_ingredients x where x.recipe_id = r.id)) > 0.01)       as unbalanced_active_recipes;

-- 8. Audit trail summary
select correction_batch, action, field, count(*) as rows
from public.inventory_ledger_audit
group by 1, 2, 3
order by 1, 2, 3;
