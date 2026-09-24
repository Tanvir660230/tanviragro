-- ============================================================================
-- Feed quantity & cost reconciliation — READ ONLY (SELECT statements only).
-- Companion to docs/FEED_COSTING_AUDIT.md. Run in the Supabase SQL editor
-- (production) and save each result grid; nothing is modified.
-- Movement "source" is classified from inventory_transactions.notes, because the
-- schema has no source/reason column (finding F-10).
-- ============================================================================

-- Helper view of feed/roughage movements with a derived source (CTE reused below).
-- 1. RECIPES: batch size (output_qty) vs sum of ingredient quantities.  (F-01)
--    ratio > 1  => auto-deduction removes ratio x the real concentrate need.
select r.name, r.is_active,
       r.output_qty, r.output_unit,
       sum(ri.qty_per_batch)                               as ingredient_sum,
       round(sum(ri.qty_per_batch) / nullif(r.output_qty, 0), 4) as ratio_sum_to_output,
       count(ri.*)                                          as ingredient_count
from public.feed_recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id
group by r.id
order by r.is_active desc, r.name;

-- 2. PER ITEM × SOURCE: quantity, value, cost gaps.  (F-02, F-03, F-05, F-06, F-10)
with mv as (
  select t.*, i.name, i.unit, i.category,
    case
      when t.type = 'purchase' and t.notes ilike 'Mixed feed produced%' then 'IN  mixed-feed output'
      when t.type = 'purchase' and t.notes ilike 'True-Up%'             then 'IN  true-up (not a purchase)'
      when t.type = 'purchase' and t.notes ilike any (array['%adjust%','%count%','%correction%']) then 'IN  count adjustment'
      when t.type = 'purchase'                                          then 'IN  real purchase'
      when t.notes ilike 'Auto-Feed Deduction%'   then 'OUT auto-deduction (estimate)'
      when t.notes ilike 'Daily batch deduction%' then 'OUT daily button (estimate)'
      when t.notes ilike 'Feed mix%' or t.notes ilike 'Batch production%' then 'OUT mixing'
      when t.notes ilike 'Feed Session%'          then 'OUT feed session'
      when t.notes ilike 'Quick Dispense%'        then 'OUT quick dispense'
      when t.notes ilike '[FEED WASTE%'           then 'OUT waste'
      when t.notes ilike 'True-Up%'               then 'OUT true-up'
      when t.notes ilike 'Manual Cow-Level%'      then 'OUT manual per-cow'
      when t.notes ilike any (array['%adjust%','%count%','%correction%']) then 'OUT count adjustment'
      else 'OUT other/manual'
    end as source
  from public.inventory_transactions t
  join public.inventory_items i on i.id = t.item_id
  where i.category in ('feed','roughage')
)
select name, unit, category, source,
       count(*)                                       as rows,
       round(sum(qty)::numeric, 2)                    as qty,
       round(sum(qty * coalesce(unit_cost,0))::numeric, 0) as value_bdt,
       count(*) filter (where unit_cost is null)      as rows_null_cost,
       count(*) filter (where qty < 0)                as rows_negative_qty,
       count(*) filter (where cattle_id is not null)  as rows_linked_to_animal,
       min(recorded_at)::date as first_date, max(recorded_at)::date as last_date
from mv
group by name, unit, category, source
order by name, source;

-- 3. RECONCILIATION per feed item.  (Section "Feed Quantity Reconciliation")
--    expected_stock uses REAL purchases only; system_stock mirrors the app
--    (all IN rows - all OUT rows, clamped at 0 like StockLedgerEngine).
with mv as (
  select t.item_id, t.type, t.qty, t.unit_cost, t.notes
  from public.inventory_transactions t
  join public.inventory_items i on i.id = t.item_id
  where i.category in ('feed','roughage')
),
agg as (
  select item_id,
    sum(qty) filter (where type='purchase' and coalesce(notes,'') not ilike 'Mixed feed produced%'
                     and coalesce(notes,'') not ilike 'True-Up%'
                     and not coalesce(notes,'') ilike any (array['%adjust%','%count%','%correction%'])) as real_purchased,
    sum(qty) filter (where type='purchase') as all_in,
    sum(qty) filter (where type='consumption' and coalesce(notes,'') not ilike '[FEED WASTE%') as consumed,
    sum(qty) filter (where type='consumption' and coalesce(notes,'') ilike '[FEED WASTE%') as wasted,
    sum(qty*coalesce(unit_cost,0)) filter (where type='purchase' and coalesce(notes,'') not ilike 'Mixed feed produced%'
                     and coalesce(notes,'') not ilike 'True-Up%'
                     and not coalesce(notes,'') ilike any (array['%adjust%','%count%','%correction%'])) as real_purchase_cost,
    sum(qty*coalesce(unit_cost,0)) filter (where type='purchase') as purchase_value_counted_as_cash,
    sum(qty*coalesce(unit_cost,0)) filter (where type='consumption') as consumption_cost_recorded
  from mv group by item_id
)
select i.name, i.unit,
       round(coalesce(real_purchased,0)::numeric,2)                        as purchased,
       round(coalesce(consumed,0)::numeric,2)                              as consumed,
       round(coalesce(wasted,0)::numeric,2)                                as wastage,
       round((coalesce(real_purchased,0)-coalesce(consumed,0)-coalesce(wasted,0))::numeric,2) as expected_stock,
       round(greatest(coalesce(all_in,0)-coalesce(consumed,0)-coalesce(wasted,0),0)::numeric,2) as system_stock,
       round((coalesce(all_in,0)-coalesce(real_purchased,0))::numeric,2)   as phantom_in_qty,
       round(coalesce(real_purchase_cost,0)::numeric,0)                    as actual_purchase_cost,
       round(coalesce(purchase_value_counted_as_cash,0)::numeric,0)        as purchase_value_counted_as_cash,
       round(coalesce(consumption_cost_recorded,0)::numeric,0)             as consumption_cost_recorded,
       round((coalesce(real_purchase_cost,0)/nullif(real_purchased,0))::numeric,2) as avg_cost_per_unit
from agg join public.inventory_items i on i.id = agg.item_id
order by consumed desc nulls last;

-- 4. DUPLICATE-SOURCE DAYS: same item consumed by more than one estimate/actual source on one day. (F-02)
with c as (
  select t.item_id, t.recorded_at::date as d,
    case when t.notes ilike 'Auto-Feed Deduction%' then 'auto'
         when t.notes ilike 'Daily batch deduction%' then 'daily-button'
         when t.notes ilike 'Feed mix%' or t.notes ilike 'Batch production%' then 'mixing'
         when t.notes ilike 'Feed Session%' then 'session'
         when t.notes ilike 'Quick Dispense%' then 'quick-dispense'
         when t.notes ilike 'Manual Cow-Level%' then 'manual-cow'
         else 'other' end as src,
    t.qty
  from public.inventory_transactions t
  join public.inventory_items i on i.id = t.item_id
  where t.type = 'consumption' and i.category in ('feed','roughage')
)
select string_agg(distinct src, ' + ' order by src) as sources, count(*) as item_days,
       round(sum(qty)::numeric,2) as qty_on_those_days
from (select item_id, d, src, sum(qty) qty from c group by item_id, d, src) x
group by item_id, d
having count(distinct src) > 1;
-- (aggregate the output above by "sources" to see which combinations occur)

-- 5. AUTO-DEDUCTION vs RECIPE: concentrate need implied by the deducted ingredients. (F-01)
select r.name as recipe, r.output_qty, sum(ri.qty_per_batch) as ingredient_sum,
       t.recorded_at::date as day,
       round(sum(t.qty)::numeric, 2) as ingredients_deducted_kg,
       round((sum(t.qty) * r.output_qty / nullif(sum(ri.qty_per_batch),0))::numeric, 2) as implied_concentrate_need_kg
from public.inventory_transactions t
join public.recipe_ingredients ri on ri.item_id = t.item_id
join public.feed_recipes r on r.id = ri.recipe_id and r.is_active
where t.notes ilike 'Auto-Feed Deduction%'
group by r.id, t.recorded_at::date
order by day desc
limit 30;

-- 6. ACTIVE ANIMALS: inputs for independent ration checks (first 10). (Section "Cattle Consumption Validation")
select c.tag_id, c.initial_weight_kg, c.purchase_date, c.expected_daily_gain_kg,
       (current_date - c.purchase_date) as days_on_farm,
       lw.weight_kg as latest_weight, lw.recorded_at::date as latest_weight_date,
       (select count(*) from public.inventory_transactions t where t.cattle_id = c.id and t.type='consumption') as feed_rows_linked
from public.cattle c
left join lateral (
  select weight_kg, recorded_at from public.weight_logs w
  where w.cattle_id = c.id and w.deleted_at is null order by recorded_at desc limit 1
) lw on true
where c.status = 'active' and c.deleted_at is null
order by c.purchase_date
limit 10;

-- 7. DATA INTEGRITY
select 'consumption rows with NULL unit_cost (valued at 0)' as check_name, count(*) from public.inventory_transactions where type='consumption' and unit_cost is null
union all select 'rows with negative qty (ignored by app stock calc)', count(*) from public.inventory_transactions where qty < 0
union all select 'rows with qty = 0', count(*) from public.inventory_transactions where qty = 0
union all select 'purchase rows with NULL unit_cost', count(*) from public.inventory_transactions where type='purchase' and unit_cost is null
union all select 'transactions on deleted inventory items', count(*) from public.inventory_transactions t join public.inventory_items i on i.id=t.item_id where i.deleted_at is not null
union all select 'active recipes (should be <= 1)', count(*) from public.feed_recipes where is_active
union all select 'active roughage items (should be <= 1)', count(*) from public.inventory_items where is_active_roughage;
