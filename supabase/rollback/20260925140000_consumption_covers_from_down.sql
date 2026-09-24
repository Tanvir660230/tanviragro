-- Rollback of 20260925140000_consumption_covers_from.sql. Run the C13 rollback first.
begin;
alter table public.inventory_transactions drop constraint if exists inventory_tx_covers_from_chk;
alter table public.inventory_transactions drop column if exists covers_from;
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20260925140000';
  end if;
end $$;
commit;
