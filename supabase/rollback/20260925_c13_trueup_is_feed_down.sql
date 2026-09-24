-- ============================================================================
-- ROLLBACK for supabase/corrections/20260925_c13_trueup_is_feed.sql
-- Neutralises every C13 row with an equal and opposite counter-entry (nothing deleted):
--   feed row          → consumption_reversal (same qty and cost)
--   loss-cancel row   → adjustment_out (same qty and cost)
-- Idempotent. Run BEFORE the 20260925140000 rollback.
-- ============================================================================
begin;

with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select t.item_id, 'purchase', 'consumption_reversal', t.qty, t.unit_cost, 'correction', t.recorded_at,
         'Rollback of C13 feed row ' || t.id, 'rollback:C13:feed:' || t.id, t.id
  from public.inventory_transactions t
  where t.idempotency_key like 'correction:C13:feed:%'
    and not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'rollback:C13:feed:' || t.id)
  returning id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, reason)
select id, 'rollback', '20260925-c13-trueup-is-feed-rollback', 'movement_type', 'Rollback of C13 (feed row)' from ins;

with ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select t.item_id, 'consumption', 'adjustment_out', t.qty, t.unit_cost, 'manual', t.recorded_at,
         'Rollback of C13 loss-cancel row ' || t.id, 'rollback:C13:cancel-loss:' || t.id, t.id
  from public.inventory_transactions t
  where t.idempotency_key like 'correction:C13:cancel-loss:%'
    and not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'rollback:C13:cancel-loss:' || t.id)
  returning id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, reason)
select id, 'rollback', '20260925-c13-trueup-is-feed-rollback', 'movement_type', 'Rollback of C13 (loss-cancel row)' from ins;

commit;
