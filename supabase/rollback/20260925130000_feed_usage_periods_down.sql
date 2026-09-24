-- ROLLBACK for 20260925130000_feed_usage_periods.sql
-- Period postings are real ledger rows; they are NOT deleted. Each still-active posting is
-- neutralised by a counter-entry (audited in inventory_ledger_audit), then the period
-- machinery is removed. The period tables are kept, renamed, as evidence.
-- Run BEFORE the ledger rollback.
begin;
drop trigger if exists trg_inventory_tx_reconcile_periods on public.inventory_transactions;
drop function if exists public.trg_inventory_tx_reconcile_periods();

with active as (
  select t.* from public.inventory_transactions t
  where t.period_line_id is not null and t.type = 'consumption'
    and not exists (select 1 from public.inventory_transactions r where r.reverses_id = t.id)
),
ins as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select item_id, 'purchase', 'consumption_reversal', qty, unit_cost, 'correction', recorded_at,
         'Rollback of feed usage periods', 'rollback:period:' || id, id
  from active
  returning id, reverses_id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason)
select id, 'rollback', '20260925130000-usage-periods-rollback', 'reverses_id', null, reverses_id::text,
       'Feed usage periods removed: period posting neutralised' from ins;

alter table public.inventory_transactions drop constraint if exists inventory_tx_period_line_fk;
drop index if exists public.idx_inventory_tx_period_line;
drop view if exists public.v_feed_usage_lines;
drop function if exists public.open_feed_usage_period(uuid, text, uuid, date, text, numeric, text, text);
drop function if exists public.close_feed_usage_period(uuid, date, jsonb, text);
drop function if exists public.cancel_feed_usage_period(uuid, text);
drop function if exists public.reconcile_feed_usage_from(uuid, date);
drop function if exists public.reconcile_feed_usage_period(uuid);
drop function if exists public.feed_assert_no_overlap(uuid, date, date, uuid);
drop function if exists public.feed_today();
drop function if exists public.feed_can_write_business(uuid);
alter table if exists public.feed_usage_period_events rename to feed_usage_period_events_rolled_back;
alter table if exists public.feed_usage_period_lines rename to feed_usage_period_lines_rolled_back;
alter table if exists public.feed_usage_periods rename to feed_usage_periods_rolled_back;
commit;
