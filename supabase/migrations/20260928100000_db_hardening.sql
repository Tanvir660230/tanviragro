-- ============================================================================
-- Database hardening from the 2026-09-27 audit (Supabase security + performance advisors).
-- No table, column or row is changed; only function settings, grants, policy expressions
-- and indexes.
--
-- 1. search_path pinned on the 23 public functions that had none (function_search_path_mutable).
--    None is SECURITY DEFINER and none uses an extension, so "public, pg_temp" resolves every
--    name exactly as before.
-- 2. Functions nobody signed in should run: trigger functions (a trigger fires without EXECUTE)
--    and feed_can_write_business lose EXECUTE for anon / PUBLIC. Signed-in users keep what the
--    app calls.
-- 3. RLS: auth.uid() / auth.role() / auth.jwt() in 72 policies wrapped as (select auth.uid()),
--    evaluated once per query instead of once per row (auth_rls_initplan). Same meaning.
-- 4. Indexes on the foreign keys the app joins and filters by (unindexed_foreign_keys), incl.
--    businesses.owner_id, which every owner policy looks up.
--
-- Rollback: supabase/rollback/20260928100000_db_hardening_down.sql
-- ============================================================================
begin;

-- 1. search_path ------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- 2. grants -----------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.trg_businesses_seed_categories() from public, anon, authenticated;
revoke execute on function public.trg_cost_entries_audit() from public, anon, authenticated;
revoke execute on function public.trg_inventory_tx_reconcile_periods() from public, anon, authenticated;
revoke execute on function public.feed_can_write_business(uuid) from public, anon;
grant execute on function public.feed_can_write_business(uuid) to authenticated, service_role;

-- 3. RLS: auth.*() once per query ------------------------------------------
do $$
declare
  p record;
  re constant text := '(?<!SELECT )auth\.(uid|role|jwt)\(\)';
  q text;
  c text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ re or coalesce(with_check, '') ~ re)
  loop
    q := case when p.qual is null then null else regexp_replace(p.qual, re, '(select auth.\1())', 'g') end;
    c := case when p.with_check is null then null else regexp_replace(p.with_check, re, '(select auth.\1())', 'g') end;
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if q is not null then sql := sql || format(' using (%s)', q); end if;
    if c is not null then sql := sql || format(' with check (%s)', c); end if;
    execute sql;
  end loop;

  if exists (select 1 from pg_policies where schemaname = 'public'
             and (coalesce(qual, '') ~ re or coalesce(with_check, '') ~ re)) then
    raise exception 'a policy still calls auth.*() per row';
  end if;
end $$;

-- 4. foreign-key indexes (tables the app uses) -------------------------------
create index if not exists idx_businesses_owner_id on public.businesses (owner_id);
create index if not exists idx_business_users_user_id on public.business_users (user_id);
create index if not exists idx_inventory_items_business_id on public.inventory_items (business_id);
create index if not exists idx_inventory_transactions_cattle_id on public.inventory_transactions (cattle_id);
create index if not exists idx_inventory_transactions_reverses_id on public.inventory_transactions (reverses_id);
create index if not exists idx_cost_entries_cattle_id on public.cost_entries (cattle_id);
create index if not exists idx_cattle_death_records_business_id on public.cattle_death_records (business_id);
create index if not exists idx_cattle_treatments_medicine_item_id on public.cattle_treatments (medicine_item_id);
create index if not exists idx_cattle_photos_cattle_id on public.cattle_photos (cattle_id);
create index if not exists idx_cattle_pen_id on public.cattle (pen_id);
create index if not exists idx_feed_recipes_business_id on public.feed_recipes (business_id);
create index if not exists idx_recipe_ingredients_recipe_id on public.recipe_ingredients (recipe_id);
create index if not exists idx_recipe_ingredients_item_id on public.recipe_ingredients (item_id);
create index if not exists idx_feed_mix_batches_output_item_id on public.feed_mix_batches (output_item_id);
create index if not exists idx_feed_usage_periods_item_id on public.feed_usage_periods (item_id);
create index if not exists idx_feed_usage_periods_recipe_id on public.feed_usage_periods (recipe_id);
create index if not exists idx_feed_charts_item_id on public.feed_charts (item_id);
create index if not exists idx_feed_charts_recipe_id on public.feed_charts (recipe_id);
create index if not exists idx_financial_locks_business_id on public.financial_locks (business_id);
create index if not exists idx_loans_business_id on public.loans (business_id);
create index if not exists idx_loan_payments_loan_id on public.loan_payments (loan_id);
create index if not exists idx_weight_logs_recorded_by_user_id on public.weight_logs (recorded_by_user_id);

commit;
