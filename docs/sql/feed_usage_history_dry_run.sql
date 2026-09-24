-- ============================================================================
-- DRY RUN (read-only): how the existing history would look as feed usage periods.
-- Each "True-Up: Physical stock finished" row is a real observation that the item
-- ran out on that date = the END of a usage period with closing count 0.
-- Nothing is changed. Run after migrations 20260925100000…130000 and the corrections.
-- ============================================================================
with recursive ev as (   -- period boundaries: every true-up (stock counted to zero) per item
  select t.item_id, t.recorded_at::date as end_date
  from public.inventory_transactions t
  where t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%'
),
seg as (
  select e.item_id, e.end_date,
         coalesce(lag(e.end_date) over (partition by e.item_id order by e.end_date) + 1,
                  (select min(recorded_at)::date from public.inventory_transactions x where x.item_id = e.item_id)) as start_date
  from ev e
),
cur as (       -- CURRENT interpretation inside each segment
  select s.item_id, s.start_date, s.end_date,
    sum(case when t.movement_type = 'consumption' then t.qty when t.movement_type = 'consumption_reversal' then -t.qty else 0 end) as consumption_qty,
    sum(case when t.movement_type = 'consumption' then t.qty * coalesce(t.unit_cost, 0)
             when t.movement_type = 'consumption_reversal' then -t.qty * coalesce(t.unit_cost, 0) else 0 end) as consumption_value,
    sum(case when t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%' then t.qty else 0 end) as trueup_qty,
    sum(case when t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%' then t.qty * coalesce(t.unit_cost, 0) else 0 end) as trueup_value,
    count(*) filter (where t.movement_type in ('consumption', 'consumption_reversal') or (t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%')) as affected_rows,
    -- stock-in during the period (a consumption undo is not stock-in; a purchase undo takes stock-in back)
    sum(case when t.type = 'purchase' and t.movement_type <> 'consumption_reversal' then t.qty * coalesce(t.unit_cost, 0)
             when t.movement_type = 'purchase_reversal' then -t.qty * coalesce(t.unit_cost, 0) else 0 end) as in_value,
    sum(case when t.type = 'purchase' and t.movement_type <> 'consumption_reversal' then t.qty
             when t.movement_type = 'purchase_reversal' then -t.qty else 0 end) as in_qty
  from seg s
  join public.inventory_transactions t on t.item_id = s.item_id and t.recorded_at::date between s.start_date and s.end_date
  group by s.item_id, s.start_date, s.end_date
),
ord as (select c.*, row_number() over (partition by c.item_id order by c.start_date) as n from cur c),
-- PROPOSED interpretation, period by period in date order. Each period's cost is
--   used quantity × (value carried in + stock-in value) / (quantity carried in + stock-in quantity)
-- and what is left is carried into the next period at that SAME average — never at the old
-- row-level (FIFO) costs, otherwise the same stock would be charged twice.
prop as (
  select o.item_id, o.n, o.start_date, o.end_date, o.affected_rows, o.consumption_qty, o.consumption_value, o.trueup_qty, o.trueup_value,
         o.in_qty, o.in_value,
         0::numeric as open_qty, 0::numeric as open_value,
         round((o.consumption_qty + o.trueup_qty) * o.in_value / nullif(o.in_qty, 0), 2) as proposed
  from ord o where o.n = 1
  union all
  select o.item_id, o.n, o.start_date, o.end_date, o.affected_rows, o.consumption_qty, o.consumption_value, o.trueup_qty, o.trueup_value,
         o.in_qty, o.in_value,
         p.open_qty + p.in_qty - p.consumption_qty - p.trueup_qty,
         p.open_value + p.in_value - p.proposed,
         round((o.consumption_qty + o.trueup_qty)
               * (p.open_value + p.in_value - p.proposed + o.in_value)
               / nullif(p.open_qty + p.in_qty - p.consumption_qty - p.trueup_qty + o.in_qty, 0), 2)
  from prop p join ord o on o.item_id = p.item_id and o.n = p.n + 1
)
select i.name as item, i.unit, c.start_date, c.end_date,
       c.affected_rows,
       round(c.consumption_qty, 3) as current_feed_qty,
       round(c.trueup_qty, 3) as current_trueup_qty,
       round(c.consumption_value, 2) as current_feed_expense,
       round(c.trueup_value, 2) as current_loss_expense,
       round(c.consumption_qty + c.trueup_qty, 3) as proposed_period_qty,
       c.proposed as proposed_feed_expense,
       round(c.proposed - (c.consumption_value + c.trueup_value), 2) as value_difference,
       round(c.open_qty + c.in_qty - c.consumption_qty - c.trueup_qty, 3) as qty_left_after
from prop c join public.inventory_items i on i.id = c.item_id
order by i.name, c.start_date;
