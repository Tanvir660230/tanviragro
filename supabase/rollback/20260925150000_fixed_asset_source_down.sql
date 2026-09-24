-- Rollback of 20260925150000_fixed_asset_source.sql. Run the C15 rollback first.
begin;
drop trigger if exists trg_cost_entry_linked_asset_check on public.cost_entries;
drop function if exists public.trg_cost_entry_linked_asset_check();
drop trigger if exists trg_fixed_asset_source_check on public.fixed_assets;
drop function if exists public.trg_fixed_asset_source_check();
drop index if exists public.idx_fixed_assets_source;
alter table public.fixed_assets drop column if exists source_cost_entry_id;
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20260925150000';
  end if;
end $$;
commit;
