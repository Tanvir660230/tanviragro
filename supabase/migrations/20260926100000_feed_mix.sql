-- ============================================================================
-- Feed mix by date: each mix is that day's recipe. Plan: docs/FEED_MIX_PLAN.md
-- Rollback: supabase/rollback/20260926100000_feed_mix_down.sql
--
--   produce_feed_mix  → one dated mix with free quantities: ingredients out (feed_mix_input,
--                       average cost), mix in (feed_mix_output, valued at the inputs' cost);
--                       one transaction, idempotent by batch id; recorded in feed_mix_batches
--   undo_feed_mix     → audited reversals of every row (refused once the mix is eaten)
--   daily deduction   → a day is topped up to its planned amount (a day capped by empty stock
--                       is completed later); a stock-in dated in the past re-opens those days
-- Requires 20260926090000 (automatic deduction). Additive and idempotent.
-- ============================================================================
begin;

-- ── 1. Mix batches ──────────────────────────────────────────────────────────
create table if not exists public.feed_mix_batches (
  id             uuid primary key,                       -- the batch id (also in the rows' keys)
  business_id    uuid not null references public.businesses(id),
  output_item_id uuid not null references public.inventory_items(id),
  mix_date       date not null,
  output_qty     numeric not null check (output_qty > 0),
  input_qty      numeric not null check (input_qty > 0),
  total_cost     numeric,                                -- null = an ingredient had no known cost
  note           text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  undone_at      timestamptz,
  undone_by      uuid,
  undo_reason    text
);
create index if not exists idx_feed_mix_batches_biz on public.feed_mix_batches (business_id, mix_date desc);
comment on table public.feed_mix_batches is
  'One feed mix made on mix_date: its ingredient rows (feed_mix_input) are that day''s recipe; the mix enters stock as feed_mix_output.';

alter table public.feed_mix_batches enable row level security;
drop policy if exists "feed mix batches readable by tenant" on public.feed_mix_batches;
create policy "feed mix batches readable by tenant" on public.feed_mix_batches for select using (
  business_id in (select id from public.businesses where owner_id = auth.uid()
                  union select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)));

-- ── 2. Ledger: a mix output may be reversed like a purchase (undo a mix) ────
create or replace function public.trg_inventory_tx_before_insert()
 returns trigger
 language plpgsql
as $function$
declare v_balance numeric;
begin
  -- default meaning from direction for writers that don't set it
  if new.movement_type is null then
    new.movement_type := case when new.type = 'purchase' then 'purchase' else 'consumption' end;
  end if;

  -- serialise all movements of one item (concurrency: no double spend)
  perform pg_advisory_xact_lock(hashtextextended(new.item_id::text, 0));

  if new.type = 'consumption' then
    -- a purchase_reversal must undo a purchase (or a mix output) row of the same item, at that row's cost
    if new.movement_type = 'purchase_reversal' then
      if new.reverses_id is null or not exists (select 1 from public.inventory_transactions o
          where o.id = new.reverses_id and o.item_id = new.item_id and o.movement_type in ('purchase', 'feed_mix_output') and o.qty >= new.qty) then
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
end $function$;

-- ── 3. Make a mix ───────────────────────────────────────────────────────────
-- p_lines = [{"item_id":…, "qty":…}] in each ingredient's own unit (kg items, or pieces with kg_per_unit)
create or replace function public.produce_feed_mix(
  p_business_id uuid, p_output_item_id uuid, p_date date, p_lines jsonb, p_batch_id uuid,
  p_output_qty numeric default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l record; v_out record; v_kg numeric := 0; v_cost numeric := 0; v_missing boolean := false;
  v_row_cost numeric; v_out_qty numeric; v_n int := 0; v_lock date; v_label text;
begin
  if not public.feed_can_write_business(p_business_id) then
    raise exception 'Not allowed for this business' using errcode = '42501';
  end if;
  if p_batch_id is null then raise exception 'Batch id missing' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.feed_mix_batches where id = p_batch_id) then
    return jsonb_build_object('batch_id', p_batch_id, 'duplicate', true);          -- a double submit
  end if;
  if p_date is null or p_date > public.feed_today() then
    raise exception 'Mix date must be today or earlier' using errcode = 'check_violation';
  end if;
  select max(locked_until) into v_lock from public.financial_locks where business_id = p_business_id;
  if v_lock is not null and p_date <= v_lock then
    raise exception 'The books are locked up to % — choose a later date', v_lock using errcode = 'check_violation';
  end if;
  select id, name, unit into v_out from public.inventory_items
  where id = p_output_item_id and business_id = p_business_id and deleted_at is null;
  if not found then raise exception 'Mix item not found' using errcode = '42501'; end if;
  if lower(btrim(v_out.unit)) <> 'kg' then raise exception 'The mix item must be counted in kg' using errcode = 'check_violation'; end if;

  -- validate every line first (item of this business, quantity > 0, not the mix itself, once each)
  for l in
    select (e->>'item_id')::uuid as item_id, (e->>'qty')::numeric as qty, i.name, i.unit, i.kg_per_unit
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e
    left join public.inventory_items i on i.id = (e->>'item_id')::uuid and i.business_id = p_business_id and i.deleted_at is null
  loop
    if l.name is null then raise exception 'An ingredient does not belong to this business' using errcode = '42501'; end if;
    if l.qty is null or l.qty <= 0 then raise exception 'Every ingredient needs a quantity above 0' using errcode = 'check_violation'; end if;
    if l.item_id = p_output_item_id then raise exception 'The mix cannot be its own ingredient' using errcode = 'check_violation'; end if;
    if lower(btrim(l.unit)) <> 'kg' and coalesce(l.kg_per_unit, 0) <= 0 then
      raise exception '% is counted in %: set its kg per % first', l.name, l.unit, l.unit using errcode = 'check_violation';
    end if;
    v_n := v_n + 1;
    v_kg := v_kg + l.qty * case when lower(btrim(l.unit)) = 'kg' then 1 else l.kg_per_unit end;
  end loop;
  if v_n = 0 then raise exception 'Add at least one ingredient' using errcode = 'check_violation'; end if;
  if (select count(distinct e->>'item_id') from jsonb_array_elements(p_lines) e) <> v_n then
    raise exception 'An ingredient is listed twice' using errcode = 'check_violation';
  end if;
  v_out_qty := round(coalesce(p_output_qty, v_kg), 4);
  if v_out_qty <= 0 then raise exception 'Mix quantity must be above 0' using errcode = 'check_violation'; end if;

  v_label := 'Feed mix ' || p_date || coalesce(' · ' || nullif(btrim(p_note), ''), '');
  for l in
    select (e->>'item_id')::uuid as item_id, round((e->>'qty')::numeric, 4) as qty
    from jsonb_array_elements(p_lines) e
  loop
    insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, created_by)
    values (l.item_id, 'consumption', 'feed_mix_input', l.qty, p_date, v_label || ' → ' || v_out.name,
            'feed-mix:' || p_batch_id || ':in:' || l.item_id, auth.uid())
    returning unit_cost into v_row_cost;
    if v_row_cost is null then v_missing := true; end if;
    v_cost := v_cost + l.qty * coalesce(v_row_cost, 0);
  end loop;

  -- an unknown ingredient cost makes the mix cost unknown: never value it as if that input were free
  insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, created_by)
  values (p_output_item_id, 'purchase', 'feed_mix_output', v_out_qty,
          case when v_missing then null else round(v_cost / v_out_qty, 6) end,
          case when v_missing then 'missing' else 'mix_inputs' end, p_date,
          v_label, 'feed-mix:' || p_batch_id || ':out', auth.uid());

  insert into public.feed_mix_batches (id, business_id, output_item_id, mix_date, output_qty, input_qty, total_cost, note)
  values (p_batch_id, p_business_id, p_output_item_id, p_date, v_out_qty, round(v_kg, 4),
          case when v_missing then null else round(v_cost, 2) end, nullif(btrim(p_note), ''));

  return jsonb_build_object('batch_id', p_batch_id, 'output_qty', v_out_qty,
                            'cost', case when v_missing then null else round(v_cost, 2) end);
end $$;

-- ── 4. Undo a mix entered by mistake (every row reversed; history kept) ─────
create or replace function public.undo_feed_mix(p_batch_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare b record; r record;
begin
  select * into b from public.feed_mix_batches where id = p_batch_id for update;
  if not found then raise exception 'Mix not found' using errcode = 'P0002'; end if;
  if not public.feed_can_write_business(b.business_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if b.undone_at is not null then raise exception 'This mix was already undone' using errcode = 'check_violation'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'check_violation'; end if;

  -- the mix first: refused by the stock guard when part of it has been eaten already
  for r in select * from public.inventory_transactions where idempotency_key = 'feed-mix:' || p_batch_id || ':out' loop
    begin
      insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, reverses_id, created_by)
      values (r.item_id, 'consumption', 'purchase_reversal', r.qty, r.recorded_at, 'Mix undone: ' || p_reason,
              'feed-mix:' || p_batch_id || ':undo:out', r.id, auth.uid());
    exception when check_violation then
      raise exception 'Part of this mix has already been fed, so it cannot be undone. Use a count check instead.'
        using errcode = 'check_violation';
    end;
  end loop;
  for r in select * from public.inventory_transactions where idempotency_key like 'feed-mix:' || p_batch_id || ':in:%' loop
    insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, reverses_id, created_by)
    values (r.item_id, 'purchase', 'consumption_reversal', r.qty, r.recorded_at, 'Mix undone: ' || p_reason,
            'feed-mix:' || p_batch_id || ':undo:in:' || r.item_id, r.id, auth.uid());
  end loop;
  update public.feed_mix_batches set undone_at = now(), undone_by = auth.uid(), undo_reason = p_reason where id = p_batch_id;
end $$;

revoke all on function public.produce_feed_mix(uuid, uuid, date, jsonb, uuid, numeric, text) from public, anon;
revoke all on function public.undo_feed_mix(uuid, text) from public, anon;
grant execute on function public.produce_feed_mix(uuid, uuid, date, jsonb, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.undo_feed_mix(uuid, text) to authenticated, service_role;

-- ── 5. Daily deduction: top a day up to its planned amount ─────────────────
-- p_rows = [{"line_id":…, "date":…, "qty": planned for that day}]; what is already posted for
-- that line and day is subtracted here, under the item lock, so two page loads never post twice.
create or replace function public.post_feed_auto_usage(
  p_business_id uuid, p_rows jsonb, p_period_ids uuid[], p_through date
) returns int language plpgsql security definer set search_path = public as $$
declare r record; v_balance numeric; v_qty numeric; v_done numeric; v_k int; v_n int := 0; v_through date; v_lock date;
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
    select coalesce(sum(case when t.type = 'consumption' then t.qty else -t.qty end), 0), count(*) filter (where t.idempotency_key like 'auto:%')
      into v_done, v_k
    from public.inventory_transactions t where t.period_line_id = r.line_id and t.recorded_at = r.d;
    select coalesce(sum(case when type = 'purchase' then qty else -qty end), 0) into v_balance
    from public.inventory_transactions where item_id = r.item_id;
    v_qty := round(least(r.qty - v_done, greatest(v_balance, 0)), 4);    -- the rest of the day, never below zero stock
    continue when v_qty <= 0.0001;
    insert into public.inventory_transactions
      (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, period_line_id, created_by)
    values (r.item_id, 'consumption', 'consumption', v_qty, r.d,
            'Auto: daily feed (final at count)',
            'auto:' || r.line_id || ':' || r.d || case when v_k > 0 then ':' || (v_k + 1) else '' end, r.line_id, auth.uid())
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;

  update public.feed_usage_periods
  set auto_posted_through = greatest(coalesce(auto_posted_through, start_date - 1), least(v_through, public.feed_today() - 1))
  where id = any(coalesce(p_period_ids, '{}')) and business_id = p_business_id and status = 'open' and start_date <= v_through;
  return v_n;
end $$;

-- a stock-in dated in the past (late purchase, late mix, count-in) re-opens those days of the
-- item's running periods, so days that were short of stock are completed
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
  if new.type = 'purchase' then
    update public.feed_usage_periods p
    set auto_posted_through = new.recorded_at::date - 1
    where p.status = 'open' and p.auto_posted_through is not null and p.auto_posted_through >= new.recorded_at::date
      and exists (select 1 from public.feed_usage_period_lines l where l.period_id = p.id and l.item_id = new.item_id);
  end if;
  return null;
end $$;

commit;
