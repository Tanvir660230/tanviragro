-- ============================================================================
-- Feed usage periods: feed is eaten continuously between a start and an end date.
-- Design: docs/FEED_USAGE_ARCHITECTURE.md. Rollback: supabase/rollback/20260925130000_feed_usage_periods_down.sql
--
--   open period   → nothing is posted; the app shows a running ESTIMATE
--   close period  → closing count entered; consumed = stock available at the end date
--                   − closing count, posted as ONE consumption row (ACTUAL), valued at WAC
--   late entries  → any movement dated inside / before a closed period re-reconciles it
--                   automatically (old posting reversed, correct one posted — audited),
--                   so entering a purchase late gives the same result as entering it on time
--   count > stock → nothing invented: the period is 'unreconciled' with the exact gap
-- Requires 20260925100000 (ledger). Additive and idempotent.
-- ============================================================================
begin;

-- ── 1. Tables ────────────────────────────────────────────────────────────────
create table if not exists public.feed_usage_periods (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id),
  target_type     text not null check (target_type in ('item', 'recipe')),
  item_id         uuid references public.inventory_items(id),
  recipe_id       uuid references public.feed_recipes(id),     -- no cascade: a used recipe cannot be deleted
  start_date      date not null,
  end_date        date,
  status          text not null default 'open' check (status in ('open', 'closed', 'unreconciled', 'cancelled')),
  rule_type       text not null default 'weight_share' check (rule_type in ('weight_share', 'pct_live_weight', 'per_head')),
  rule_value      numeric,
  notes           text,
  idempotency_key text unique,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  closed_at       timestamptz,
  closed_by       uuid,
  constraint feed_usage_periods_target_chk check (
    (target_type = 'item' and item_id is not null and recipe_id is null) or
    (target_type = 'recipe' and recipe_id is not null and item_id is null)),
  constraint feed_usage_periods_dates_chk check (end_date is null or end_date >= start_date),
  constraint feed_usage_periods_rule_chk check ((rule_type = 'weight_share') = (rule_value is null) and (rule_value is null or rule_value > 0)),
  constraint feed_usage_periods_open_chk check ((status = 'open') = (end_date is null) or status = 'cancelled')
);
create index if not exists idx_feed_usage_periods_biz on public.feed_usage_periods (business_id, status, start_date);
comment on table public.feed_usage_periods is
  'Feed in continuous use from start_date to end_date. Open = running estimate (nothing posted); closed = actual, reconciled from the closing count.';
comment on column public.feed_usage_periods.rule_type is
  'How the period is split between animals and days: weight_share (by live weight), pct_live_weight (rule_value % of live weight per day), per_head (rule_value units per head per day).';

create table if not exists public.feed_usage_period_lines (
  id             uuid primary key default gen_random_uuid(),
  period_id      uuid not null references public.feed_usage_periods(id) on delete restrict,
  item_id        uuid not null references public.inventory_items(id),
  share          numeric not null check (share > 0 and share <= 1),   -- recipe share snapshot (1 for an item period)
  closing_qty    numeric check (closing_qty is null or closing_qty >= 0),
  available_qty  numeric,       -- stock available on the end date (excluding this line's own postings)
  consumed_qty   numeric,       -- posted (actual) consumption
  gap_qty        numeric,       -- closing count above recorded stock (a stock-in probably not entered yet)
  consumed_value numeric,
  cost_missing   boolean not null default false,
  reconciled_at  timestamptz,
  unique (period_id, item_id)
);
create index if not exists idx_feed_usage_lines_item on public.feed_usage_period_lines (item_id);

create table if not exists public.feed_usage_period_events (
  id         uuid primary key default gen_random_uuid(),
  period_id  uuid not null references public.feed_usage_periods(id),
  action     text not null check (action in ('open', 'close', 'correct', 'reopen', 'cancel', 'reconcile')),
  detail     jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists idx_feed_usage_events_period on public.feed_usage_period_events (period_id, created_at);

-- postings link back to their period line
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_tx_period_line_fk') then
    alter table public.inventory_transactions add constraint inventory_tx_period_line_fk
      foreign key (period_line_id) references public.feed_usage_period_lines(id);
  end if;
end $$;
create index if not exists idx_inventory_tx_period_line on public.inventory_transactions (period_line_id) where period_line_id is not null;

-- RLS: tenants read; all writes go through the functions below (security definer + explicit checks)
alter table public.feed_usage_periods enable row level security;
alter table public.feed_usage_period_lines enable row level security;
alter table public.feed_usage_period_events enable row level security;
drop policy if exists "usage periods readable by tenant" on public.feed_usage_periods;
create policy "usage periods readable by tenant" on public.feed_usage_periods for select using (
  business_id in (select id from public.businesses where owner_id = auth.uid()
                  union select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)));
drop policy if exists "usage lines readable by tenant" on public.feed_usage_period_lines;
create policy "usage lines readable by tenant" on public.feed_usage_period_lines for select using (
  period_id in (select id from public.feed_usage_periods));
drop policy if exists "usage events readable by tenant" on public.feed_usage_period_events;
create policy "usage events readable by tenant" on public.feed_usage_period_events for select using (
  period_id in (select id from public.feed_usage_periods));

-- ── 2. Helpers ───────────────────────────────────────────────────────────────
create or replace function public.feed_can_write_business(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- no user: only the service role or a direct database session (migrations, SQL editor).
  -- (current_user is the function owner inside security definer, so it must not be used here)
  select case
    when auth.uid() is null then coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin')
    else exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid())
      or exists (select 1 from public.business_users where business_id = p_business_id and user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true))
  end
$$;

create or replace function public.feed_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Dhaka')::date   -- the farm's calendar day
$$;

-- one item may be in only one (non-cancelled) period at any date
create or replace function public.feed_assert_no_overlap(p_item_id uuid, p_start date, p_end date, p_exclude uuid)
returns void language plpgsql stable as $$
declare v_conflict record;
begin
  select p.start_date, p.end_date into v_conflict
  from public.feed_usage_period_lines l join public.feed_usage_periods p on p.id = l.period_id
  where l.item_id = p_item_id and p.status <> 'cancelled' and p.id is distinct from p_exclude
    and daterange(p.start_date, coalesce(p.end_date, 'infinity'::date), '[]')
        && daterange(p_start, coalesce(p_end, 'infinity'::date), '[]')
  limit 1;
  if found then
    raise exception 'This feed is already in a usage period from % to % — end that period first',
      v_conflict.start_date, coalesce(v_conflict.end_date::text, 'now') using errcode = 'exclusion_violation';
  end if;
end $$;

-- ── 3. Reconciliation (the only place a period posts to the ledger) ─────────
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

-- every closed period of these items that ends on/after p_from, earliest first
create or replace function public.reconcile_feed_usage_from(p_item_id uuid, p_from date) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  for v_id in
    select p.id from public.feed_usage_periods p
    where p.status in ('closed', 'unreconciled') and p.end_date >= p_from
      and exists (select 1 from public.feed_usage_period_lines l where l.period_id = p.id and l.item_id = p_item_id)
    order by p.end_date, p.start_date
  loop
    perform public.reconcile_feed_usage_period(v_id);
  end loop;
end $$;

-- late / back-dated movements re-reconcile the closed periods they affect
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
drop trigger if exists trg_inventory_tx_reconcile_periods on public.inventory_transactions;
create trigger trg_inventory_tx_reconcile_periods
  after insert or update of qty, unit_cost, recorded_at, item_id on public.inventory_transactions
  for each row execute function public.trg_inventory_tx_reconcile_periods();

-- ── 4. Actions ───────────────────────────────────────────────────────────────
create or replace function public.open_feed_usage_period(
  p_business_id uuid, p_target_type text, p_target_id uuid, p_start date,
  p_rule_type text default 'weight_share', p_rule_value numeric default null,
  p_notes text default null, p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sum numeric; r record;
begin
  if not public.feed_can_write_business(p_business_id) then
    raise exception 'Not allowed for this business' using errcode = '42501';
  end if;
  if p_idempotency_key is not null then
    select id into v_id from public.feed_usage_periods where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  if p_start is null or p_start > public.feed_today() then
    raise exception 'Start date must be today or earlier' using errcode = 'check_violation';
  end if;

  if p_target_type = 'item' then
    if not exists (select 1 from public.inventory_items where id = p_target_id and business_id = p_business_id and deleted_at is null) then
      raise exception 'Feed item not found' using errcode = '42501';
    end if;
    perform public.feed_assert_no_overlap(p_target_id, p_start, null, null);
    insert into public.feed_usage_periods (business_id, target_type, item_id, start_date, rule_type, rule_value, notes, idempotency_key)
    values (p_business_id, 'item', p_target_id, p_start, p_rule_type, p_rule_value, p_notes, p_idempotency_key)
    returning id into v_id;
    insert into public.feed_usage_period_lines (period_id, item_id, share) values (v_id, p_target_id, 1);
  elsif p_target_type = 'recipe' then
    if not exists (select 1 from public.feed_recipes where id = p_target_id and business_id = p_business_id and deleted_at is null) then
      raise exception 'Recipe not found' using errcode = '42501';
    end if;
    select sum(qty_per_batch) into v_sum from public.recipe_ingredients where recipe_id = p_target_id;
    if coalesce(v_sum, 0) <= 0 then raise exception 'Recipe has no ingredients' using errcode = 'check_violation'; end if;
    insert into public.feed_usage_periods (business_id, target_type, recipe_id, start_date, rule_type, rule_value, notes, idempotency_key)
    values (p_business_id, 'recipe', p_target_id, p_start, p_rule_type, p_rule_value, p_notes, p_idempotency_key)
    returning id into v_id;
    for r in select item_id, sum(qty_per_batch) as q from public.recipe_ingredients where recipe_id = p_target_id group by item_id loop
      perform public.feed_assert_no_overlap(r.item_id, p_start, null, v_id);
      insert into public.feed_usage_period_lines (period_id, item_id, share) values (v_id, r.item_id, round(r.q / v_sum, 6));
    end loop;
  else
    raise exception 'Unknown target type %', p_target_type using errcode = 'check_violation';
  end if;

  insert into public.feed_usage_period_events (period_id, action, detail)
  values (v_id, 'open', jsonb_build_object('start_date', p_start, 'rule_type', p_rule_type, 'rule_value', p_rule_value));
  return v_id;
end $$;

-- Close (first time) or correct (already closed: needs a reason). p_closing = [{"item_id":…, "qty":…}]
create or replace function public.close_feed_usage_period(
  p_period_id uuid, p_end_date date, p_closing jsonb, p_reason text default null
) returns text language plpgsql security definer set search_path = public as $$
declare p record; l record; v_qty numeric; v_status text; v_action text;
begin
  select * into p from public.feed_usage_periods where id = p_period_id for update;
  if not found then raise exception 'Usage period not found' using errcode = 'P0002'; end if;
  if not public.feed_can_write_business(p.business_id) then
    raise exception 'Not allowed for this business' using errcode = '42501';
  end if;
  if p.status = 'cancelled' then raise exception 'This period was cancelled' using errcode = 'check_violation'; end if;
  if p_end_date is null or p_end_date < p.start_date then
    raise exception 'End date must be on or after the start date (%)', p.start_date using errcode = 'check_violation';
  end if;
  if p_end_date > public.feed_today() then
    raise exception 'End date cannot be in the future' using errcode = 'check_violation';
  end if;
  v_action := case when p.status = 'open' then 'close' else 'correct' end;
  if v_action = 'correct' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to correct a closed period' using errcode = 'check_violation';
  end if;

  for l in select * from public.feed_usage_period_lines where period_id = p_period_id loop
    perform public.feed_assert_no_overlap(l.item_id, p.start_date, p_end_date, p_period_id);
    select (e->>'qty')::numeric into v_qty
    from jsonb_array_elements(coalesce(p_closing, '[]'::jsonb)) e where (e->>'item_id')::uuid = l.item_id;
    if v_qty is null or v_qty < 0 then
      raise exception 'Enter the remaining quantity (0 if finished) for every item of the period' using errcode = 'check_violation';
    end if;
    update public.feed_usage_period_lines set closing_qty = v_qty where id = l.id;
  end loop;

  update public.feed_usage_periods
  set end_date = p_end_date, status = 'closed', closed_at = coalesce(closed_at, now()), closed_by = coalesce(closed_by, auth.uid())
  where id = p_period_id;

  insert into public.feed_usage_period_events (period_id, action, detail)
  values (p_period_id, v_action, jsonb_build_object('end_date', p_end_date, 'closing', p_closing, 'reason', p_reason,
                                                     'previous_end_date', p.end_date));

  v_status := public.reconcile_feed_usage_period(p_period_id);
  -- later closed periods of the same items depend on this one's posting
  for l in select item_id from public.feed_usage_period_lines where period_id = p_period_id loop
    perform public.reconcile_feed_usage_from(l.item_id, p_end_date + 1);
  end loop;
  select status into v_status from public.feed_usage_periods where id = p_period_id;
  return v_status;
end $$;

-- Cancel an OPEN period started by mistake (nothing was posted; kept for audit)
create or replace function public.cancel_feed_usage_period(p_period_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.feed_usage_periods where id = p_period_id for update;
  if not found then raise exception 'Usage period not found' using errcode = 'P0002'; end if;
  if not public.feed_can_write_business(p.business_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p.status <> 'open' then raise exception 'Only an open period can be cancelled; correct a closed one instead' using errcode = 'check_violation'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = 'check_violation'; end if;
  update public.feed_usage_periods set status = 'cancelled' where id = p_period_id;
  insert into public.feed_usage_period_events (period_id, action, detail) values (p_period_id, 'cancel', jsonb_build_object('reason', p_reason));
end $$;

revoke all on function public.open_feed_usage_period(uuid, text, uuid, date, text, numeric, text, text) from public, anon;
revoke all on function public.close_feed_usage_period(uuid, date, jsonb, text) from public, anon;
revoke all on function public.cancel_feed_usage_period(uuid, text) from public, anon;
revoke all on function public.reconcile_feed_usage_period(uuid) from public, anon, authenticated;
revoke all on function public.reconcile_feed_usage_from(uuid, date) from public, anon, authenticated;
grant execute on function public.open_feed_usage_period(uuid, text, uuid, date, text, numeric, text, text) to authenticated, service_role;
grant execute on function public.close_feed_usage_period(uuid, date, jsonb, text) to authenticated, service_role;
grant execute on function public.cancel_feed_usage_period(uuid, text) to authenticated, service_role;

-- ── 5. Read model ────────────────────────────────────────────────────────────
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

commit;
