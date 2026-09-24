-- ============================================================================
-- Correction C14 — each vet fee counted once
-- Proven by the numerical audit (docs/NUMERICAL_ACCOUNTING_AUDIT.md §F3): the old medical
-- form saved every clinical visit twice — a cattle_treatments row (vet_fee) AND a
-- "Medical/Vet Fee" cost entry for the same money. The accounting engine capitalised the
-- treatment into the animal AND expensed the cost entry, and the balance sheet took the cash
-- out twice (৳4,500 on production). The form no longer writes the second record.
--
-- This batch soft-deletes (deleted_at) ONLY cost entries that are provably the duplicate of a
-- treatment: category 'Medical/Vet Fee', same amount, same date, the animal's tag in the
-- description, created within 5 seconds of the treatment. The treatment stays as the single
-- record of the payment. Nothing is hard-deleted; cost_entry_audit records the soft delete
-- automatically and data_correction_audit records why. Idempotent.
-- Rollback: supabase/rollback/20260925_c14_vet_fee_once_down.sql
-- ============================================================================
begin;

create temp table c14 on commit drop as
select ce.id as cost_entry_id, t.id as treatment_id, ce.amount, ce.recorded_at, c.tag_id
from public.cost_entries ce
join public.cattle c on c.business_id = ce.business_id
join public.cattle_treatments t on t.cattle_id = c.id
where ce.deleted_at is null
  and ce.category = 'Medical/Vet Fee'
  and ce.amount = coalesce(t.vet_fee, 0) + coalesce(t.additional_medical_cost, 0)
  and ce.recorded_at = t.treated_at
  and (ce.cattle_id = c.id or (ce.cattle_id is null and ce.description ilike '%#' || c.tag_id || ' %'))
  and abs(extract(epoch from (ce.created_at - t.created_at))) <= 5;

-- a cost entry must match exactly one treatment, and a treatment exactly one cost entry
do $$
begin
  if exists (select 1 from c14 group by cost_entry_id having count(*) > 1)
     or exists (select 1 from c14 group by treatment_id having count(*) > 1) then
    raise exception 'C14: ambiguous match — nothing changed';
  end if;
end $$;

with upd as (
  update public.cost_entries ce set deleted_at = now()
  from c14 where ce.id = c14.cost_entry_id and ce.deleted_at is null
  returning ce.id, c14.treatment_id, c14.amount, c14.recorded_at, c14.tag_id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason, evidence)
select '20260925-c14-vet-fee-once', 'cost_entries', id, 'deleted_at', null, 'soft-deleted (duplicate)',
       'C14: duplicate of treatment ' || treatment_id || ' — the same vet fee was recorded twice by the old medical form',
       tag_id || ', ' || recorded_at || ', ৳' || amount
from upd;

commit;

-- check (read-only)
select count(*) as duplicates_neutralised, sum(amount) as amount
from public.cost_entries where id in (select row_id from public.data_correction_audit where correction_batch = '20260925-c14-vet-fee-once');
