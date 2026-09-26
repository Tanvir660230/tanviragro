-- ============================================================================
-- Team members can use their farm's data (not only the owner).
--
-- Production (checked 2026-09-27) has owner-only policies on every core table
-- ("… in own business" = businesses.owner_id = auth.uid()). A manager or worker invited on the
-- Team page therefore saw empty pages. Migration 20260924120000 created is_business_member()
-- but only covered tables added in 026.
--
-- This adds ONE extra permissive policy per table, next to the owner's: members of the business
-- (is_business_member) may use its rows. Nothing is dropped; owners keep exactly what they had.
-- What each role may do (view only, add costs, manage partners …) stays enforced in the app's
-- server actions (lib/auth/permissions).
--   • tables with business_id      → is_business_member(business_id)
--   • child tables without it      → through their parent row
-- Needs 20260924120000 (is_business_member). Rollback:
-- supabase/rollback/20260927110000_team_member_access_down.sql
-- ============================================================================
begin;

do $$
declare
  r record;
begin
  if to_regprocedure('public.is_business_member(uuid)') is null then
    raise exception 'Apply migration 20260924120000 (is_business_member) first';
  end if;

  -- every table that has a business_id and row-level security on
  for r in
    select c.relname as t
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and exists (select 1 from information_schema.columns k
                  where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'business_id')
      and c.relname not in ('data_correction_audit')
  loop
    execute format('drop policy if exists "team members" on public.%I', r.t);
    execute format('create policy "team members" on public.%I for all '
                   'using (public.is_business_member(business_id)) '
                   'with check (public.is_business_member(business_id))', r.t);
  end loop;
end $$;

-- child tables: through the parent's business (only where the table and column exist)
do $$
declare
  m record;
begin
  for m in
    select * from (values
      ('partner_transactions',    'partner_id',  'partners'),
      ('inventory_transactions',  'item_id',     'inventory_items'),
      ('cattle_treatments',       'cattle_id',   'cattle'),
      ('weight_logs',             'cattle_id',   'cattle'),
      ('sales',                   'cattle_id',   'cattle'),
      ('recipe_ingredients',      'recipe_id',   'feed_recipes'),
      ('loan_payments',           'loan_id',     'loans'),
      ('feed_usage_period_lines', 'period_id',   'feed_usage_periods'),
      ('feed_usage_period_events','period_id',   'feed_usage_periods')
    ) as v(t, fk, parent)
  loop
    if to_regclass('public.' || m.t) is null or to_regclass('public.' || m.parent) is null then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = m.t and column_name = m.fk) then continue; end if;
    execute format('alter table public.%I enable row level security', m.t);
    execute format('drop policy if exists "team members" on public.%I', m.t);
    execute format('create policy "team members" on public.%I for all '
                   'using (%I in (select p.id from public.%I p where public.is_business_member(p.business_id))) '
                   'with check (%I in (select p.id from public.%I p where public.is_business_member(p.business_id)))',
                   m.t, m.fk, m.parent, m.fk, m.parent);
  end loop;
end $$;

commit;
