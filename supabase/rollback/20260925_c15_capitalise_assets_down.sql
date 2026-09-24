-- ROLLBACK for supabase/corrections/20260925_c15_capitalise_assets.sql.
-- Removes the six C15 fixed assets (they were created by C15 and hold no other data), restores
-- the payments to 'expense' and the machine's category. Audit rows stay; rollback rows added.
begin;
with d as (
  delete from public.fixed_assets f
  using public.data_correction_audit a
  where a.correction_batch = '20260925-c15-capitalise-assets' and a.table_name = 'fixed_assets' and a.row_id = f.id
  returning f.id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason)
select '20260925-c15-capitalise-assets-rollback', 'fixed_assets', id, 'created', 'C15 asset', null, 'Rollback of C15' from d;

with u as (
  update public.cost_entries ce set entry_class = 'expense'
  from public.data_correction_audit a
  where a.correction_batch = '20260925-c15-capitalise-assets' and a.table_name = 'cost_entries' and a.field = 'entry_class'
    and a.row_id = ce.id and ce.entry_class = 'asset'
  returning ce.id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason)
select '20260925-c15-capitalise-assets-rollback', 'cost_entries', id, 'entry_class', 'asset', 'expense', 'Rollback of C15' from u;

with u as (
  update public.cost_entries set category = 'utilities'
  where id = 'e91d5e4d-3d92-4537-b007-db48107111a8' and category = 'equipment'
    and exists (select 1 from public.data_correction_audit a where a.correction_batch = '20260925-c15-capitalise-assets' and a.field = 'category')
  returning id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason)
select '20260925-c15-capitalise-assets-rollback', 'cost_entries', id, 'category', 'equipment', 'utilities', 'Rollback of C15' from u;
commit;
