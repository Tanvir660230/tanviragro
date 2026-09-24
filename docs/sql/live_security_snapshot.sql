-- Read-only security and schema snapshot for Tanvir Agro (audit items DB-01, SEC-02, SEC-03, SEC-04, DB-04, BUG-01).
-- Run in the Supabase SQL editor against production. Every statement is a SELECT on
-- catalog/metadata tables except section 6, which runs row COUNTs (aggregates only).
-- No data rows are returned and nothing is modified.
-- Save each result grid (CSV) under supabase/baseline/ and commit it.

-- 1. Tables in public: is RLS enabled? (SEC-03 — any 'false' here is exposed to the anon key)
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 2. Every policy in public + storage (SEC-02, SEC-10; also reveals live-only policies, DB-01)
select schemaname, tablename, policyname, permissive, roles, cmd,
       qual as using_expr, with_check as with_check_expr
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 3. Functions: SECURITY DEFINER flag, search_path setting, and who may execute (SEC-04)
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       p.proconfig as config,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by p.prosecdef desc, p.proname;

-- 4. Enum definitions (DB-01: code expects roles admin/viewer/veterinarian/staff, statuses quarantined/culled/archived)
select t.typname as enum_name, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as values
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typnamespace = 'public'::regnamespace
group by t.typname
order by t.typname;

-- 5. Which migrations the CLI has recorded as applied (DB-01 / DEPLOY-01)
--    If this errors with "relation does not exist", migrations were applied by hand in the SQL editor.
select version, name from supabase_migrations.schema_migrations order by version;

-- 6. Row counts for the 1000-row truncation risk (BUG-01) and for tables the code uses but migrations don't define.
--    Tables that don't exist will make this statement fail; if so, delete that line and re-run.
select 'inventory_transactions' as t, count(*) from public.inventory_transactions
union all select 'weight_logs', count(*) from public.weight_logs
union all select 'cost_entries', count(*) from public.cost_entries
union all select 'sales', count(*) from public.sales
union all select 'cattle', count(*) from public.cattle
union all select 'partner_transactions', count(*) from public.partner_transactions
union all select 'business_users', count(*) from public.business_users
union all select 'businesses', count(*) from public.businesses;

-- 7. Integrity checks (aggregates only)
select 'cattle with >1 active sale (DB-04)' as check_name, count(*) as n
from (select cattle_id from public.sales where deleted_at is null group by cattle_id having count(*) > 1) d
union all
select 'consumptions with NULL unit_cost (BUG-04)', count(*)
from public.inventory_transactions where type = 'consumption' and unit_cost is null
union all
select 'business_users rows with role owner (SEC-02 indicator)', count(*)
from public.business_users where role::text = 'owner';

-- 8. Which of the code-referenced-but-undefined tables actually exist (DB-01 / BUG-16)
select name, to_regclass('public.' || name) is not null as exists_in_db
from unnest(array['management_fee_rates','cattle_sales','financial_transactions','orders',
                  'farms','pens','disease_records','breeding_records','cattle_death_records',
                  'document_attachments','livestock_audit_logs','animal_breeds','animal_categories']) as name;

-- 9. PostgREST row cap actually in effect: check Supabase Dashboard → Settings → API → "Max rows" (not queryable here).

-- 10. Columns the app queries that NO migration creates (BUG-23 / DB-01).
--     exists_in_db = true  -> schema drift: add a migration that captures it.
--     exists_in_db = false -> the query using it fails silently; the code must change.
--     (List generated 2026-09-24 by scanning .from(...).select(...) literals in src/.)
select v.table_name, v.column_name,
       exists (select 1 from information_schema.columns c
               where c.table_schema = 'public' and c.table_name = v.table_name
                 and c.column_name = v.column_name) as exists_in_db
from (values
  ('businesses', 'default_daily_gain_kg'),
  ('businesses', 'financial_locked_until'),
  ('cattle', 'current_weight'),
  ('cattle', 'current_weight_kg'),
  ('cattle', 'days_on_feed'),
  ('cattle', 'name'),
  ('cattle', 'purchase_weight_kg'),
  ('cattle', 'tag_number'),
  ('cattle', 'weight'),
  ('feed_recipes', 'active_from'),
  ('feed_recipes', 'active_until'),
  ('feed_recipes', 'deleted_at'),
  ('financial_locks', 'lock_date'),
  ('health_events', 'cost_bdt'),
  ('health_events', 'dosage'),
  ('health_events', 'status'),
  ('health_events', 'withdrawal_days'),
  ('inventory_items', 'current_stock'),
  ('inventory_items', 'is_discontinued'),
  ('inventory_items', 'reorder_threshold'),
  ('inventory_items', 'roughage_active_from'),
  ('inventory_items', 'roughage_active_until'),
  ('inventory_items', 'roughage_type'),
  ('inventory_items', 'unit_cost'),
  ('loan_payments', 'payment_date'),
  ('partner_transactions', 'deleted_at'),
  ('sales', 'buyer_phone')
) as v(table_name, column_name)
order by exists_in_db, v.table_name, v.column_name;
