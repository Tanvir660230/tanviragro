-- ============================================================================
-- ROLLBACK for supabase/corrections/20260925_feed_historical_corrections.sql
-- Reverses the batch without deleting anything:
--   * filled costs go back to NULL / 'missing';
--   * C3 / C6 / C12 labels go back to their previous values;
--   * every correction row (C1, C9, C11) is neutralised by an equal and opposite
--     counter-entry that points at it.
-- The counter-entries restore the pre-correction balances exactly, including the Mix Feed
-- negative balance that the new stock guard would refuse, so the insert trigger is
-- disabled for this transaction only (explicit movement_type / cost_source are supplied).
-- Every step writes an audit row. Idempotent. Run BEFORE the migration rollbacks.
-- ============================================================================
begin;

-- 1. Restore costs that the batch filled (C4/C5/C11)
with filled as (
  select a.transaction_id from public.inventory_ledger_audit a
  where a.correction_batch = '20260925-feed-corrections' and a.action = 'fill_missing_cost'
    and not exists (select 1 from public.inventory_ledger_audit r
                    where r.transaction_id = a.transaction_id and r.action = 'rollback' and r.field = 'unit_cost'
                      and r.correction_batch = '20260925-feed-corrections-rollback')
),
upd as (
  update public.inventory_transactions t set unit_cost = null, cost_source = 'missing'
  from filled f where t.id = f.transaction_id and t.cost_source = 'correction'
  returning t.id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason)
select id, 'rollback', '20260925-feed-corrections-rollback', 'unit_cost', 'correction', null, 'Rollback of C4/C5/C11 cost fill' from upd;

-- 2. C3: free-bran confirmation back to "unconfirmed"
with z as (
  update public.inventory_transactions set cost_source = 'zero_unconfirmed'
  where id = '3afda62b-3120-450e-b856-61026a139b74' and cost_source = 'zero_confirmed'
  returning id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason)
select id, 'rollback', '20260925-feed-corrections-rollback', 'cost_source', 'zero_confirmed', 'zero_unconfirmed', 'Rollback of C3' from z;

-- 3. C6: WiFi bill back to category "feed"
with upd as (
  update public.cost_entries set category = 'feed', category_id = null
  where id = '17a72421-538f-44ac-a78a-50d97647b57d' and category = 'utilities'
    and exists (select 1 from public.data_correction_audit a where a.row_id = '17a72421-538f-44ac-a78a-50d97647b57d'
                and a.correction_batch = '20260925-feed-corrections')
  returning id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason)
select '20260925-feed-corrections-rollback', 'cost_entries', id, 'category', 'utilities', 'feed', 'Rollback of C6' from upd;

-- 4. C12: initial weight type back to "unknown"
with upd as (
  update public.cattle set initial_weight_type = 'unknown'
  where id in ('2cf7ef74-6198-4356-ad99-60127ab3d19d', 'a970c5b1-0946-4182-8b0f-513e66f49ed7')
    and initial_weight_type = 'estimated'
  returning id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason)
select '20260925-feed-corrections-rollback', 'cattle', id, 'initial_weight_type', 'estimated', 'unknown', 'Rollback of C12' from upd;

-- 5. Counter-entries for every correction row (C1 reversal + re-date, C9, C11)
alter table public.inventory_transactions disable trigger trg_inventory_tx_before_insert;
with corr as (
  select * from public.inventory_transactions where idempotency_key like 'correction:%'
),
ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select item_id,
         (case when type = 'purchase' then 'consumption' else 'purchase' end)::transaction_type,
         case when type = 'purchase' then 'consumption' else 'consumption_reversal' end,
         qty, unit_cost, 'manual', recorded_at,
         'Rollback of ' || idempotency_key, 'rollback:' || idempotency_key, id
  from corr
  where not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'rollback:' || corr.idempotency_key)
  returning id, reverses_id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason)
select id, 'rollback', '20260925-feed-corrections-rollback', 'reverses_id', null, reverses_id::text, 'Rollback of correction row' from ins;
alter table public.inventory_transactions enable trigger trg_inventory_tx_before_insert;

commit;
