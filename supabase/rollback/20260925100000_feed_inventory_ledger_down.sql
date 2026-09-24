-- ============================================================================
-- ROLLBACK for 20260925100000_feed_inventory_ledger.sql
-- Run ONLY after first running the corrections rollback
-- (supabase/rollback/20260925_feed_historical_corrections_down.sql) if corrections were applied.
--
-- Restores the previous behaviour (old stock-guard trigger) and removes the new objects.
-- Original row values (type, qty, unit_cost, recorded_at, notes) were never changed by the
-- migration, so dropping the added columns returns every row to its prior state.
-- Rows inserted AFTER the migration keep their quantities/costs (they are real events);
-- only their classification columns are dropped.
-- ============================================================================
begin;

-- restore the original per-animal consumption function (before reversal rows existed)
create or replace function public.get_cattle_consumptions(p_business_id uuid)
returns table (cattle_id uuid, category text, total_cost numeric) language plpgsql as $$
begin
  return query
  select it.cattle_id, i.category::text, sum(it.qty * coalesce(it.unit_cost, 0))
  from public.inventory_transactions it
  join public.inventory_items i on i.id = it.item_id
  where i.business_id = p_business_id and it.type = 'consumption' and it.cattle_id is not null
  group by it.cattle_id, i.category;
end $$;

drop function if exists public.produce_feed_batch(uuid, uuid, uuid, numeric, date, uuid);
drop function if exists public.record_herd_feeding(uuid, date, jsonb, text);
drop view if exists public.v_inventory_balance;
drop view if exists public.v_inventory_unit_cost;

drop trigger if exists trg_inventory_tx_before_insert on public.inventory_transactions;
drop function if exists public.trg_inventory_tx_before_insert();
-- restore the pre-migration guard (function check_inventory_stock from 20260626 is still present)
drop trigger if exists trg_check_inventory_stock on public.inventory_transactions;
create trigger trg_check_inventory_stock
  before insert on public.inventory_transactions
  for each row execute function check_inventory_stock();

drop function if exists public.inventory_unit_cost_as_of(uuid, date);

drop trigger if exists trg_feed_recipes_balanced on public.feed_recipes;
drop trigger if exists trg_recipe_ingredients_balanced on public.recipe_ingredients;
drop function if exists public.trg_recipe_balanced();
drop function if exists public.assert_recipe_balanced(uuid);
alter table public.feed_recipes drop constraint if exists feed_recipes_output_qty_pos_chk;
alter table public.recipe_ingredients drop constraint if exists recipe_ingredients_qty_pos_chk;

drop trigger if exists trg_inventory_items_kg_default on public.inventory_items;
drop function if exists public.trg_inventory_items_kg_default();
alter table public.inventory_items drop constraint if exists inventory_items_kg_per_unit_chk;
alter table public.inventory_items drop column if exists kg_per_unit;

drop index if exists public.uq_inventory_tx_idempotency;
drop index if exists public.idx_inventory_tx_movement;
drop index if exists public.idx_inventory_tx_item_date;
alter table public.inventory_transactions
  drop constraint if exists inventory_tx_movement_type_chk,
  drop constraint if exists inventory_tx_direction_chk,
  drop constraint if exists inventory_tx_cost_source_chk,
  drop constraint if exists inventory_tx_qty_positive_chk,
  drop constraint if exists inventory_tx_unit_cost_nonneg_chk;

-- keep the audit trail as a detached table (renamed) instead of dropping it
alter table if exists public.inventory_ledger_audit rename to inventory_ledger_audit_rolled_back;
alter table if exists public.inventory_ledger_audit_rolled_back drop constraint if exists inventory_ledger_audit_transaction_id_fkey;

alter table public.inventory_transactions
  drop column if exists reverses_id,
  drop column if exists movement_type,
  drop column if exists idempotency_key,
  drop column if exists cost_source,
  drop column if exists is_estimate,
  drop column if exists created_by,
  drop column if exists period_line_id;

commit;
