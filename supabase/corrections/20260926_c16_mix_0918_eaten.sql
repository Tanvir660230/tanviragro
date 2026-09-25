-- ============================================================================
-- Correction C16 — the 18 Sep mix was eaten by 24 Sep (not a loss)
-- Owner (2026-09-25): on the old live site the six ingredients were marked "stock finished"
-- (dated 2026-09-24). The old code booked the remainder as adjustment_out "True-Up" (a loss,
-- ≈ ৳6,924). In fact everything had been mixed on 2026-09-18 and was fed until 2026-09-24.
-- Owner chose: "18 Sep mix, eaten until 24 Sep". For those rows this batch adds, audited:
--   1. adjustment_in, same qty and cost, pointing at each loss row → cancels the loss;
--   2. one mix dated 2026-09-18 with the same quantities and costs → "দানাদার মিক্স"
--      (feed_mix_input / feed_mix_output + a feed_mix_batches row, so the Mix page shows it);
--   3. the whole mix as herd consumption covering 2026-09-18 .. 2026-09-24 (covers_from),
--      at the mix's own cost → feed expense spread over those days by the animals' weight.
-- Stock quantity and value do not change. Nothing is edited or deleted. Idempotent.
-- Requires migrations 20260925140000 and 20260926100000.
-- Rollback: supabase/rollback/20260926_c16_mix_0918_eaten_down.sql
-- ============================================================================
begin;

-- the loss rows of 2026-09-24 that nothing has cancelled yet
create temp table c16 on commit drop as
select t.id, t.item_id, t.qty, t.unit_cost, i.business_id
from public.inventory_transactions t
join public.inventory_items i on i.id = t.item_id
where t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%' and t.recorded_at = '2026-09-24'
  and t.unit_cost is not null
  and not exists (select 1 from public.inventory_transactions r where r.reverses_id = t.id);

do $$
declare n int; biz int; v numeric;
begin
  select count(*), count(distinct business_id), round(sum(qty * unit_cost), 2) into n, biz, v from c16;
  if exists (select 1 from public.feed_mix_batches where id = md5('correction:C16')::uuid) then
    raise notice 'C16 already applied — nothing to do';
  elsif n <> 6 or biz <> 1 then
    raise exception 'C16 expected 6 open stock-finished rows of one business on 2026-09-24, found % (businesses %) — stopped, nothing written', n, biz;
  else
    raise notice 'C16: % rows, ৳%', n, v;
  end if;
end $$;

-- the mix item (made once; the first mix on the new Mix page would make the same item)
insert into public.inventory_items (business_id, name, category, unit)
select distinct c.business_id, 'দানাদার মিক্স', 'feed'::inventory_category, 'kg' from c16 c
where not exists (select 1 from public.inventory_items x where x.business_id = c.business_id and x.name = 'দানাদার মিক্স' and x.deleted_at is null)
  and not exists (select 1 from public.feed_mix_batches where id = md5('correction:C16')::uuid);

create temp table c16_mix on commit drop as
select md5('correction:C16')::uuid as batch_id, c.business_id,
       (select x.id from public.inventory_items x where x.business_id = c.business_id and x.name = 'দানাদার মিক্স' and x.deleted_at is null limit 1) as mix_item,
       sum(c.qty) as kg, sum(c.qty * c.unit_cost) as cost
from c16 c group by c.business_id;

-- 1. cancel the loss
with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select c.item_id, 'purchase', 'adjustment_in', c.qty, c.unit_cost, 'correction', '2026-09-24',
         'Correction C16: stock finished = mixed on 2026-09-18 and eaten, not a loss (cancels ' || c.id || ')',
         'correction:C16:cancel-loss:' || c.id, c.id
  from c16 c
  where not exists (select 1 from public.feed_mix_batches where id = md5('correction:C16')::uuid)
  returning id, reverses_id, qty, unit_cost
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260926-c16-mix-0918-eaten', 'movement_type', 'adjustment_out', 'adjustment_in',
       'Owner 2026-09-25: the finished stock was mixed on 18 Sep and eaten by 24 Sep; the loss is cancelled',
       'cancels ' || reverses_id || '; ' || qty || ' @ ' || unit_cost
from ins;

-- 2. the 18 Sep mix: ingredients out and the mix in, at the same costs (value unchanged)
with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key)
  select c.item_id, 'consumption', 'feed_mix_input', c.qty, c.unit_cost, 'manual', '2026-09-18',
         'Feed mix 2026-09-18 · correction C16 → দানাদার মিক্স',
         'feed-mix:' || m.batch_id || ':in:' || c.item_id
  from c16 c join c16_mix m on m.business_id = c.business_id
  where not exists (select 1 from public.feed_mix_batches where id = m.batch_id)
  returning id, qty, unit_cost
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260926-c16-mix-0918-eaten', 'movement_type', null, 'feed_mix_input',
       'Owner 2026-09-25: mixed on 18 Sep', qty || ' @ ' || unit_cost from ins;

with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key)
  select m.mix_item, 'purchase', 'feed_mix_output', round(m.kg, 4), round(m.cost / m.kg, 6), 'mix_inputs', '2026-09-18',
         'Feed mix 2026-09-18 · correction C16', 'feed-mix:' || m.batch_id || ':out'
  from c16_mix m
  where not exists (select 1 from public.feed_mix_batches where id = m.batch_id)
  returning id, qty, unit_cost
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260926-c16-mix-0918-eaten', 'movement_type', null, 'feed_mix_output',
       'Owner 2026-09-25: the 18 Sep mix', qty || ' @ ' || unit_cost from ins;

-- 3. the whole mix eaten 18 → 24 Sep (herd, spread by weight over the days)
with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, covers_from, notes, idempotency_key)
  select m.mix_item, 'consumption', 'consumption', round(m.kg, 4), round(m.cost / m.kg, 6), 'manual', '2026-09-24', '2026-09-18',
         'Correction C16: the 18 Sep mix eaten 2026-09-18 .. 2026-09-24', 'correction:C16:eaten:' || m.batch_id
  from c16_mix m
  where not exists (select 1 from public.feed_mix_batches where id = m.batch_id)
  returning id, qty, unit_cost
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260926-c16-mix-0918-eaten', 'movement_type', null, 'consumption',
       'Owner 2026-09-25: eaten by 24 Sep', 'covers 2026-09-18 .. 2026-09-24; ' || qty || ' @ ' || unit_cost from ins;

insert into public.feed_mix_batches (id, business_id, output_item_id, mix_date, output_qty, input_qty, total_cost, note)
select m.batch_id, m.business_id, m.mix_item, '2026-09-18', round(m.kg, 4), round(m.kg, 4), round(m.cost, 2),
       'Correction C16: recorded as stock finished on the old site'
from c16_mix m
where not exists (select 1 from public.feed_mix_batches where id = m.batch_id);

commit;

-- check (read-only): open stock-finished losses of 24 Sep = 0; the mix and its eating; stock value
select
  (select count(*) from public.inventory_transactions t where t.movement_type = 'adjustment_out' and t.notes ilike 'True-Up%'
     and t.recorded_at = '2026-09-24' and not exists (select 1 from public.inventory_transactions r where r.reverses_id = t.id)) as open_losses_0924,
  (select output_qty || ' kg / ৳' || total_cost from public.feed_mix_batches where id = md5('correction:C16')::uuid)                  as mix_0918,
  (select round(qty * unit_cost, 2) from public.inventory_transactions where idempotency_key = 'correction:C16:eaten:' || md5('correction:C16')::uuid) as eaten_value,
  (select round(sum(value_on_hand), 2) from public.v_inventory_balance)                                                                as stock_value;
