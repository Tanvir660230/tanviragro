-- ROLLBACK for correction C16. Nothing is deleted: every C16 row gets an audited counter-entry
-- (in the reverse order it was made), the mix batch is marked undone, and the six
-- "stock finished" loss rows are open again, exactly as before C16.
begin;

create temp table c16_rows on commit drop as
select t.*
from public.inventory_transactions t
where (t.idempotency_key like 'correction:C16:%' or t.idempotency_key like 'feed-mix:' || md5('correction:C16')::uuid || ':%')
  and not exists (select 1 from public.inventory_transactions r where r.reverses_id = t.id);

-- 3 → eaten: give the mix back
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
select item_id, 'purchase', 'consumption_reversal', qty, unit_cost, 'correction', recorded_at, 'Rollback C16', 'rollback:C16:' || id, id
from c16_rows where idempotency_key like 'correction:C16:eaten:%';
-- 2 → the mix out, the ingredients back
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, reverses_id)
select item_id, 'consumption', 'purchase_reversal', qty, recorded_at, 'Rollback C16', 'rollback:C16:' || id, id
from c16_rows where idempotency_key like 'feed-mix:%:out';
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
select item_id, 'purchase', 'consumption_reversal', qty, unit_cost, 'correction', recorded_at, 'Rollback C16', 'rollback:C16:' || id, id
from c16_rows where idempotency_key like 'feed-mix:%:in:%';
-- 1 → the loss stands again
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key)
select item_id, 'consumption', 'adjustment_out', qty, unit_cost, 'manual', recorded_at, 'Rollback C16 (loss restored)', 'rollback:C16:' || id
from c16_rows where idempotency_key like 'correction:C16:cancel-loss:%';

insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason)
select t.id, 'rollback', '20260926-c16-mix-0918-eaten-rollback', 'reverses_id', null, t.reverses_id::text, 'Correction C16 rolled back'
from public.inventory_transactions t where t.idempotency_key like 'rollback:C16:%'
  and not exists (select 1 from public.inventory_ledger_audit a where a.transaction_id = t.id and a.action = 'rollback');

update public.feed_mix_batches set undone_at = now(), undo_reason = 'Rollback C16'
where id = md5('correction:C16')::uuid and undone_at is null;
commit;
