-- ROLLBACK for 20260926090000_feed_auto_deduct.sql
-- Automatic daily rows are real ledger rows and are NOT deleted: the restored reconciliation
-- (below) undoes and reposts them as one row when their period is closed. Periods on the
-- chart rule fall back to "weight share"; the chart tables are kept, renamed, as evidence.
begin;
drop function if exists public.checkpoint_feed_usage_period(uuid, date, jsonb);
drop function if exists public.set_feed_usage_rule(uuid, text, numeric);
drop function if exists public.post_feed_auto_usage(uuid, jsonb, uuid[], date);
drop function if exists public.delete_feed_chart(uuid);
drop function if exists public.save_feed_chart(uuid, text, uuid, date, jsonb, text);
drop function if exists public.feed_reset_auto_progress(uuid);

update public.feed_usage_periods set rule_type = 'weight_share', rule_value = null where rule_type = 'chart';
alter table public.feed_usage_periods drop constraint if exists feed_usage_periods_rule_type_check;
alter table public.feed_usage_periods add constraint feed_usage_periods_rule_type_check
  check (rule_type in ('weight_share', 'pct_live_weight', 'per_head'));
alter table public.feed_usage_periods drop constraint if exists feed_usage_periods_rule_chk;
alter table public.feed_usage_periods add constraint feed_usage_periods_rule_chk
  check ((rule_type = 'weight_share') = (rule_value is null) and (rule_value is null or rule_value > 0));
alter table public.feed_usage_period_events drop constraint if exists feed_usage_period_events_action_check;
update public.feed_usage_period_events set action = 'correct' where action in ('rule', 'checkpoint');
alter table public.feed_usage_period_events add constraint feed_usage_period_events_action_check
  check (action in ('open', 'close', 'correct', 'reopen', 'cancel', 'reconcile'));

alter table if exists public.feed_chart_bands rename to feed_chart_bands_rolled_back;
alter table if exists public.feed_charts rename to feed_charts_rolled_back;

-- previous reconciliation (from 20260925130000)
create or replace function public.reconcile_feed_usage_period(p_period_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  p record; l record; v_post record;
  v_available numeric; v_consumed numeric; v_target numeric;
  v_posted_qty numeric; v_posted_value numeric; v_wac numeric; v_n int;
  v_status text := 'closed'; v_changed boolean := false; v_row_cost numeric;
begin
  select * into p from public.feed_usage_periods where id = p_period_id for update;
  if not found then raise exception 'Usage period not found' using errcode = 'P0002'; end if;
  if p.status in ('open', 'cancelled') then return p.status; end if;

  for l in select * from public.feed_usage_period_lines where period_id = p_period_id order by item_id loop
    perform pg_advisory_xact_lock(hashtextextended(l.item_id::text, 0));

    -- stock available on the end date, excluding this line's own postings and their reversals
    select coalesce(sum(case when t.type = 'purchase' then t.qty else -t.qty end), 0) into v_available
    from public.inventory_transactions t
    where t.item_id = l.item_id and t.recorded_at::date <= p.end_date
      and t.period_line_id is distinct from l.id;

    v_consumed := v_available - coalesce(l.closing_qty, 0);
    v_target   := greatest(v_consumed, 0);
    v_wac      := public.inventory_unit_cost_as_of(l.item_id, p.end_date);

    select coalesce(sum(case when t.type = 'consumption' then t.qty else -t.qty end), 0),
           coalesce(sum(case when t.type = 'consumption' then 1 else -1 end * t.qty * coalesce(t.unit_cost, 0)), 0)
      into v_posted_qty, v_posted_value
    from public.inventory_transactions t where t.period_line_id = l.id;

    if abs(v_posted_qty - v_target) > 0.0001
       or abs(v_posted_value - v_target * coalesce(v_wac, 0)) > 0.01 then
      v_changed := true;
      -- undo every still-active posting of this line (history kept)
      for v_post in
        select t.* from public.inventory_transactions t
        where t.period_line_id = l.id and t.type = 'consumption'
          and not exists (select 1 from public.inventory_transactions r where r.reverses_id = t.id)
      loop
        insert into public.inventory_transactions
          (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes,
           idempotency_key, reverses_id, period_line_id, created_by)
        values (v_post.item_id, 'purchase', 'consumption_reversal', v_post.qty, v_post.unit_cost, 'correction',
                v_post.recorded_at, 'Usage period re-reconciled: previous posting undone',
                'period-line:' || l.id || ':reverse:' || v_post.id, v_post.id, l.id, auth.uid());
      end loop;
      if v_target > 0 then
        select count(*) + 1 into v_n from public.inventory_transactions where period_line_id = l.id and type = 'consumption';
        insert into public.inventory_transactions
          (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, period_line_id, created_by)
        values (l.item_id, 'consumption', 'consumption', round(v_target, 4), p.end_date,
                'Feed usage period ' || p.start_date || ' → ' || p.end_date,
                'period-line:' || l.id || ':post:' || v_n, l.id, auth.uid())
        returning unit_cost into v_row_cost;
      end if;
    end if;

    select coalesce(sum(case when t.type = 'consumption' then 1 else -1 end * t.qty * coalesce(t.unit_cost, 0)), 0)
      into v_posted_value
    from public.inventory_transactions t where t.period_line_id = l.id;

    update public.feed_usage_period_lines set
      available_qty = v_available,
      consumed_qty  = v_target,
      gap_qty       = greatest(-v_consumed, 0),
      consumed_value = round(v_posted_value, 2),
      cost_missing  = (v_target > 0 and v_wac is null),
      reconciled_at = now()
    where id = l.id;

    if v_consumed < -0.0001 or (v_target > 0 and v_wac is null) then v_status := 'unreconciled'; end if;
  end loop;

  update public.feed_usage_periods set status = v_status where id = p_period_id;
  if v_changed then
    insert into public.feed_usage_period_events (period_id, action, detail)
    values (p_period_id, 'reconcile', jsonb_build_object('status', v_status));
  end if;
  return v_status;
end $$;

-- previous read model
drop view if exists public.v_feed_usage_lines;
create or replace view public.v_feed_usage_lines with (security_invoker = true) as
select l.id as line_id, p.id as period_id, p.business_id, p.target_type, p.item_id as period_item_id, p.recipe_id,
       p.start_date, p.end_date, p.status, p.rule_type, p.rule_value,
       l.item_id, i.name as item_name, i.unit, i.category, i.kg_per_unit, l.share,
       l.closing_qty, l.available_qty, l.consumed_qty, l.gap_qty, l.consumed_value, l.cost_missing,
       (coalesce(p.end_date, public.feed_today()) - p.start_date + 1) as days,
       case when p.end_date is not null and l.consumed_qty is not null
            then round(l.consumed_qty / (p.end_date - p.start_date + 1), 4) end as actual_daily_qty
from public.feed_usage_period_lines l
join public.feed_usage_periods p on p.id = l.period_id
join public.inventory_items i on i.id = l.item_id
where p.status <> 'cancelled';
alter table public.feed_usage_periods drop column if exists auto_posted_through;
commit;
