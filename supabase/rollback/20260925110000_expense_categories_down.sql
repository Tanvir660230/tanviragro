-- ROLLBACK for 20260925110000_expense_categories.sql.
-- Run the corrections rollback first if corrections were applied.
-- Cost entries keep their free-text category; links to categories and attachments are
-- removed. The audit tables are kept, renamed, so no history is lost.
begin;
drop trigger if exists trg_cost_entries_audit on public.cost_entries;
drop function if exists public.trg_cost_entries_audit();
drop trigger if exists trg_cost_entries_category_check on public.cost_entries;
drop function if exists public.trg_cost_entries_category_check();
drop index if exists public.idx_cost_entries_category;
alter table public.cost_entries drop column if exists category_id, drop column if exists attachment_path;
drop trigger if exists trg_businesses_seed_categories on public.businesses;
drop function if exists public.trg_businesses_seed_categories();
drop function if exists public.seed_default_expense_categories(uuid);
drop trigger if exists trg_expense_categories_touch on public.expense_categories;
drop function if exists public.trg_expense_categories_touch();
drop table if exists public.expense_categories;
alter table if exists public.cost_entry_audit rename to cost_entry_audit_rolled_back;
alter table if exists public.data_correction_audit rename to data_correction_audit_rolled_back;
do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute 'drop policy if exists "expense bills readable by tenant" on storage.objects';
    execute 'drop policy if exists "expense bills uploaded by tenant" on storage.objects';
    -- the bucket and any uploaded bills are left in place (files are evidence)
  end if;
end $$;
commit;
