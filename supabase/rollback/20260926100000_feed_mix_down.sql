-- ROLLBACK for 20260926100000_feed_mix.sql
-- Mix rows are real ledger rows and are NOT deleted (undo a mix first if needed). The batch
-- table is kept, renamed, as evidence; the functions go back to their previous versions.
begin;
drop function if exists public.undo_feed_mix(uuid, text);
drop function if exists public.produce_feed_mix(uuid, uuid, date, jsonb, uuid, numeric, text);
alter table if exists public.feed_mix_batches rename to feed_mix_batches_rolled_back;

-- previous post_feed_auto_usage (20260926090000)
create or replace function public.post_feed_auto_usage(
  p_business_id uuid, p_rows jsonb, p_period_ids uuid[], p_through date
) returns int language plpgsql security definer set search_path = public as $$
declare r record; v_balance numeric; v_qty numeric; v_n int := 0; v_through date; v_lock date;
begin
  if not public.feed_can_write_business(p_business_id) then
    raise exception 'Not allowed for this business' using errcode = '42501';
  end if;
  v_through := least(coalesce(p_through, public.feed_today() - 1), public.feed_today() - 1);
  select max(locked_until) into v_lock from public.financial_locks where business_id = p_business_id;

  for r in
    select l.id as line_id, l.item_id, p.id as period_id, p.start_date,
           (e->>'date')::date as d, (e->>'qty')::numeric as qty
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e
    join public.feed_usage_period_lines l on l.id = (e->>'line_id')::uuid
    join public.feed_usage_periods p on p.id = l.period_id
    where p.business_id = p_business_id and p.status = 'open'
    order by (e->>'date')::date, l.item_id
  loop
    continue when r.d < r.start_date or r.d > v_through or r.qty is null or r.qty <= 0;
    continue when v_lock is not null and r.d <= v_lock;
    perform pg_advisory_xact_lock(hashtextextended(r.item_id::text, 0));
    select coalesce(sum(case when type = 'purchase' then qty else -qty end), 0) into v_balance
    from public.inventory_transactions where item_id = r.item_id;
    v_qty := round(least(r.qty, greatest(v_balance, 0)), 4);     -- never below zero stock
    continue when v_qty <= 0;
    insert into public.inventory_transactions
      (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, period_line_id, created_by)
    values (r.item_id, 'consumption', 'consumption', v_qty, r.d,
            'Auto: daily feed (final at count)', 'auto:' || r.line_id || ':' || r.d, r.line_id, auth.uid())
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;

  update public.feed_usage_periods
  set auto_posted_through = greatest(coalesce(auto_posted_through, start_date - 1), least(v_through, public.feed_today() - 1))
  where id = any(coalesce(p_period_ids, '{}')) and business_id = p_business_id and status = 'open' and start_date <= v_through;
  return v_n;
end $$;

-- previous trg_inventory_tx_reconcile_periods (20260925130000)
create or replace function public.trg_inventory_tx_reconcile_periods() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_from date;
begin
  if new.period_line_id is not null then return null; end if;         -- a period's own posting
  v_from := new.recorded_at::date;
  if tg_op = 'UPDATE' then v_from := least(v_from, old.recorded_at::date); end if;
  perform public.reconcile_feed_usage_from(new.item_id, v_from);
  if tg_op = 'UPDATE' and old.item_id <> new.item_id then
    perform public.reconcile_feed_usage_from(old.item_id, old.recorded_at::date);
  end if;
  return null;
end $$;

-- previous trg_inventory_tx_before_insert (a purchase_reversal may undo a purchase only)
CREATE OR REPLACE FUNCTION public.trg_inventory_tx_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare v_balance numeric;
begin
  -- default meaning from direction for writers that don't set it
  if new.movement_type is null then
    new.movement_type := case when new.type = 'purchase' then 'purchase' else 'consumption' end;
  end if;

  -- serialise all movements of one item (concurrency: no double spend)
  perform pg_advisory_xact_lock(hashtextextended(new.item_id::text, 0));

  if new.type = 'consumption' then
    -- a purchase_reversal must undo a purchase row of the same item, at that row's cost
    if new.movement_type = 'purchase_reversal' then
      if new.reverses_id is null or not exists (select 1 from public.inventory_transactions o
          where o.id = new.reverses_id and o.item_id = new.item_id and o.movement_type = 'purchase' and o.qty >= new.qty) then
        raise exception 'purchase_reversal must reference a purchase row of the same item with at least this quantity'
          using errcode = 'check_violation';
      end if;
      select unit_cost, cost_source into new.unit_cost, new.cost_source
      from public.inventory_transactions where id = new.reverses_id;
    -- OUT movements are valued at WAC as of their date unless a manual cost is declared
    elsif coalesce(new.cost_source, '') <> 'manual' then
      new.unit_cost := public.inventory_unit_cost_as_of(new.item_id, new.recorded_at::date);
      new.cost_source := case when new.unit_cost is null then 'missing' else 'wac' end;
    end if;
    -- stock guard: signed balance of every movement for this item (no clamping, no sign tricks).
    -- A usage-period posting is computed from the stock available AS OF its end date by the
    -- period reconciliation itself, so the all-dates balance check does not apply to it.
    if new.period_line_id is not null then return new; end if;
    select coalesce(sum(case when type = 'purchase' then qty else -qty end), 0) into v_balance
    from public.inventory_transactions where item_id = new.item_id;
    if v_balance - new.qty < -0.0001 then
      raise exception 'Insufficient stock for item %: on hand %, requested %', new.item_id, round(v_balance, 4), new.qty
        using errcode = 'check_violation';
    end if;
  else
    if new.cost_source is null then
      new.cost_source := case
        when new.movement_type = 'feed_mix_output' then 'mix_inputs'
        -- grass from own/leased land: the land cost is an expense (Rent & Lease), so the fodder
        -- itself carries no cost here — valuing it too would count the land cost twice
        when new.movement_type = 'own_production' and coalesce(new.unit_cost, 0) = 0 then 'zero_confirmed'
        when new.unit_cost is null and new.movement_type in ('adjustment_in','return') then 'wac'
        when new.unit_cost is null then 'missing'
        when new.unit_cost = 0 then 'zero_unconfirmed'
        else 'invoice' end;
    end if;
    if new.movement_type = 'own_production' and new.unit_cost is null then
      new.unit_cost := 0;
    end if;
    -- a reversal must point at the consumption row it undoes and carry that row's cost
    if new.movement_type = 'consumption_reversal' then
      if new.reverses_id is null or not exists (select 1 from public.inventory_transactions o
          where o.id = new.reverses_id and o.item_id = new.item_id and o.type = 'consumption' and o.qty >= new.qty) then
        raise exception 'consumption_reversal must reference a consumption row of the same item with at least this quantity'
          using errcode = 'check_violation';
      end if;
      -- an undo gives back the value that row took out; only an explicit, audited correction
      -- may state its own cost (e.g. ৳0 for quantity that never existed)
      if new.unit_cost is null then
        select unit_cost into new.unit_cost from public.inventory_transactions where id = new.reverses_id;
        -- the generic IN default above marked it 'missing' (no cost yet); it now has the original's cost
        new.cost_source := case when new.unit_cost is null then 'missing' else 'correction' end;
      end if;
    end if;
    if new.unit_cost is null and new.movement_type in ('adjustment_in','return') then
      new.unit_cost := public.inventory_unit_cost_as_of(new.item_id, new.recorded_at::date);
      if new.unit_cost is null then new.cost_source := 'missing'; end if;
    end if;
  end if;
  return new;
end $function$

;
commit;
