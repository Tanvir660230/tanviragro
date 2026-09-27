-- ============================================================================
-- Cattle bought together / sold together at one price.
--
-- The group row holds the fact (total paid or received, date, seller/buyer); each animal
-- carries its SHARE in the columns every report already reads:
--   cattle.purchase_price   = its share of the purchase group's total
--   sales.sale_price_total  = its share of the sale group's total
-- so profit per animal, the Money page, the cash ledger and the partners' split keep working
-- unchanged, and old records (no group) are untouched.
--
-- Invariant, checked inside every function below: the shares add up to the group's total
-- exactly. How a share is decided (weight at the deal / weigh-in / estimate / equal /
-- manual) is src/lib/cattle/cost-split.ts; the chosen basis is stored on the group, and
-- every re-split is appended to purchase group's history.
--
-- All functions are SECURITY INVOKER: row-level security applies to every row they touch,
-- and each also checks membership (feed_can_write_business) and the financial lock.
-- Rollback: supabase/rollback/20260928110000_cattle_groups_down.sql
-- ============================================================================
begin;

create table if not exists public.cattle_purchase_groups (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  purchased_on  date not null,
  total_price   numeric(14,2) not null check (total_price >= 0),
  seller        text,
  method        text not null check (method in ('weight', 'equal', 'manual')),
  basis         text not null,
  note          text,
  history       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz,
  deleted_at    timestamptz
);
create index if not exists idx_cattle_purchase_groups_business on public.cattle_purchase_groups (business_id, purchased_on);

create table if not exists public.cattle_sale_groups (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  sold_on       date not null,
  total_price   numeric(14,2) not null check (total_price > 0),
  buyer         text,
  method        text not null check (method in ('weight', 'equal', 'manual')),
  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  deleted_at    timestamptz
);
create index if not exists idx_cattle_sale_groups_business on public.cattle_sale_groups (business_id, sold_on);

alter table public.cattle add column if not exists purchase_group_id uuid references public.cattle_purchase_groups(id) on delete set null;
alter table public.sales  add column if not exists sale_group_id     uuid references public.cattle_sale_groups(id) on delete set null;
create index if not exists idx_cattle_purchase_group_id on public.cattle (purchase_group_id) where purchase_group_id is not null;
create index if not exists idx_sales_sale_group_id      on public.sales (sale_group_id) where sale_group_id is not null;

alter table public.cattle_purchase_groups enable row level security;
alter table public.cattle_sale_groups     enable row level security;
drop policy if exists "tenant members" on public.cattle_purchase_groups;
create policy "tenant members" on public.cattle_purchase_groups for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists "tenant members" on public.cattle_sale_groups;
create policy "tenant members" on public.cattle_sale_groups for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- ── the shares stay whole: an animal's share or a group sale is changed only through the group ──
-- (the group functions below switch this off for their own transaction)
create or replace function public.trg_cattle_group_share_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if old.purchase_group_id is not null and coalesce(current_setting('app.cattle_group_write', true), '') <> 'on'
     and (new.purchase_price is distinct from old.purchase_price
          or new.purchase_date is distinct from old.purchase_date
          or new.purchase_group_id is distinct from old.purchase_group_id
          or (new.deleted_at is not null and old.deleted_at is null)) then
    raise exception 'This animal was bought together with others: change its price from the "Bought together" card' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_cattle_group_share_guard on public.cattle;
create trigger trg_cattle_group_share_guard before update on public.cattle
  for each row execute function public.trg_cattle_group_share_guard();

create or replace function public.trg_sale_group_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if old.sale_group_id is not null and coalesce(current_setting('app.cattle_group_write', true), '') <> 'on'
     and (new.sale_price_total is distinct from old.sale_price_total
          or new.deleted_at is distinct from old.deleted_at
          or new.sale_group_id is distinct from old.sale_group_id) then
    raise exception 'This animal was sold together with others: undo the whole sale from the "Sold together" card' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_sale_group_guard on public.sales;
create trigger trg_sale_group_guard before update on public.sales
  for each row execute function public.trg_sale_group_guard();

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function public.cattle_group_assert(p_business_id uuid, p_day date) returns void
language plpgsql stable set search_path = public, pg_temp as $$
declare v_lock date;
begin
  if not public.feed_can_write_business(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select max(locked_until) into v_lock from public.financial_locks where business_id = p_business_id;
  if v_lock is not null and p_day <= v_lock then
    raise exception 'Records on or before % are locked', v_lock using errcode = 'P0001';
  end if;
end $$;

-- shares {id: amount} must be exactly the given ids, each >= 0, adding up to p_total
create or replace function public.cattle_group_check_shares(p_shares jsonb, p_ids uuid[], p_total numeric) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare v_sum numeric := 0; v_n int := 0; k text; v numeric;
begin
  if jsonb_typeof(p_shares) <> 'object' then raise exception 'Shares missing' using errcode = 'P0001'; end if;
  for k, v in select key, value::numeric from jsonb_each_text(p_shares) loop
    if not (k::uuid = any (p_ids)) then raise exception 'A share is for an animal outside the group' using errcode = 'P0001'; end if;
    if v < 0 then raise exception 'A share cannot be negative' using errcode = 'P0001'; end if;
    v_sum := v_sum + v; v_n := v_n + 1;
  end loop;
  if v_n <> coalesce(array_length(p_ids, 1), 0) then raise exception 'Every animal of the group needs a share' using errcode = 'P0001'; end if;
  if abs(v_sum - p_total) > 0.005 then
    raise exception 'The shares add up to % but the total is %', v_sum, p_total using errcode = 'P0001';
  end if;
end $$;

-- ── buy several animals at one price ─────────────────────────────────────────
-- p_animals: [{tag_id, breed, gender, purchase_price, initial_weight_kg, initial_weight_type, is_quarantined, notes}]
create or replace function public.create_cattle_purchase_group(
  p_business_id uuid, p_purchased_on date, p_total numeric, p_seller text,
  p_method text, p_basis text, p_note text, p_animals jsonb
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_group uuid;
  v_sum numeric;
  v_n int;
  v_out jsonb;
begin
  perform public.cattle_group_assert(p_business_id, p_purchased_on);
  if p_purchased_on > public.feed_today() then raise exception 'The purchase date is in the future' using errcode = 'P0001'; end if;
  v_n := jsonb_array_length(p_animals);
  if v_n < 1 then raise exception 'Add at least one animal' using errcode = 'P0001'; end if;
  select coalesce(sum((a ->> 'purchase_price')::numeric), 0) into v_sum from jsonb_array_elements(p_animals) a;
  if exists (select 1 from jsonb_array_elements(p_animals) a where (a ->> 'purchase_price')::numeric < 0) then
    raise exception 'A share cannot be negative' using errcode = 'P0001';
  end if;
  if abs(v_sum - p_total) > 0.005 then
    raise exception 'The shares add up to % but the total is %', v_sum, p_total using errcode = 'P0001';
  end if;

  insert into public.cattle_purchase_groups (business_id, purchased_on, total_price, seller, method, basis, note, history)
  values (p_business_id, p_purchased_on, p_total, nullif(trim(p_seller), ''), p_method, p_basis, nullif(trim(p_note), ''),
          jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'method', p_method, 'basis', p_basis, 'event', 'created')))
  returning id into v_group;

  with ins as (
    insert into public.cattle (business_id, tag_id, breed, gender, purchase_date, purchase_price,
                               initial_weight_kg, initial_weight_type, status, is_quarantined, notes, purchase_group_id)
    select p_business_id, trim(a ->> 'tag_id'), nullif(trim(a ->> 'breed'), ''), (a ->> 'gender')::public.cattle_gender,
           p_purchased_on, (a ->> 'purchase_price')::numeric,
           coalesce((a ->> 'initial_weight_kg')::numeric, 0), coalesce(a ->> 'initial_weight_type', 'unknown'),
           'active', coalesce((a ->> 'is_quarantined')::boolean, false), nullif(trim(a ->> 'notes'), ''), v_group
    from jsonb_array_elements(p_animals) a
    returning id, tag_id, purchase_price
  )
  select jsonb_agg(jsonb_build_object('id', id, 'tag_id', tag_id, 'purchase_price', purchase_price)) into v_out from ins;

  return jsonb_build_object('group_id', v_group, 'cattle', v_out);
end $$;

-- ── animals already on record, bought together: link them as one purchase ───
create or replace function public.link_cattle_purchase_group(
  p_business_id uuid, p_cattle_ids uuid[], p_total numeric, p_seller text,
  p_method text, p_basis text, p_note text, p_shares jsonb
) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare v_group uuid; v_day date; v_days int; v_found int;
begin
  if coalesce(array_length(p_cattle_ids, 1), 0) < 2 then raise exception 'Choose at least two animals' using errcode = 'P0001'; end if;
  select count(*), count(distinct purchase_date), min(purchase_date) into v_found, v_days, v_day
  from public.cattle where id = any (p_cattle_ids) and business_id = p_business_id and deleted_at is null;
  if v_found <> array_length(p_cattle_ids, 1) then raise exception 'An animal was not found' using errcode = 'P0001'; end if;
  if v_days <> 1 then raise exception 'Animals bought together must have the same purchase date' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cattle where id = any (p_cattle_ids) and purchase_group_id is not null) then
    raise exception 'An animal is already in a purchase group' using errcode = 'P0001';
  end if;
  perform public.cattle_group_assert(p_business_id, v_day);
  perform public.cattle_group_assert(p_business_id, s.sold_at)
    from public.sales s where s.cattle_id = any (p_cattle_ids) and s.deleted_at is null;
  perform public.cattle_group_check_shares(p_shares, p_cattle_ids, p_total);

  insert into public.cattle_purchase_groups (business_id, purchased_on, total_price, seller, method, basis, note, history)
  values (p_business_id, v_day, p_total, nullif(trim(p_seller), ''), p_method, p_basis, nullif(trim(p_note), ''),
          jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'method', p_method, 'basis', p_basis, 'event', 'linked',
            'before', (select jsonb_object_agg(id, purchase_price) from public.cattle where id = any (p_cattle_ids)))))
  returning id into v_group;

  update public.cattle c set purchase_group_id = v_group, purchase_price = (p_shares ->> c.id::text)::numeric
  where c.id = any (p_cattle_ids);
  return v_group;
end $$;

-- ── re-split a purchase group (a weigh-in arrived, or the owner types prices) ─
create or replace function public.allocate_cattle_purchase_group(
  p_group_id uuid, p_method text, p_basis text, p_shares jsonb
) returns void
language plpgsql set search_path = public, pg_temp as $$
declare g public.cattle_purchase_groups; v_ids uuid[];
begin
  select * into g from public.cattle_purchase_groups where id = p_group_id and deleted_at is null for update;
  if g.id is null then raise exception 'Purchase group not found' using errcode = 'P0001'; end if;
  perform public.cattle_group_assert(g.business_id, g.purchased_on);
  select array_agg(id) into v_ids from public.cattle where purchase_group_id = g.id and deleted_at is null;
  -- a sold member's profit changes with its cost: its sale must not be in a locked period
  perform public.cattle_group_assert(g.business_id, s.sold_at)
    from public.sales s where s.cattle_id = any (v_ids) and s.deleted_at is null;
  perform public.cattle_group_check_shares(p_shares, v_ids, g.total_price);

  perform set_config('app.cattle_group_write', 'on', true);
  update public.cattle c set purchase_price = (p_shares ->> c.id::text)::numeric where c.id = any (v_ids);
  update public.cattle_purchase_groups set method = p_method, basis = p_basis, updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'method', p_method, 'basis', p_basis,
      'event', 'resplit', 'shares', p_shares))
  where id = g.id;
  perform set_config('app.cattle_group_write', '', true);
end $$;

-- ── sell several animals at one price ────────────────────────────────────────
-- p_lines: [{cattle_id, weight_kg, price}]
create or replace function public.sell_cattle_group(
  p_business_id uuid, p_sold_on date, p_total numeric, p_buyer text, p_method text, p_note text, p_lines jsonb
) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare v_group uuid; v_ids uuid[]; v_ok int; v_shares jsonb;
begin
  perform public.cattle_group_assert(p_business_id, p_sold_on);
  if p_sold_on > public.feed_today() then raise exception 'The sale date is in the future' using errcode = 'P0001'; end if;
  select array_agg((l ->> 'cattle_id')::uuid), jsonb_object_agg(l ->> 'cattle_id', (l ->> 'price')::numeric)
    into v_ids, v_shares from jsonb_array_elements(p_lines) l;
  if coalesce(array_length(v_ids, 1), 0) < 1 then raise exception 'Choose the animals sold' using errcode = 'P0001'; end if;
  perform public.cattle_group_check_shares(v_shares, v_ids, p_total);

  -- lock the animals; each must be this business's, on the farm, and not already sold
  select count(*) into v_ok from (
    select id from public.cattle where id = any (v_ids) and business_id = p_business_id and deleted_at is null
      and status = 'active' for update) x;
  if v_ok <> array_length(v_ids, 1) then raise exception 'Only animals on the farm can be sold' using errcode = 'P0001'; end if;
  if exists (select 1 from public.sales where cattle_id = any (v_ids) and deleted_at is null) then
    raise exception 'An animal already has a recorded sale' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cattle where id = any (v_ids) and purchase_date > p_sold_on) then
    raise exception 'An animal would be sold before it was bought' using errcode = 'P0001';
  end if;

  insert into public.cattle_sale_groups (business_id, sold_on, total_price, buyer, method, note)
  values (p_business_id, p_sold_on, p_total, nullif(trim(p_buyer), ''), p_method, nullif(trim(p_note), ''))
  returning id into v_group;

  insert into public.sales (cattle_id, sold_at, sale_price_total, weight_at_sale_kg, buyer_name, sale_group_id)
  select (l ->> 'cattle_id')::uuid, p_sold_on, (l ->> 'price')::numeric, nullif(l ->> 'weight_kg', '')::numeric,
         nullif(trim(p_buyer), ''), v_group
  from jsonb_array_elements(p_lines) l;

  update public.cattle set status = 'sold' where id = any (v_ids);
  update public.health_events set deleted_at = now(), notes = 'Auto-cancelled due to animal sale'
  where cattle_id = any (v_ids) and business_id = p_business_id and completed_at is null and deleted_at is null;
  return v_group;
end $$;

-- ── undo a group sale (all its animals come back) ────────────────────────────
create or replace function public.revert_cattle_sale_group(p_group_id uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare g public.cattle_sale_groups; v_ids uuid[];
begin
  select * into g from public.cattle_sale_groups where id = p_group_id and deleted_at is null for update;
  if g.id is null then raise exception 'Sale not found' using errcode = 'P0001'; end if;
  perform public.cattle_group_assert(g.business_id, g.sold_on);
  select array_agg(cattle_id) into v_ids from public.sales where sale_group_id = g.id and deleted_at is null;
  perform set_config('app.cattle_group_write', 'on', true);
  update public.sales set deleted_at = now() where sale_group_id = g.id and deleted_at is null;
  update public.cattle set status = 'active' where id = any (v_ids) and status = 'sold';
  update public.health_events set deleted_at = null, notes = null
  where cattle_id = any (v_ids) and business_id = g.business_id and notes = 'Auto-cancelled due to animal sale';
  update public.cattle_sale_groups set deleted_at = now() where id = g.id;
  perform set_config('app.cattle_group_write', '', true);
end $$;

revoke execute on function public.cattle_group_assert(uuid, date) from public, anon;
revoke execute on function public.cattle_group_check_shares(jsonb, uuid[], numeric) from public, anon;
revoke execute on function public.create_cattle_purchase_group(uuid, date, numeric, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.link_cattle_purchase_group(uuid, uuid[], numeric, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.allocate_cattle_purchase_group(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.sell_cattle_group(uuid, date, numeric, text, text, text, jsonb) from public, anon;
revoke execute on function public.revert_cattle_sale_group(uuid) from public, anon;
grant execute on function public.cattle_group_assert(uuid, date) to authenticated, service_role;
grant execute on function public.cattle_group_check_shares(jsonb, uuid[], numeric) to authenticated, service_role;
grant execute on function public.create_cattle_purchase_group(uuid, date, numeric, text, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.link_cattle_purchase_group(uuid, uuid[], numeric, text, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.allocate_cattle_purchase_group(uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function public.sell_cattle_group(uuid, date, numeric, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.revert_cattle_sale_group(uuid) to authenticated, service_role;

commit;
