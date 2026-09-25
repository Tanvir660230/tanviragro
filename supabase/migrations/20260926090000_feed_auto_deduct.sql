-- ============================================================================
-- Feed in use is deducted every day; the count adjusts it. Weight-based feeding chart.
-- Plan: docs/FEED_AUTO_DEDUCT_PLAN.md. Rollback: supabase/rollback/20260926090000_feed_auto_deduct_down.sql
--
--   feeding chart  → per feed/recipe, one row per weight band: amount per head per day
--                    (target unit) or % of live weight; versioned by effective_from
--   open period    → the app posts one consumption row per line per completed day
--                    (key auto:<line>:<date>), from the chart / rule / learned usage,
--                    never more than the stock on hand
--   close / count  → actual = stock available at the end − count (unchanged); the line's
--                    postings are brought to exactly that with ONE difference row
--                    (extra consumption, or reversals of the latest auto rows); auto rows
--                    dated after the end date are reversed. History is never deleted.
--   count & continue → close at the count date and start the same feed the next day
-- Requires 20260925130000 (usage periods). Additive and idempotent.
-- ============================================================================
begin;

-- ── 1. Feeding chart ────────────────────────────────────────────────────────
create table if not exists public.feed_charts (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id),
  target_type    text not null check (target_type in ('item', 'recipe')),
  item_id        uuid references public.inventory_items(id),
  recipe_id      uuid references public.feed_recipes(id),
  effective_from date not null,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  constraint feed_charts_target_chk check (
    (target_type = 'item' and item_id is not null and recipe_id is null) or
    (target_type = 'recipe' and recipe_id is not null and item_id is null))
);
create unique index if not exists uq_feed_charts_version
  on public.feed_charts (business_id, target_type, coalesce(item_id, recipe_id), effective_from);
comment on table public.feed_charts is
  'Feeding chart version for one feed item or recipe, valid from effective_from until the next version.';

create table if not exists public.feed_chart_bands (
  id       uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.feed_charts(id) on delete cascade,
  min_kg   numeric not null check (min_kg >= 0),
  max_kg   numeric check (max_kg is null or max_kg > min_kg),
  amount   numeric not null check (amount >= 0),
  basis    text not null check (basis in ('per_head', 'pct_bw')),
  unique (chart_id, min_kg)
);
comment on column public.feed_chart_bands.amount is
  'per_head: quantity per animal per day in the target''s unit (recipe = kg of mix); pct_bw: % of live weight (kg) per day.';

alter table public.feed_charts enable row level security;
alter table public.feed_chart_bands enable row level security;
drop policy if exists "feed charts readable by tenant" on public.feed_charts;
create policy "feed charts readable by tenant" on public.feed_charts for select using (
  business_id in (select id from public.businesses where owner_id = auth.uid()
                  union select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)));
drop policy if exists "feed chart bands readable by tenant" on public.feed_chart_bands;
create policy "feed chart bands readable by tenant" on public.feed_chart_bands for select using (
  chart_id in (select id from public.feed_charts));

-- Save a chart version. Same target + same effective date = that version is replaced.
-- p_bands = [{"min_kg":0,"max_kg":180,"amount":1.5,"basis":"pct_bw"}, …] (contiguous, last max may be null)
create or replace function public.save_feed_chart(
  p_business_id uuid, p_target_type text, p_target_id uuid, p_effective_from date,
  p_bands jsonb, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; b record; v_prev_max numeric; v_n int := 0; v_unit text; v_kgpu numeric;
begin
  if not public.feed_can_write_business(p_business_id) then
    raise exception 'Not allowed for this business' using errcode = '42501';
  end if;
  if p_effective_from is null then raise exception 'Choose the date the chart starts' using errcode = 'check_violation'; end if;
  if p_target_type = 'item' then
    select unit, kg_per_unit into v_unit, v_kgpu from public.inventory_items
    where id = p_target_id and business_id = p_business_id and deleted_at is null;
    if not found then raise exception 'Feed item not found' using errcode = '42501'; end if;
  elsif p_target_type = 'recipe' then
    if not exists (select 1 from public.feed_recipes where id = p_target_id and business_id = p_business_id and deleted_at is null) then
      raise exception 'Recipe not found' using errcode = '42501';
    end if;
  else
    raise exception 'Unknown target type %', p_target_type using errcode = 'check_violation';
  end if;

  -- validate: sorted, contiguous, no overlap, only the last band open-ended
  for b in
    select (e->>'min_kg')::numeric as min_kg, nullif(e->>'max_kg', '')::numeric as max_kg,
           (e->>'amount')::numeric as amount, e->>'basis' as basis
    from jsonb_array_elements(coalesce(p_bands, '[]'::jsonb)) e
    order by (e->>'min_kg')::numeric
  loop
    v_n := v_n + 1;
    if b.min_kg is null or b.min_kg < 0 or b.amount is null or b.amount < 0 or b.basis not in ('per_head', 'pct_bw') then
      raise exception 'Every row needs a weight from, an amount (0 or more) and a type' using errcode = 'check_violation';
    end if;
    if v_n = 1 and b.min_kg <> 0 then
      raise exception 'The first row must start at 0 kg' using errcode = 'check_violation';
    end if;
    if v_n > 1 and (v_prev_max is null or b.min_kg <> v_prev_max) then
      raise exception 'Weight rows must follow each other without gaps or overlaps (next row starts at %)', coalesce(v_prev_max::text, 'the end') using errcode = 'check_violation';
    end if;
    if b.max_kg is not null and b.max_kg <= b.min_kg then
      raise exception 'Weight to must be more than weight from' using errcode = 'check_violation';
    end if;
    if b.basis = 'pct_bw' and p_target_type = 'item' and lower(btrim(v_unit)) <> 'kg' and coalesce(v_kgpu, 0) <= 0 then
      raise exception '%% of weight needs kg per % set on the item — or use an amount per head', v_unit using errcode = 'check_violation';
    end if;
    v_prev_max := b.max_kg;
  end loop;
  if v_n = 0 then raise exception 'Add at least one weight row' using errcode = 'check_violation'; end if;
  if v_prev_max is not null then
    raise exception 'Leave the last row''s "weight to" empty so every animal is covered' using errcode = 'check_violation';
  end if;

  select id into v_id from public.feed_charts
  where business_id = p_business_id and target_type = p_target_type
    and coalesce(item_id, recipe_id) = p_target_id and effective_from = p_effective_from;
  if found then
    delete from public.feed_chart_bands where chart_id = v_id;
    update public.feed_charts set notes = p_notes, created_at = now(), created_by = auth.uid() where id = v_id;
  else
    insert into public.feed_charts (business_id, target_type, item_id, recipe_id, effective_from, notes)
    values (p_business_id, p_target_type,
            case when p_target_type = 'item' then p_target_id end,
            case when p_target_type = 'recipe' then p_target_id end,
            p_effective_from, p_notes)
    returning id into v_id;
  end if;
  insert into public.feed_chart_bands (chart_id, min_kg, max_kg, amount, basis)
  select v_id, (e->>'min_kg')::numeric, nullif(e->>'max_kg', '')::numeric, (e->>'amount')::numeric, e->>'basis'
  from jsonb_array_elements(p_bands) e;
  perform public.feed_reset_auto_progress(p.id) from public.feed_usage_periods p
  where p.business_id = p_business_id and p.status = 'open' and p.target_type = p_target_type
    and coalesce(p.item_id, p.recipe_id) = p_target_id;
  return v_id;
end $$;

-- Remove one chart version (earlier versions apply again). Days already posted are not changed.
create or replace function public.delete_feed_chart(p_chart_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select business_id, target_type, coalesce(item_id, recipe_id) as target_id into c from public.feed_charts where id = p_chart_id;
  if not found then raise exception 'Chart not found' using errcode = 'P0002'; end if;
  if not public.feed_can_write_business(c.business_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from public.feed_charts where id = p_chart_id;
  perform public.feed_reset_auto_progress(p.id) from public.feed_usage_periods p
  where p.business_id = c.business_id and p.status = 'open' and p.target_type = c.target_type
    and coalesce(p.item_id, p.recipe_id) = c.target_id;
end $$;

-- ── 2. Periods: chart rule, auto-posting progress, new event kinds ───────────
alter table public.feed_usage_periods drop constraint if exists feed_usage_periods_rule_type_check;
alter table public.feed_usage_periods add constraint feed_usage_periods_rule_type_check
  check (rule_type in ('weight_share', 'pct_live_weight', 'per_head', 'chart'));
alter table public.feed_usage_periods drop constraint if exists feed_usage_periods_rule_chk;
alter table public.feed_usage_periods add constraint feed_usage_periods_rule_chk
  check ((rule_type in ('weight_share', 'chart')) = (rule_value is null) and (rule_value is null or rule_value > 0));
alter table public.feed_usage_periods add column if not exists auto_posted_through date;
comment on column public.feed_usage_periods.auto_posted_through is
  'Open period: last day whose automatic daily consumption has been posted.';

-- The rule or the chart changed: every day of the open period without an automatic row yet
-- (e.g. started before its chart existed) is posted again with the new figures. Days that
-- already have a row are never posted twice (the app skips them; the key is unique).
create or replace function public.feed_reset_auto_progress(p_period_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.feed_usage_periods set auto_posted_through = null where id = p_period_id and status = 'open'
$$;
revoke all on function public.feed_reset_auto_progress(uuid) from public, anon, authenticated;
alter table public.feed_usage_period_events drop constraint if exists feed_usage_period_events_action_check;
alter table public.feed_usage_period_events add constraint feed_usage_period_events_action_check
  check (action in ('open', 'close', 'correct', 'reopen', 'cancel', 'reconcile', 'rule', 'checkpoint'));

-- ── 3. Daily automatic posting ──────────────────────────────────────────────
-- p_rows = [{"line_id":…, "date":"YYYY-MM-DD", "qty":…}] computed by the app's feed engine.
-- p_period_ids / p_through: these open periods are now posted through p_through (≤ yesterday).
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

-- ── 4. Reconciliation: lines with automatic rows are corrected by the difference ──
create or replace function public.reconcile_feed_usage_period(p_period_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  p record; l record; v_post record;
  v_available numeric; v_consumed numeric; v_target numeric;
  v_posted_qty numeric; v_posted_value numeric; v_wac numeric; v_n int;
  v_status text := 'closed'; v_changed boolean := false; v_row_cost numeric;
  v_auto boolean; v_delta numeric; v_left numeric; v_take numeric;
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
    v_auto     := exists (select 1 from public.inventory_transactions t
                          where t.period_line_id = l.id and t.idempotency_key like 'auto:%');

    if v_auto then
      -- (a) automatic rows dated after the end date: the period ended earlier — undo what is left of them
      for v_post in
        select t.id, t.item_id, t.qty, t.unit_cost, t.recorded_at,
               t.qty - coalesce((select sum(r.qty) from public.inventory_transactions r where r.reverses_id = t.id), 0) as remaining
        from public.inventory_transactions t
        where t.period_line_id = l.id and t.type = 'consumption' and t.recorded_at::date > p.end_date
      loop
        continue when v_post.remaining <= 0.0001;
        v_changed := true;
        select count(*) + 1 into v_n from public.inventory_transactions where reverses_id = v_post.id;
        insert into public.inventory_transactions
          (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes,
           idempotency_key, reverses_id, period_line_id, created_by)
        values (v_post.item_id, 'purchase', 'consumption_reversal', round(v_post.remaining, 4), v_post.unit_cost, 'correction',
                v_post.recorded_at, 'Usage period ended on ' || p.end_date || ': later automatic feed undone',
                'period-line:' || l.id || ':rev:' || v_post.id || ':' || v_n, v_post.id, l.id, auth.uid());
      end loop;

      -- (b) bring the line's net posting to exactly the actual use, with one difference
      select coalesce(sum(case when t.type = 'consumption' then t.qty else -t.qty end), 0) into v_posted_qty
      from public.inventory_transactions t where t.period_line_id = l.id;
      v_delta := round(v_target - v_posted_qty, 4);
      if v_delta > 0.0001 then
        v_changed := true;
        select count(*) + 1 into v_n from public.inventory_transactions where period_line_id = l.id and type = 'consumption';
        insert into public.inventory_transactions
          (item_id, type, movement_type, qty, recorded_at, notes, idempotency_key, period_line_id, created_by)
        values (l.item_id, 'consumption', 'consumption', v_delta, p.end_date,
                'Count adjustment: more used than deducted daily (' || p.start_date || ' → ' || p.end_date || ')',
                'period-line:' || l.id || ':adj:' || v_n, l.id, auth.uid());
      elsif v_delta < -0.0001 then
        v_changed := true;
        v_left := -v_delta;
        -- give back from the latest postings first, each reversal at that row's own cost
        for v_post in
          select t.id, t.item_id, t.unit_cost, t.recorded_at,
                 t.qty - coalesce((select sum(r.qty) from public.inventory_transactions r where r.reverses_id = t.id), 0) as remaining
          from public.inventory_transactions t
          where t.period_line_id = l.id and t.type = 'consumption'
          order by t.recorded_at desc, t.created_at desc
        loop
          exit when v_left <= 0.0001;
          continue when v_post.remaining <= 0.0001;
          v_take := round(least(v_left, v_post.remaining), 4);
          select count(*) + 1 into v_n from public.inventory_transactions where reverses_id = v_post.id;
          insert into public.inventory_transactions
            (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes,
             idempotency_key, reverses_id, period_line_id, created_by)
          values (v_post.item_id, 'purchase', 'consumption_reversal', v_take, v_post.unit_cost, 'correction',
                  v_post.recorded_at, 'Count adjustment: less used than deducted daily — returned to stock',
                  'period-line:' || l.id || ':rev:' || v_post.id || ':' || v_n, v_post.id, l.id, auth.uid());
          v_left := v_left - v_take;
        end loop;
      end if;
    else
      -- no automatic rows: one posting for the whole period, valued at the end date (unchanged)
      select coalesce(sum(case when t.type = 'consumption' then t.qty else -t.qty end), 0),
             coalesce(sum(case when t.type = 'consumption' then 1 else -1 end * t.qty * coalesce(t.unit_cost, 0)), 0)
        into v_posted_qty, v_posted_value
      from public.inventory_transactions t where t.period_line_id = l.id;

      if abs(v_posted_qty - v_target) > 0.0001
         or abs(v_posted_value - v_target * coalesce(v_wac, 0)) > 0.01 then
        v_changed := true;
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
    end if;

    select coalesce(sum(case when t.type = 'consumption' then t.qty else -t.qty end), 0),
           coalesce(sum(case when t.type = 'consumption' then 1 else -1 end * t.qty * coalesce(t.unit_cost, 0)), 0)
      into v_posted_qty, v_posted_value
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

-- ── 5. Change the rule of a running period (days already posted stay) ────────
create or replace function public.set_feed_usage_rule(p_period_id uuid, p_rule_type text, p_rule_value numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.feed_usage_periods where id = p_period_id for update;
  if not found then raise exception 'Usage period not found' using errcode = 'P0002'; end if;
  if not public.feed_can_write_business(p.business_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p.status <> 'open' then raise exception 'Only a running period''s rule can be changed' using errcode = 'check_violation'; end if;
  update public.feed_usage_periods
  set rule_type = p_rule_type, rule_value = case when p_rule_type in ('weight_share', 'chart') then null else p_rule_value end
  where id = p_period_id;
  perform public.feed_reset_auto_progress(p_period_id);
  insert into public.feed_usage_period_events (period_id, action, detail)
  values (p_period_id, 'rule', jsonb_build_object('from', p.rule_type, 'from_value', p.rule_value, 'to', p_rule_type, 'to_value', p_rule_value));
end $$;

-- ── 6. Count & continue: close at the count date, same feed again from the next day ──
create or replace function public.checkpoint_feed_usage_period(p_period_id uuid, p_date date, p_closing jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; v_status text; v_id uuid; l record;
begin
  select * into p from public.feed_usage_periods where id = p_period_id;
  if not found then raise exception 'Usage period not found' using errcode = 'P0002'; end if;
  if p.status <> 'open' then raise exception 'Only a running period can be counted' using errcode = 'check_violation'; end if;
  v_status := public.close_feed_usage_period(p_period_id, p_date, p_closing, null);   -- checks access + dates

  insert into public.feed_usage_periods (business_id, target_type, item_id, recipe_id, start_date, rule_type, rule_value, notes, idempotency_key)
  values (p.business_id, p.target_type, p.item_id, p.recipe_id, p_date + 1, p.rule_type, p.rule_value, p.notes,
          'checkpoint:' || p_period_id)
  returning id into v_id;
  for l in select item_id, share from public.feed_usage_period_lines where period_id = p_period_id loop
    perform public.feed_assert_no_overlap(l.item_id, p_date + 1, null, v_id);
    insert into public.feed_usage_period_lines (period_id, item_id, share) values (v_id, l.item_id, l.share);
  end loop;
  insert into public.feed_usage_period_events (period_id, action, detail)
  values (p_period_id, 'checkpoint', jsonb_build_object('date', p_date, 'status', v_status, 'next_period', v_id)),
         (v_id, 'open', jsonb_build_object('start_date', p_date + 1, 'continues', p_period_id, 'rule_type', p.rule_type, 'rule_value', p.rule_value));
  return v_id;
end $$;

revoke all on function public.save_feed_chart(uuid, text, uuid, date, jsonb, text) from public, anon;
revoke all on function public.delete_feed_chart(uuid) from public, anon;
revoke all on function public.post_feed_auto_usage(uuid, jsonb, uuid[], date) from public, anon;
revoke all on function public.set_feed_usage_rule(uuid, text, numeric) from public, anon;
revoke all on function public.checkpoint_feed_usage_period(uuid, date, jsonb) from public, anon;
revoke all on function public.reconcile_feed_usage_period(uuid) from public, anon, authenticated;
grant execute on function public.save_feed_chart(uuid, text, uuid, date, jsonb, text) to authenticated, service_role;
grant execute on function public.delete_feed_chart(uuid) to authenticated, service_role;
grant execute on function public.post_feed_auto_usage(uuid, jsonb, uuid[], date) to authenticated, service_role;
grant execute on function public.set_feed_usage_rule(uuid, text, numeric) to authenticated, service_role;
grant execute on function public.checkpoint_feed_usage_period(uuid, date, jsonb) to authenticated, service_role;

-- ── 7. Read model: expose the auto-posting progress ─────────────────────────
create or replace view public.v_feed_usage_lines with (security_invoker = true) as
select l.id as line_id, p.id as period_id, p.business_id, p.target_type, p.item_id as period_item_id, p.recipe_id,
       p.start_date, p.end_date, p.status, p.rule_type, p.rule_value,
       l.item_id, i.name as item_name, i.unit, i.category, i.kg_per_unit, l.share,
       l.closing_qty, l.available_qty, l.consumed_qty, l.gap_qty, l.consumed_value, l.cost_missing,
       (coalesce(p.end_date, public.feed_today()) - p.start_date + 1) as days,
       case when p.end_date is not null and l.consumed_qty is not null
            then round(l.consumed_qty / (p.end_date - p.start_date + 1), 4) end as actual_daily_qty,
       p.auto_posted_through
from public.feed_usage_period_lines l
join public.feed_usage_periods p on p.id = l.period_id
join public.inventory_items i on i.id = l.item_id
where p.status <> 'cancelled';

commit;
