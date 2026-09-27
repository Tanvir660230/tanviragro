-- Rollback of 20260928100000_db_hardening.sql.
-- Before it, no public policy wrapped auth.*() in a sub-select, so unwrapping every one restores them.
begin;

do $$
declare
  p record;
  re constant text := '\( SELECT auth\.(uid|role|jwt)\(\) AS \w+\)';
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public' and (coalesce(qual, '') ~ re or coalesce(with_check, '') ~ re)
  loop
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then sql := sql || format(' using (%s)', regexp_replace(p.qual, re, 'auth.\1()', 'g')); end if;
    if p.with_check is not null then sql := sql || format(' with check (%s)', regexp_replace(p.with_check, re, 'auth.\1()', 'g')); end if;
    execute sql;
  end loop;
end $$;

grant execute on function public.handle_new_user() to public, anon, authenticated;
grant execute on function public.trg_businesses_seed_categories() to public, anon, authenticated;
grant execute on function public.trg_cost_entries_audit() to public, anon, authenticated;
grant execute on function public.trg_inventory_tx_reconcile_periods() to public, anon, authenticated;
grant execute on function public.feed_can_write_business(uuid) to public, anon;

do $$
declare f text;
begin
  foreach f in array array[
    'assert_recipe_balanced(uuid)', 'cattle_quarantine_is_a_flag()', 'check_inventory_stock()',
    'feed_assert_no_overlap(uuid,date,date,uuid)', 'feed_today()', 'get_cattle_consumptions(uuid)',
    'get_inventory_stats(uuid,date)', 'get_monthly_consumptions(uuid)', 'inventory_unit_cost_as_of(uuid,date)',
    'produce_feed_batch(uuid,uuid,uuid,numeric,date,uuid)', 'record_herd_feeding(uuid,date,jsonb,text)',
    'revert_cattle_sale(uuid,uuid,text)', 'sell_cattle(uuid,numeric,numeric,date,text)',
    'set_growth_target_updated_at()', 'trg_cost_entries_category_check()', 'trg_cost_entry_linked_asset_check()',
    'trg_expense_categories_touch()', 'trg_fixed_asset_source_check()', 'trg_inventory_items_kg_default()',
    'trg_inventory_tx_before_insert()', 'trg_partner_share_rule_business()', 'trg_recipe_balanced()',
    'update_cattle_updated_at()']
  loop
    if to_regprocedure('public.' || f) is not null then
      execute format('alter function public.%s reset search_path', f);
    end if;
  end loop;
end $$;

drop index if exists public.idx_businesses_owner_id, public.idx_business_users_user_id, public.idx_inventory_items_business_id,
  public.idx_inventory_transactions_cattle_id, public.idx_inventory_transactions_reverses_id, public.idx_cost_entries_cattle_id,
  public.idx_cattle_death_records_business_id, public.idx_cattle_treatments_medicine_item_id, public.idx_cattle_photos_cattle_id,
  public.idx_cattle_pen_id, public.idx_feed_recipes_business_id, public.idx_recipe_ingredients_recipe_id,
  public.idx_recipe_ingredients_item_id, public.idx_feed_mix_batches_output_item_id, public.idx_feed_usage_periods_item_id,
  public.idx_feed_usage_periods_recipe_id, public.idx_feed_charts_item_id, public.idx_feed_charts_recipe_id,
  public.idx_financial_locks_business_id, public.idx_loans_business_id, public.idx_loan_payments_loan_id,
  public.idx_weight_logs_recorded_by_user_id;

commit;
