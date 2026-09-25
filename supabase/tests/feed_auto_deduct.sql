-- Automatic daily feed deduction + count adjustment + feeding chart (migration 20260926090000).
-- Runs inside one transaction and rolls back; use a THROWAWAY or local copy database.
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
create or replace function pg_temp.buy(p_item uuid, p_qty numeric, p_cost numeric, p_date date) returns void language sql as $$
  insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
  values (p_item, 'purchase', 'purchase', p_qty, p_cost, p_date, 'auto-deduct test') $$;
-- 10 days × p_qty automatic rows ending yesterday
create or replace function pg_temp.auto(p_biz uuid, p_period uuid, p_qty numeric) returns int language sql as $$
  select public.post_feed_auto_usage(p_biz,
    (select jsonb_agg(jsonb_build_object('line_id', l.id, 'date', d::date, 'qty', p_qty))
       from public.feed_usage_period_lines l, generate_series(public.feed_today() - 10, public.feed_today() - 1, '1 day') d
      where l.period_id = p_period),
    array[p_period], public.feed_today() - 1) $$;
create or replace function pg_temp.lines_of(p uuid) returns setof uuid language sql as $$
  select id from public.feed_usage_period_lines where period_id = p $$;

-- fixtures: a business (first one of the owner used by the other tests, or any) and fresh items
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f4', 'auto@test') on conflict do nothing;
insert into public.businesses (id, owner_id, name)
values ('bbbbbbbb-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f4', 'Auto deduct test') on conflict do nothing;
create temp table _b as select 'bbbbbbbb-0000-0000-0000-0000000000f4'::uuid as biz;
insert into public.inventory_items (id, business_id, name, unit, category) select v.id::uuid, biz, v.name, v.unit, v.cat::inventory_category from _b,
  (values ('cccccccc-0000-0000-0000-000000000001', 'A Corn', 'kg', 'feed'),
          ('cccccccc-0000-0000-0000-000000000002', 'A Straw', 'piece', 'roughage')) v(id, name, unit, cat);
select pg_temp.buy('cccccccc-0000-0000-0000-000000000001', 100, 40, public.feed_today() - 20);
select pg_temp.buy('cccccccc-0000-0000-0000-000000000002', 50, 25, public.feed_today() - 20);

do $$
declare biz uuid := (select biz from _b); corn uuid := 'cccccccc-0000-0000-0000-000000000001'; p uuid; np uuid; n int; st text;
begin
  -- A1 daily posting, idempotent, progress recorded
  p := public.open_feed_usage_period(biz, 'item', corn, public.feed_today() - 10, 'per_head', 1, null, 'A1');
  n := pg_temp.auto(biz, p, 3);
  perform pg_temp.check('A1 ten daily rows posted', n = 10, n::text);
  perform pg_temp.check('A1 stock goes down daily (100 − 30)', pg_temp.stock(corn) = 70, pg_temp.stock(corn)::text);
  perform pg_temp.check('A1 second run posts nothing', pg_temp.auto(biz, p, 3) = 0);
  perform pg_temp.check('A1 posted through yesterday', (select auto_posted_through from feed_usage_periods where id = p) = public.feed_today() - 1);
  perform pg_temp.check('A1 rows valued at average cost', (select bool_and(unit_cost = 40) from inventory_transactions where period_line_id in (select pg_temp.lines_of(p))));

  -- A2 count lower than the daily figure → one extra deduction; stock = count
  st := public.close_feed_usage_period(p, public.feed_today() - 1, jsonb_build_array(jsonb_build_object('item_id', corn, 'qty', 64)), null);
  perform pg_temp.check('A2 closed', st = 'closed', st);
  perform pg_temp.check('A2 stock = count', pg_temp.stock(corn) = 64, pg_temp.stock(corn)::text);
  perform pg_temp.check('A2 one adjustment row of 6', (select count(*) = 1 and sum(qty) = 6 from inventory_transactions where period_line_id in (select pg_temp.lines_of(p)) and idempotency_key like '%:adj:%'));
  perform pg_temp.check('A2 actual use 36', (select consumed_qty = 36 from feed_usage_period_lines where period_id = p));

  -- A3 correction: recount higher → part returned from the latest rows
  st := public.close_feed_usage_period(p, public.feed_today() - 1, jsonb_build_array(jsonb_build_object('item_id', corn, 'qty', 75)), 'recount');
  perform pg_temp.check('A3 stock = new count', pg_temp.stock(corn) = 75, pg_temp.stock(corn)::text);
  perform pg_temp.check('A3 no row reversed beyond its quantity',
    not exists (select 1 from inventory_transactions t where t.period_line_id in (select pg_temp.lines_of(p)) and t.type = 'consumption'
                and t.qty < (select coalesce(sum(r.qty), 0) from inventory_transactions r where r.reverses_id = t.id)));

  -- A4 count & continue (next period), counted earlier than the automatic rows
  p := public.open_feed_usage_period(biz, 'item', 'cccccccc-0000-0000-0000-000000000002', public.feed_today() - 10, 'per_head', 1, null, 'A4b');
  n := pg_temp.auto(biz, p, 2);
  np := public.checkpoint_feed_usage_period(p, public.feed_today() - 5, jsonb_build_array(jsonb_build_object('item_id', 'cccccccc-0000-0000-0000-000000000002', 'qty', 41)));
  perform pg_temp.check('A4 old period closed at the count', (select status = 'closed' and end_date = public.feed_today() - 5 from feed_usage_periods where id = p));
  perform pg_temp.check('A4 same feed continues next day, same rule',
    (select status = 'open' and start_date = public.feed_today() - 4 and rule_type = 'per_head' and rule_value = 1 from feed_usage_periods where id = np));
  perform pg_temp.check('A4 later automatic rows undone: stock = count', pg_temp.stock('cccccccc-0000-0000-0000-000000000002') = 41, pg_temp.stock('cccccccc-0000-0000-0000-000000000002')::text);

  -- A5 never below zero stock; today and future refused
  n := public.post_feed_auto_usage(biz,
    (select jsonb_agg(jsonb_build_object('line_id', l.id, 'date', d::date, 'qty', 30)) from feed_usage_period_lines l,
       generate_series(public.feed_today() - 4, public.feed_today() + 1, '1 day') d where l.period_id = np),
    array[np], public.feed_today() + 1);
  perform pg_temp.check('A5 capped at stock on hand (41 → 0, two rows)', n = 2 and pg_temp.stock('cccccccc-0000-0000-0000-000000000002') = 0, n || ' rows, stock ' || pg_temp.stock('cccccccc-0000-0000-0000-000000000002'));
  perform pg_temp.check('A5 nothing dated today or later', not exists (select 1 from inventory_transactions where period_line_id in (select pg_temp.lines_of(np)) and recorded_at >= public.feed_today()));

  -- A6 late purchase inside a closed automatic period re-reconciles: stock still equals the count
  perform pg_temp.buy(corn, 10, 50, public.feed_today() - 6);
  perform pg_temp.check('A6 late purchase: stock still = count 75', pg_temp.stock(corn) = 75, pg_temp.stock(corn)::text);

  -- A7 rule change on a running period; chart save and validation
  perform public.set_feed_usage_rule(np, 'chart', null);
  perform pg_temp.check('A7 rule changed and logged', (select rule_type = 'chart' from feed_usage_periods where id = np)
    and exists (select 1 from feed_usage_period_events where period_id = np and action = 'rule'));
  perform pg_temp.check('A7 rule change: days without a row are posted again', (select auto_posted_through is null from feed_usage_periods where id = np));
  update feed_usage_periods set auto_posted_through = public.feed_today() - 1 where id = np;
  perform public.save_feed_chart(biz, 'item', corn, public.feed_today(), '[{"min_kg":0,"max_kg":200,"amount":1.5,"basis":"pct_bw"},{"min_kg":200,"max_kg":null,"amount":4,"basis":"per_head"}]');
  perform public.save_feed_chart(biz, 'item', corn, public.feed_today(), '[{"min_kg":0,"max_kg":null,"amount":3,"basis":"per_head"}]');
  perform public.save_feed_chart(biz, 'item', 'cccccccc-0000-0000-0000-000000000002', public.feed_today() - 30, '[{"min_kg":0,"max_kg":null,"amount":2,"basis":"per_head"}]');
  perform pg_temp.check('A7 chart saved: its running period catches up', (select auto_posted_through is null from feed_usage_periods where id = np));
  perform pg_temp.check('A7 same-day save replaces the version', (select count(*) = 1 from feed_charts where item_id = corn)
    and (select count(*) = 1 from feed_chart_bands b join feed_charts c on c.id = b.chart_id where c.item_id = corn));
  begin
    perform public.save_feed_chart(biz, 'item', corn, public.feed_today(), '[{"min_kg":0,"max_kg":180,"amount":1,"basis":"per_head"},{"min_kg":200,"max_kg":null,"amount":1,"basis":"per_head"}]');
    perform pg_temp.check('A7 gap between rows refused', false);
  exception when check_violation then perform pg_temp.check('A7 gap between rows refused', true); end;
  begin
    perform public.save_feed_chart(biz, 'item', 'cccccccc-0000-0000-0000-000000000002', public.feed_today(), '[{"min_kg":0,"max_kg":null,"amount":1.5,"basis":"pct_bw"}]');
    perform pg_temp.check('A7 % of weight refused for pieces without kg per piece', false);
  exception when check_violation then perform pg_temp.check('A7 % of weight refused for pieces without kg per piece', true); end;
end $$;

select case when bool_and(ok) then 'ALL PASS (' || count(*) || ')' else 'FAILED: ' || string_agg(name, ', ') filter (where not ok) end as result from _u;
rollback;
