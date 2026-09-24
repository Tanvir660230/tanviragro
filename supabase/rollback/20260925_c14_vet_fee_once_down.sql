-- ROLLBACK for supabase/corrections/20260925_c14_vet_fee_once.sql: restores the soft-deleted
-- duplicate cost entries (the audit rows stay; a rollback row is added). Idempotent.
begin;
with r as (
  update public.cost_entries ce set deleted_at = null
  from public.data_correction_audit a
  where a.correction_batch = '20260925-c14-vet-fee-once' and a.table_name = 'cost_entries'
    and a.row_id = ce.id and ce.deleted_at is not null
  returning ce.id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason)
select '20260925-c14-vet-fee-once-rollback', 'cost_entries', id, 'deleted_at', 'soft-deleted (duplicate)', null, 'Rollback of C14' from r;
commit;
