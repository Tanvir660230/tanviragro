-- Feed mix by date (migration 20260926100000). Runs in one transaction and rolls back.
\set ON_ERROR_STOP on
set client_min_messages = warning;
begin;
create temp table _u (name text, ok boolean, detail text);
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into _u values (p_name, coalesce(p_ok, false), p_detail);
  raise warning '%', (case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end) || p_name
    || (case when coalesce(p_ok, false) then '' else ': ' || coalesce(p_detail, '') end);
end $$;
create or replace function pg_temp.stock(p_item uuid) returns numeric language sql as $$
  select qty_on_hand from public.v_inventory_balance where item_id = p_item $$;
create or replace function pg_temp.value(p_item uuid) returns numeric language sql as $$
  select round(value_on_hand, 2) from public.v_inventory_balance where item_id = p_item $$;
create or replace function pg_temp.buy(p_item uuid, p_qty numeric, p_cost numeric, p_date date) returns void language sql as $$
  insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
  values (p_item, 'purchase', 'purchase', p_qty, p_cost, p_date, 'mix test') $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null; exception when others then return sqlerrm; end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f5', 'mix@test') on conflict do nothing;
insert into public.businesses (id, owner_id, name)
values ('bbbbbbbb-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000f5', 'Mix test') on conflict do nothing;
insert into public.inventory_items (id, business_id, name, unit, category, kg_per_unit) values
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-0000000000f5', 'M Corn', 'kg', 'feed', null),
  ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-0000000000f5', 'M Bran', 'kg', 'feed', null),
  ('dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-0000000000f5', 'M Salt', 'kg', 'feed', null),
  ('dddddddd-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-0000000000f5', 'M Mix', 'kg', 'feed', null),
  ('dddddddd-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-0000000000f5', 'M Straw', 'piece', 'roughage', null);
select pg_temp.buy('dddddddd-0000-0000-0000-000000000001', 200, 40, public.feed_today() - 30);
select pg_temp.buy('dddddddd-0000-0000-0000-000000000002', 100, 50, public.feed_today() - 30);
select pg_temp.buy('dddddddd-0000-0000-0000-000000000003', 20, 20, public.feed_today() - 30);

do $$
declare biz uuid := 'bbbbbbbb-0000-0000-0000-0000000000f5';
  corn uuid := 'dddddddd-0000-0000-0000-000000000001'; bran uuid := 'dddddddd-0000-0000-0000-000000000002';
  salt uuid := 'dddddddd-0000-0000-0000-000000000003'; mix uuid := 'dddddddd-0000-0000-0000-000000000004';
  straw uuid := 'dddddddd-0000-0000-0000-000000000005';
  b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid(); r jsonb; e text; p uuid; n int; lines jsonb;
begin
  lines := jsonb_build_array(jsonb_build_object('item_id', corn, 'qty', 60), jsonb_build_object('item_id', bran, 'qty', 30), jsonb_build_object('item_id', salt, 'qty', 10));
  -- M1 a mix: ingredients out, mix in at the inputs' cost
  r := public.produce_feed_mix(biz, mix, public.feed_today() - 20, lines, b1, null, 'test');
  perform pg_temp.check('M1 mix = sum of ingredients (100 kg)', pg_temp.stock(mix) = 100, pg_temp.stock(mix)::text);
  perform pg_temp.check('M1 ingredients went down', pg_temp.stock(corn) = 140 and pg_temp.stock(bran) = 70 and pg_temp.stock(salt) = 10);
  perform pg_temp.check('M1 mix valued at inputs (৳4,100 → ৳41/kg)', pg_temp.value(mix) = 4100 and (r->>'cost')::numeric = 4100, pg_temp.value(mix)::text);
  perform pg_temp.check('M1 batch recorded', exists (select 1 from feed_mix_batches where id = b1 and output_qty = 100 and input_qty = 100 and total_cost = 4100));
  perform pg_temp.check('M1 stock value unchanged by mixing', pg_temp.value(corn) + pg_temp.value(bran) + pg_temp.value(salt) + pg_temp.value(mix) = 8000 + 5000 + 400);

  -- M2 the same batch twice: nothing new
  r := public.produce_feed_mix(biz, mix, public.feed_today() - 20, lines, b1);
  perform pg_temp.check('M2 double submit ignored', (r->>'duplicate')::boolean and pg_temp.stock(mix) = 100);

  -- M3 errors; nothing is written
  e := pg_temp.err(format('select public.produce_feed_mix(%L, %L, %L, %L, %L)', biz, mix, public.feed_today() - 1,
         jsonb_build_array(jsonb_build_object('item_id', corn, 'qty', 999)), gen_random_uuid()));
  perform pg_temp.check('M3 not enough stock refused, nothing written', e is not null and pg_temp.stock(corn) = 140 and pg_temp.stock(mix) = 100, coalesce(e, 'no error'));
  e := pg_temp.err(format('select public.produce_feed_mix(%L, %L, %L, %L, %L)', biz, mix, public.feed_today() + 1, lines, gen_random_uuid()));
  perform pg_temp.check('M3 future date refused', e like '%today or earlier%', coalesce(e, 'no error'));
  e := pg_temp.err(format('select public.produce_feed_mix(%L, %L, %L, %L, %L)', biz, straw, public.feed_today(), lines, gen_random_uuid()));
  perform pg_temp.check('M3 mix item must be in kg', e like '%in kg%', coalesce(e, 'no error'));
  e := pg_temp.err(format('select public.produce_feed_mix(%L, %L, %L, %L, %L)', biz, mix, public.feed_today(),
         jsonb_build_array(jsonb_build_object('item_id', mix, 'qty', 1)), gen_random_uuid()));
  perform pg_temp.check('M3 mix cannot be its own ingredient', e like '%own ingredient%', coalesce(e, 'no error'));
  e := pg_temp.err(format('select public.produce_feed_mix(%L, %L, %L, %L, %L)', biz, mix, public.feed_today(),
         jsonb_build_array(jsonb_build_object('item_id', corn, 'qty', 1), jsonb_build_object('item_id', corn, 'qty', 2)), gen_random_uuid()));
  perform pg_temp.check('M3 ingredient twice refused', e like '%twice%', coalesce(e, 'no error'));
  e := pg_temp.err(format('select public.produce_feed_mix(%L, %L, %L, %L, %L)', biz, mix, public.feed_today(),
         jsonb_build_array(jsonb_build_object('item_id', straw, 'qty', 1)), gen_random_uuid()));
  perform pg_temp.check('M3 pieces without kg per piece refused', e like '%kg per%', coalesce(e, 'no error'));

  -- M4 undo: everything back, once only
  r := public.produce_feed_mix(biz, mix, public.feed_today() - 10, lines, b2);
  perform public.undo_feed_mix(b2, 'entered twice');
  perform pg_temp.check('M4 undo restores stock', pg_temp.stock(mix) = 100 and pg_temp.stock(corn) = 140 and pg_temp.stock(salt) = 10);
  perform pg_temp.check('M4 undo restores value', pg_temp.value(mix) = 4100 and pg_temp.value(corn) = 5600);
  perform pg_temp.check('M4 batch marked undone', exists (select 1 from feed_mix_batches where id = b2 and undone_at is not null and undo_reason = 'entered twice'));
  e := pg_temp.err(format('select public.undo_feed_mix(%L, %L)', b2, 'again'));
  perform pg_temp.check('M4 second undo refused', e like '%already undone%', coalesce(e, 'no error'));

  -- M5 undo refused once part of the mix was fed
  insert into inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes) values (mix, 'consumption', 'consumption', 5, public.feed_today() - 19, 'fed');
  e := pg_temp.err(format('select public.undo_feed_mix(%L, %L)', b1, 'mistake'));
  perform pg_temp.check('M5 undo refused after feeding', e like '%already been fed%' and pg_temp.stock(mix) = 95, coalesce(e, 'no error'));

  -- M6 daily deduction tops up days that were short of mix, once a late mix is entered
  p := public.open_feed_usage_period(biz, 'item', mix, public.feed_today() - 5, 'per_head', 1, null, 'M6');
  n := public.post_feed_auto_usage(biz,
    (select jsonb_agg(jsonb_build_object('line_id', l.id, 'date', d::date, 'qty', 40)) from feed_usage_period_lines l,
       generate_series(public.feed_today() - 5, public.feed_today() - 1, '1 day') d where l.period_id = p), array[p], public.feed_today() - 1);
  perform pg_temp.check('M6 short of mix: capped at stock (95 = 40 + 40 + 15)', pg_temp.stock(mix) = 0 and n = 3, n || ' rows, stock ' || pg_temp.stock(mix));
  r := public.produce_feed_mix(biz, mix, public.feed_today() - 4, lines, gen_random_uuid());   -- mixed 4 days ago, entered today
  perform pg_temp.check('M6 late mix re-opens the days', (select auto_posted_through = public.feed_today() - 5 from feed_usage_periods where id = p));
  n := public.post_feed_auto_usage(biz,
    (select jsonb_agg(jsonb_build_object('line_id', l.id, 'date', d::date, 'qty', 40)) from feed_usage_period_lines l,
       generate_series(public.feed_today() - 4, public.feed_today() - 1, '1 day') d where l.period_id = p), array[p], public.feed_today() - 1);
  perform pg_temp.check('M6 short day topped up, later days filled (95 + 100 = 5 × 40 − 5)', pg_temp.stock(mix) = 0
    and (select sum(qty) from inventory_transactions where period_line_id in (select id from feed_usage_period_lines where period_id = p)) = 195, n::text);
  perform pg_temp.check('M6 a topped-up day has a second row, never more than planned',
    not exists (select 1 from inventory_transactions where period_line_id in (select id from feed_usage_period_lines where period_id = p)
                group by recorded_at having sum(qty) > 40.0001));
  n := public.post_feed_auto_usage(biz,
    (select jsonb_agg(jsonb_build_object('line_id', l.id, 'date', d::date, 'qty', 40)) from feed_usage_period_lines l,
       generate_series(public.feed_today() - 5, public.feed_today() - 1, '1 day') d where l.period_id = p), array[p], public.feed_today() - 1);
  perform pg_temp.check('M6 running again posts nothing', n = 0);
end $$;

select case when bool_and(ok) then 'ALL PASS (' || count(*) || ')' else 'FAILED: ' || string_agg(name, ', ') filter (where not ok) end as result from _u;
rollback;
