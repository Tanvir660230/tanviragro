-- Feed usage period tests (migration 20260925130000). THROWAWAY database only.
\set ON_ERROR_STOP on
set client_min_messages = warning;
create temp table _u (name text, ok boolean, detail text);
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into _u values (p_name, coalesce(p_ok, false), p_detail);
  raise warning '%', (case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end) || p_name
    || (case when coalesce(p_ok, false) then '' else ': ' || coalesce(p_detail, '') end);
end $$;
create or replace function pg_temp.stock(p_item uuid) returns numeric language sql as $$
  select qty_on_hand from public.v_inventory_balance where item_id = p_item $$;
create or replace function pg_temp.line(p_period uuid, p_item uuid) returns public.feed_usage_period_lines language sql as $$
  select * from public.feed_usage_period_lines where period_id = p_period and item_id = p_item $$;
create or replace function pg_temp.buy(p_item uuid, p_qty numeric, p_cost numeric, p_date date, p_note text) returns void language sql as $$
  insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
  values (p_item, 'purchase', 'purchase', p_qty, p_cost, p_date, p_note) $$;

-- fixtures: owner f3 → business; items A (hay, kg), B (control twin of A), S (straw, piece), recipe items C/D
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f3', 'usage@test') on conflict do nothing;
create temp table _b as select id as biz from public.businesses where owner_id = '00000000-0000-0000-0000-0000000000f3';
insert into public.inventory_items (id, business_id, name, unit, category) select v.id::uuid, biz, v.name, v.unit, v.cat::inventory_category from _b,
  (values ('aaaaaaaa-0000-0000-0000-000000000001', 'U Hay late', 'kg', 'roughage'),
          ('aaaaaaaa-0000-0000-0000-000000000002', 'U Hay on time', 'kg', 'roughage'),
          ('aaaaaaaa-0000-0000-0000-000000000003', 'U Straw', 'piece', 'roughage'),
          ('aaaaaaaa-0000-0000-0000-000000000004', 'U Corn', 'kg', 'feed'),
          ('aaaaaaaa-0000-0000-0000-000000000005', 'U Bran', 'kg', 'feed'),
          ('aaaaaaaa-0000-0000-0000-000000000006', 'U Grass', 'bundle', 'roughage')) v(id, name, unit, cat);

-- ── U1 acceptance: purchase on 01 Sep entered on 08 Sep = entered on 01 Sep ─────────
-- both items: 100 kg @20 on 25 Aug; period 01–08 Sep; closing count 20
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000001', 100, 20, '2026-08-25', 'opening buy');
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000002', 100, 20, '2026-08-25', 'opening buy');
-- on-time twin: the 01 Sep purchase is entered before the period is closed
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000002', 50, 30, '2026-09-01', 'bought 01 Sep, entered on time');
create temp table _p (k text primary key, id uuid);
insert into _p select 'late', public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-09-01');
insert into _p select 'ontime', public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000002', '2026-09-01');
select pg_temp.check('U1 an open period posts nothing (running estimate only)',
  not exists (select 1 from public.inventory_transactions t join public.feed_usage_period_lines l on l.id = t.period_line_id
              where l.period_id in (select id from _p)));
select public.close_feed_usage_period((select id from _p where k = 'ontime'), '2026-09-08', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000002","qty":20}]');
-- late item: closed BEFORE the purchase is entered → the count (20) is above recorded stock? no: 100 available, consumed 80
select public.close_feed_usage_period((select id from _p where k = 'late'), '2026-09-08', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000001","qty":20}]');
select pg_temp.check('U1 before the late entry: 100 − 20 = 80 consumed',
  (pg_temp.line((select id from _p where k = 'late'), 'aaaaaaaa-0000-0000-0000-000000000001')).consumed_qty = 80);
-- now the purchase is entered (08 Sep) with its real business date (01 Sep)
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000001', 50, 30, '2026-09-01', 'bought 01 Sep, entered 08 Sep');
select pg_temp.check('U1 late purchase keeps its business date and its entry time',
  exists (select 1 from public.inventory_transactions where notes = 'bought 01 Sep, entered 08 Sep'
          and recorded_at::date = '2026-09-01' and created_at is not null));
select pg_temp.check('U1 period re-reconciled automatically: 100 + 50 − 20 = 130 consumed',
  (pg_temp.line((select id from _p where k = 'late'), 'aaaaaaaa-0000-0000-0000-000000000001')).consumed_qty = 130);
select pg_temp.check('U1 late entry gives exactly the same quantity and cost as on-time entry',
  (select (l1.consumed_qty, l1.consumed_value) = (l2.consumed_qty, l2.consumed_value)
   from public.feed_usage_period_lines l1, public.feed_usage_period_lines l2
   where l1.period_id = (select id from _p where k = 'late') and l2.period_id = (select id from _p where k = 'ontime')),
  (select string_agg(consumed_qty || '/' || consumed_value, ' vs ') from public.feed_usage_period_lines where period_id in (select id from _p)));
select pg_temp.check('U1 cost = consumed × WAC as of end date ((100×20 + 50×30)/150)',
  (pg_temp.line((select id from _p where k = 'late'), 'aaaaaaaa-0000-0000-0000-000000000001')).consumed_value = round(130 * 3500 / 150.0, 2));
select pg_temp.check('U1 the earlier posting was reversed, not edited or deleted (history kept)',
  (select count(*) filter (where movement_type = 'consumption') = 2 and count(*) filter (where movement_type = 'consumption_reversal') = 1
   from public.inventory_transactions t join public.feed_usage_period_lines l on l.id = t.period_line_id
   where l.period_id = (select id from _p where k = 'late')));
select pg_temp.check('U1 purchase counted once as stock-in; stock = closing count (20)',
  pg_temp.stock('aaaaaaaa-0000-0000-0000-000000000001') = 20 and pg_temp.stock('aaaaaaaa-0000-0000-0000-000000000002') = 20);

-- ── U2 count above stock → UNRECONCILED gap; a later-entered purchase resolves it ───
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000003', 100, 25, '2026-08-01', 'straw 100 pcs');
insert into _p select 'straw', public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000003', '2026-08-02');
select public.close_feed_usage_period((select id from _p where k = 'straw'), '2026-08-20', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000003","qty":130}]');
select pg_temp.check('U2 count 130 > stock 100 → unreconciled, gap 30, nothing invented',
  (select status from public.feed_usage_periods where id = (select id from _p where k = 'straw')) = 'unreconciled'
  and (pg_temp.line((select id from _p where k = 'straw'), 'aaaaaaaa-0000-0000-0000-000000000003')).gap_qty = 30
  and (pg_temp.line((select id from _p where k = 'straw'), 'aaaaaaaa-0000-0000-0000-000000000003')).consumed_qty = 0);
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000003', 128, 3000.0 / 128, '2026-08-10', 'straw 128 pcs for ৳3000, entered late');
select pg_temp.check('U2 after the late purchase: 228 − 130 = 98 consumed, reconciled',
  (select status from public.feed_usage_periods where id = (select id from _p where k = 'straw')) = 'closed'
  and (pg_temp.line((select id from _p where k = 'straw'), 'aaaaaaaa-0000-0000-0000-000000000003')).consumed_qty = 98);
select pg_temp.check('U2 straw stays in pieces: ৳3000 / 128 = 23.4375 per piece',
  exists (select 1 from public.inventory_transactions where notes like 'straw 128 pcs%' and unit_cost = 23.4375));

-- ── U3 purchases during an open period + optional manual feeding: no double count ───
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000004', 100, 40, '2026-07-01', 'corn opening');
insert into _p select 'corn', public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000004', '2026-07-01');
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000004', 140, 50, '2026-07-10', 'corn bought mid-period');
select public.record_herd_feeding((select biz from _b), '2026-07-05', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000004","qty":10}]'::jsonb);
select public.close_feed_usage_period((select id from _p where k = 'corn'), '2026-07-20', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000004","qty":20}]');
select pg_temp.check('U3 100 + 140 − 20 = 220 used in total; the period posts 210 beside the manual 10',
  (pg_temp.line((select id from _p where k = 'corn'), 'aaaaaaaa-0000-0000-0000-000000000004')).consumed_qty = 210
  and pg_temp.stock('aaaaaaaa-0000-0000-0000-000000000004') = 20);

-- ── U4 recipe period: each ingredient reconciled from its own count; share snapshot ──
select pg_temp.buy('aaaaaaaa-0000-0000-0000-000000000005', 60, 30, '2026-07-01', 'bran opening');
insert into public.feed_recipes (id, business_id, name, output_qty, output_unit, is_active)
select 'bbbbbbbb-0000-0000-0000-000000000001', biz, 'U mix', 100, 'kg', false from _b;
insert into public.recipe_ingredients (recipe_id, item_id, qty_per_batch) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', 40),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 60);
insert into _p select 'mix', public.open_feed_usage_period((select biz from _b), 'recipe', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-07-21', 'pct_live_weight', 1.5);
select pg_temp.check('U4 recipe shares snapshotted (corn 0.4, bran 0.6)',
  (pg_temp.line((select id from _p where k = 'mix'), 'aaaaaaaa-0000-0000-0000-000000000004')).share = 0.4
  and (pg_temp.line((select id from _p where k = 'mix'), 'aaaaaaaa-0000-0000-0000-000000000005')).share = 0.6);
do $$ declare ok boolean := false; begin
  begin delete from public.feed_recipes where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  exception when foreign_key_violation then ok := true; end;
  perform pg_temp.check('U4 a recipe used by a usage period cannot be deleted', ok);
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.close_feed_usage_period((select id from _p where k = 'mix'), '2026-07-30', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000004","qty":5}]');
  exception when check_violation then ok := true; end;
  perform pg_temp.check('U4 every ingredient needs a closing count', ok);
end $$;
select public.close_feed_usage_period((select id from _p where k = 'mix'), '2026-07-30',
  '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000004","qty":5},{"item_id":"aaaaaaaa-0000-0000-0000-000000000005","qty":0}]');
select pg_temp.check('U4 corn 20 − 5 = 15, bran 60 − 0 = 60 consumed',
  (pg_temp.line((select id from _p where k = 'mix'), 'aaaaaaaa-0000-0000-0000-000000000004')).consumed_qty = 15
  and (pg_temp.line((select id from _p where k = 'mix'), 'aaaaaaaa-0000-0000-0000-000000000005')).consumed_qty = 60);

-- ── U5 overlap, future date, correction needs a reason, idempotent open, cancel ────
do $$ declare ok boolean := false; begin
  begin perform public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000004', '2026-07-25');
  exception when exclusion_violation then ok := true; end;
  perform pg_temp.check('U5 overlapping period for the same feed rejected', ok);
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000006', public.feed_today() + 3);
  exception when check_violation then ok := true; end;
  perform pg_temp.check('U5 a start date in the future is rejected', ok);
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.close_feed_usage_period((select id from _p where k = 'corn'), '2026-07-20', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000004","qty":10}]');
  exception when check_violation then ok := true; end;
  perform pg_temp.check('U5 correcting a closed period without a reason is rejected', ok);
end $$;
select public.close_feed_usage_period((select id from _p where k = 'corn'), '2026-07-20',
  '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000004","qty":10}]', 'recount found 10 kg');
select pg_temp.check('U5 correction re-posts 220 (reversal + new posting) and is logged',
  (pg_temp.line((select id from _p where k = 'corn'), 'aaaaaaaa-0000-0000-0000-000000000004')).consumed_qty = 220
  and exists (select 1 from public.feed_usage_period_events where period_id = (select id from _p where k = 'corn') and action = 'correct'));
select pg_temp.check('U5 later period (recipe) re-reconciled after the earlier correction: corn 10 − 5 = 5',
  (pg_temp.line((select id from _p where k = 'mix'), 'aaaaaaaa-0000-0000-0000-000000000004')).consumed_qty = 5);
select pg_temp.check('U5 opening twice with the same key returns the same period',
  public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000006', '2026-09-01', 'weight_share', null, null, 'k-grass')
  = public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000006', '2026-09-01', 'weight_share', null, null, 'k-grass'));
select public.cancel_feed_usage_period((select id from public.feed_usage_periods where idempotency_key = 'k-grass'), 'started by mistake');
select pg_temp.check('U5 a cancelled period is kept (audit) and frees the feed',
  (select status from public.feed_usage_periods where idempotency_key = 'k-grass') = 'cancelled'
  and public.open_feed_usage_period((select biz from _b), 'item', 'aaaaaaaa-0000-0000-0000-000000000006', '2026-09-02') is not null);

-- ── U6 own-land grass: ৳0 stock-in, a period consumes it at ৳0 (no cash, no gap) ────
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('aaaaaaaa-0000-0000-0000-000000000006', 'purchase', 'own_production', 300, '2026-09-01', 'grass harvest');
select public.close_feed_usage_period((select p.id from public.feed_usage_periods p where p.item_id = 'aaaaaaaa-0000-0000-0000-000000000006' and p.status = 'open'),
  '2026-09-10', '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000006","qty":50}]');
select pg_temp.check('U6 grass: 250 bundles consumed at ৳0, reconciled',
  exists (select 1 from public.v_feed_usage_lines where item_id = 'aaaaaaaa-0000-0000-0000-000000000006'
          and status = 'closed' and consumed_qty = 250 and consumed_value = 0));

-- ── U7 security: another business's user cannot touch these periods ──────────────
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f4', 'intruder@test') on conflict do nothing;
do $$ declare ok boolean := false; begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
  begin perform public.close_feed_usage_period((select id from _p where k = 'straw'), '2026-08-20',
          '[{"item_id":"aaaaaaaa-0000-0000-0000-000000000003","qty":0}]', 'intruder tries to change it');
  exception when insufficient_privilege then ok := true; end;
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.check('U7 a user of another business is refused', ok);
end $$;

-- ── U8 invariants on every closed line ───────────────────────────────────────
select pg_temp.check('U8 available − consumed − closing + gap = 0 on every reconciled line',
  not exists (select 1 from public.feed_usage_period_lines l join public.feed_usage_periods p on p.id = l.period_id
              where p.status in ('closed', 'unreconciled')
                and abs(l.available_qty - l.consumed_qty - l.closing_qty + l.gap_qty) > 0.0001));
select pg_temp.check('U8 each line has exactly its consumed quantity as net posting',
  not exists (select 1 from public.feed_usage_period_lines l
              where l.consumed_qty is not null and abs(l.consumed_qty - coalesce((
                select sum(case when t.type = 'consumption' then t.qty else -t.qty end)
                from public.inventory_transactions t where t.period_line_id = l.id), 0)) > 0.0001));

do $$ declare f int; t int; begin
  select count(*) filter (where not ok), count(*) into f, t from _u;
  raise warning '== % of % usage-period checks passed', t - f, t;
  if f > 0 then raise exception '% usage-period check(s) failed', f; end if;
end $$;
