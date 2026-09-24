-- Feed inventory ledger tests (migration 20260925100000). Run on a THROWAWAY database
-- with all migrations applied (see supabase/tests/run_feed_ledger_tests.sh). Never on production.
\set ON_ERROR_STOP on
set client_min_messages = notice;
create temp table _r (name text, ok boolean, detail text);

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into _r values (p_name, coalesce(p_ok,false), p_detail);
  raise notice '%', (case when coalesce(p_ok,false) then 'PASS ' else 'FAIL ' end) || p_name
    || (case when coalesce(p_ok,false) then '' else ': ' || coalesce(p_detail,'') end);
end $$;
create or replace function pg_temp.stock(p_item uuid) returns numeric language sql as $$
  select qty_on_hand from public.v_inventory_balance where item_id = p_item $$;

-- fixtures: one owner → one business (signup trigger), items, recipe
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'ledger@test') on conflict do nothing;
create temp table _f as select id as biz from public.businesses where owner_id = '00000000-0000-0000-0000-0000000000f1';
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000001', biz, 'T Corn', 'kg', 'feed' from _f;
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000002', biz, 'T DORB', 'kg', 'feed' from _f;
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000003', biz, 'T Mixed', 'kg', 'feed' from _f;
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000004', biz, 'T Straw', 'piece', 'roughage' from _f;

-- T1 purchase → stock
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'purchase', 'purchase', 100, 30, '2026-01-01', 'T1 purchase');
select pg_temp.check('T1 purchase 100 kg corn -> stock 100', pg_temp.stock('11111111-0000-0000-0000-000000000001') = 100);

-- T2 consume 10 → 90, valued at WAC (30), cost_source wac
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'consumption', 'consumption', 10, '2026-01-02', 'T2 feed');
select pg_temp.check('T2 consume 10 -> stock 90', pg_temp.stock('11111111-0000-0000-0000-000000000001') = 90);
select pg_temp.check('T2 consumption valued at WAC 30 (cost_source=wac)',
  exists (select 1 from public.inventory_transactions where notes = 'T2 feed' and unit_cost = 30 and cost_source = 'wac'));
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'consumption', 'consumption', 1, 999, '2026-01-02', 'T2 client cost');
select pg_temp.check('T2 client-supplied cost (999) is replaced by WAC (30)',
  (select unit_cost from public.inventory_transactions where notes = 'T2 client cost') = 30);

-- T5 one herd feeding per date/item; the second call is rejected (idempotency)
select public.record_herd_feeding((select biz from _f), '2026-01-03',
  '[{"item_id":"11111111-0000-0000-0000-000000000001","qty":5}]'::jsonb);
do $$ declare ok boolean := false; begin
  begin
    perform public.record_herd_feeding((select biz from _f), '2026-01-03',
      '[{"item_id":"11111111-0000-0000-0000-000000000001","qty":5}]'::jsonb);
  exception when unique_violation then ok := true; end;
  perform pg_temp.check('T5 same date/item recorded twice -> rejected', ok);
end $$;
select pg_temp.check('T5 exactly one feeding row for 2026-01-03',
  (select count(*) from public.inventory_transactions where recorded_at = '2026-01-03' and movement_type = 'consumption') = 1);

-- T11-ish: planned ration never touches stock — there is no trigger/cron creating rows by date
select pg_temp.check('T9 no automatic rows: nothing dated 2026-01-04 exists without an explicit call',
  not exists (select 1 from public.inventory_transactions where recorded_at = '2026-01-04'));

-- T8/T9 recipe must balance when active
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000002', 'purchase', 'purchase', 100, 50, '2026-01-01', 'T DORB purchase');
insert into public.feed_recipes (id, business_id, name, output_qty, output_unit, is_active)
select '22222222-0000-0000-0000-000000000001', biz, 'T recipe', 100, 'kg', false from _f;
insert into public.recipe_ingredients (recipe_id, item_id, qty_per_batch) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 60),
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 40);
do $$ declare ok boolean := false; begin
  begin
    update public.feed_recipes set output_qty = 50, is_active = true where id = '22222222-0000-0000-0000-000000000001';
    set constraints all immediate;   -- deferred trigger fires here
  exception when check_violation then ok := true; end;
  perform pg_temp.check('T8 ingredients 100 vs batch 50 -> activation rejected', ok);
end $$;
update public.feed_recipes set output_qty = 100, is_active = true where id = '22222222-0000-0000-0000-000000000001';
set constraints all immediate;
select pg_temp.check('T9 ingredients 100 = batch 100 -> accepted',
  (select is_active from public.feed_recipes where id = '22222222-0000-0000-0000-000000000001'));
do $$ declare ok boolean := false; begin
  begin insert into public.recipe_ingredients (recipe_id, item_id, qty_per_batch)
        values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', -1);
  exception when check_violation then ok := true; end;
  perform pg_temp.check('T8b negative ingredient quantity rejected', ok);
end $$;

-- T6 mixing 20 kg: inputs 12 corn + 8 DORB (scaled by ingredient total), output +20, NOT a purchase
select public.produce_feed_batch((select biz from _f), '22222222-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000003', 20, '2026-01-05', '33333333-0000-0000-0000-000000000001');
select pg_temp.check('T6 corn input = 12 kg', exists (select 1 from public.inventory_transactions
  where idempotency_key = 'feed-batch:33333333-0000-0000-0000-000000000001:in:11111111-0000-0000-0000-000000000001' and qty = 12 and movement_type = 'feed_mix_input'));
select pg_temp.check('T6 DORB input = 8 kg', exists (select 1 from public.inventory_transactions
  where idempotency_key = 'feed-batch:33333333-0000-0000-0000-000000000001:in:11111111-0000-0000-0000-000000000002' and qty = 8));
select pg_temp.check('T6 mixed feed +20 kg as feed_mix_output', pg_temp.stock('11111111-0000-0000-0000-000000000003') = 20);
select pg_temp.check('T6 mixing created no purchase movement',
  not exists (select 1 from public.inventory_transactions where notes like 'Feed mix%' and movement_type = 'purchase'));
select pg_temp.check('T6 output cost = input cost (12x30 + 8x50 = 760 -> 38/kg)',
  exists (select 1 from public.inventory_transactions where idempotency_key like 'feed-batch:33333333%:out' and unit_cost = 38));
do $$ declare ok boolean := false; begin
  begin perform public.produce_feed_batch((select biz from _f), '22222222-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000003', 20, '2026-01-05', '33333333-0000-0000-0000-000000000001');
  exception when unique_violation then ok := true; end;
  perform pg_temp.check('T6 same batch id twice -> rejected, nothing deducted twice', ok);
end $$;

-- T7 feed 5 kg mixed feed
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000003', 'consumption', 'consumption', 5, '2026-01-06', 'T7');
select pg_temp.check('T7 mixed feed 20 -> 15', pg_temp.stock('11111111-0000-0000-0000-000000000003') = 15);

-- T10 overdraw is rejected; balance view is signed (never clamped)
do $$ declare ok boolean := false; begin
  begin insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
        values ('11111111-0000-0000-0000-000000000003', 'consumption', 'consumption', 1000, '2026-01-07', 'T10');
  exception when check_violation then ok := true; end;
  perform pg_temp.check('T10 consuming beyond stock -> rejected', ok);
end $$;
set session_replication_role = replica;   -- simulate a legacy negative row written before the guard existed
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, cost_source)
values ('11111111-0000-0000-0000-000000000003', 'consumption', 'consumption', 40, '2026-01-07', 'legacy overdraw', 'missing');
set session_replication_role = origin;
select pg_temp.check('T10 negative balance is visible (-25), not 0', pg_temp.stock('11111111-0000-0000-0000-000000000003') = -25);

-- T12/T14 WAC stability: a later purchase at a new price does not change earlier consumption cost
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'purchase', 'purchase', 100, 60, '2026-02-01', 'T12 new price');
select pg_temp.check('T12 earlier consumption keeps its cost (30)',
  (select unit_cost from public.inventory_transactions where notes = 'T2 feed') = 30);
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'consumption', 'consumption', 10, '2026-02-02', 'T12 after');
-- stock before the new purchase: 100 − 10 − 1 − 5 − 12 = 72 kg @30 (= ৳2160) → + 100 @60 → 172 kg worth ৳8160
select pg_temp.check('T12 new consumption uses the moving average of the stock on hand ((72×30 + 100×60)/172)',
  (select unit_cost from public.inventory_transactions where notes = 'T12 after') = round(8160 / 172.0, 6));
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'consumption', 'consumption', 1, '2026-01-20', 'T12 backdated');
select pg_temp.check('T12 back-dated consumption ignores later purchases (30)',
  (select unit_cost from public.inventory_transactions where notes = 'T12 backdated') = 30);

-- T13 zero price stays explicit and distinguishable
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000002', 'purchase', 'purchase', 10, 0, '2026-01-01', 'T13 free');
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000002', 'purchase', 'purchase', 10, '2026-01-01', 'T13 no price');
select pg_temp.check('T13 ৳0 purchase labelled zero_unconfirmed',
  (select cost_source from public.inventory_transactions where notes = 'T13 free') = 'zero_unconfirmed');
select pg_temp.check('T13 purchase without price labelled missing (not 0)',
  (select cost_source from public.inventory_transactions where notes = 'T13 no price') = 'missing');

-- T14/T15 opening balance and adjustments are not purchases
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000004', 'purchase', 'opening_balance', 50, 20, '2026-01-01', 'T14 opening');
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000004', 'purchase', 'adjustment_in', 5, '2026-01-10', 'T15 count +5');
select pg_temp.check('T14/T15 cash purchases exclude opening and adjustments',
  (select coalesce(sum(qty*unit_cost),0) from public.inventory_transactions
    where item_id = '11111111-0000-0000-0000-000000000004' and movement_type = 'purchase') = 0);
select pg_temp.check('T15 adjustment_in valued at WAC (20)',
  (select unit_cost from public.inventory_transactions where notes = 'T15 count +5') = 20);
do $$ declare ok boolean := false; begin
  begin insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
        values ('11111111-0000-0000-0000-000000000004', 'consumption', 'opening_balance', 1, '2026-01-10', 'bad');
  exception when check_violation then ok := true; end;
  perform pg_temp.check('T19 direction/type mismatch rejected (OUT row typed as opening_balance)', ok);
end $$;

-- T18 units: kg items get kg_per_unit = 1; pieces stay unknown until set
select pg_temp.check('T18 piece item has no invented kg conversion',
  (select kg_per_unit from public.inventory_items where id = '11111111-0000-0000-0000-000000000004') is null);

-- T6b a batch that uses an ingredient with no known cost is itself 'missing', never under-valued
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000005', biz, 'T Unpriced', 'kg', 'feed' from _f;
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000005', 'purchase', 'purchase', 10, '2026-01-01', 'T6b no price');
insert into public.feed_recipes (id, business_id, name, output_qty, output_unit, is_active)
select '22222222-0000-0000-0000-000000000002', biz, 'T recipe 2', 2, 'kg', false from _f;
insert into public.recipe_ingredients (recipe_id, item_id, qty_per_batch) values
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 1),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000005', 1);
select pg_temp.check('T6b batch with an unpriced ingredient returns unknown cost (NULL)',
  public.produce_feed_batch((select biz from _f), '22222222-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000003', 2, '2026-02-03', '33333333-0000-0000-0000-000000000002') is null);
select pg_temp.check('T6b its output is labelled missing with no unit cost',
  exists (select 1 from public.inventory_transactions where idempotency_key = 'feed-batch:33333333-0000-0000-0000-000000000002:out'
          and cost_source = 'missing' and unit_cost is null));

-- T20 own production (grass from leased land) is stock-in at ৳0 confirmed, never a purchase
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000006', biz, 'T Grass', 'bundle', 'roughage' from _f;
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000006', 'purchase', 'own_production', 40, '2026-03-01', 'T20 harvest');
select pg_temp.check('T20 own production: +40 bundles, ৳0, zero_confirmed',
  exists (select 1 from public.inventory_transactions where notes = 'T20 harvest' and unit_cost = 0 and cost_source = 'zero_confirmed')
  and pg_temp.stock('11111111-0000-0000-0000-000000000006') = 40);

-- T21 a consumption_reversal must point at a consumption row of the same item, and is not a new price
do $$ declare ok boolean := false; begin
  begin insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes)
        values ('11111111-0000-0000-0000-000000000001', 'purchase', 'consumption_reversal', 1, 30, 'correction', '2026-02-03', 'orphan reversal');
  exception when check_violation then ok := true; end;
  perform pg_temp.check('T21 reversal without reverses_id rejected', ok);
end $$;
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, reverses_id)
select item_id, 'purchase', 'consumption_reversal', qty, null, null, recorded_at, 'T21 undo', id
from public.inventory_transactions where notes = 'T12 after';
select pg_temp.check('T21 an undo gives back the value at the original cost, so the average is unchanged',
  (select unit_cost from public.inventory_transactions where notes = 'T21 undo') = (select unit_cost from public.inventory_transactions where notes = 'T12 after')
  -- as of its own date: 172 kg / ৳8160 minus the back-dated 1 kg @30 (20 Jan) = 171 kg / ৳8130 — the undo restored exactly what was taken
  and public.inventory_unit_cost_as_of('11111111-0000-0000-0000-000000000001', '2026-02-02') = round(8130 / 171.0, 6));
-- T21b the moving average follows the stock actually left (not every purchase ever made)
insert into public.inventory_items (id, business_id, name, unit, category) select '11111111-0000-0000-0000-000000000007', biz, 'T Moving', 'kg', 'feed' from _f;
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes) values
  ('11111111-0000-0000-0000-000000000007', 'purchase', 'purchase', 100, 40, '2026-04-01', 'MA buy 1');
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes) values
  ('11111111-0000-0000-0000-000000000007', 'consumption', 'consumption', 100, '2026-04-10', 'MA use all');
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes) values
  ('11111111-0000-0000-0000-000000000007', 'purchase', 'purchase', 100, 60, '2026-04-11', 'MA buy 2'),
  ('11111111-0000-0000-0000-000000000007', 'purchase', 'purchase', 200, 50, '2026-04-12', 'MA buy 3');
select pg_temp.check('T21b 100 @40 used up, then 100 @60 → ৳60 (a cumulative average would say ৳50)',
  public.inventory_unit_cost_as_of('11111111-0000-0000-0000-000000000007', '2026-04-11') = 60);
select pg_temp.check('T21b then +200 @50 → (100×60 + 200×50)/300 = ৳53.33; stock value = qty × cost exactly',
  public.inventory_unit_cost_as_of('11111111-0000-0000-0000-000000000007', '2026-04-12') = round(16000 / 300.0, 6)
  and (select value_on_hand from public.v_inventory_balance where item_id = '11111111-0000-0000-0000-000000000007') = 16000);

-- T22 expense categories: seeded per business, name unique per kind, cannot be used by another business
select pg_temp.check('T22 default utility categories seeded for a new business',
  (select count(*) from public.expense_categories where business_id = (select biz from _f) and kind = 'utility') = 6);
do $$ declare ok boolean := false; begin
  begin insert into public.expense_categories (business_id, kind, name) values ((select biz from _f), 'utility', ' wifi / internet ');
  exception when unique_violation then ok := true; end;
  perform pg_temp.check('T22 duplicate category name (case/space-insensitive) rejected', ok);
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f2', 'other@test') on conflict do nothing;
do $$ declare ok boolean := false; other uuid; begin
  select id into other from public.businesses where owner_id = '00000000-0000-0000-0000-0000000000f2';
  begin insert into public.cost_entries (business_id, type, category, amount, recorded_at, category_id)
        values (other, 'fixed', 'utilities', 10, '2026-03-01',
                (select id from public.expense_categories where business_id = (select biz from _f) limit 1));
  exception when insufficient_privilege then ok := true; end;
  perform pg_temp.check('T22 category of another business rejected', ok);
end $$;

-- T23 every cost-entry change is audited (insert, update, soft delete)
insert into public.cost_entries (id, business_id, type, category, amount, recorded_at, category_id, description)
select '44444444-0000-0000-0000-000000000001', biz, 'fixed', 'utilities', 1050, '2026-03-01',
       (select id from public.expense_categories where business_id = biz and name = 'WiFi / Internet'), 'T23 wifi' from _f;
update public.cost_entries set amount = 1100 where id = '44444444-0000-0000-0000-000000000001';
update public.cost_entries set deleted_at = now() where id = '44444444-0000-0000-0000-000000000001';
select pg_temp.check('T23 audit has insert, update (old 1050 → new 1100) and soft_delete',
  (select string_agg(action, ',' order by changed_at, action) from public.cost_entry_audit where cost_entry_id = '44444444-0000-0000-0000-000000000001') = 'insert,update,soft_delete'
  and exists (select 1 from public.cost_entry_audit where cost_entry_id = '44444444-0000-0000-0000-000000000001'
              and action = 'update' and (old_row->>'amount')::numeric = 1050 and (new_row->>'amount')::numeric = 1100));

-- T24 weight types: default measured / unknown, only allowed values
select pg_temp.check('T24 new weight log defaults to measured; new cattle initial weight defaults to unknown',
  (select column_default from information_schema.columns where table_name = 'weight_logs' and column_name = 'weight_type') like '%measured%'
  and (select column_default from information_schema.columns where table_name = 'cattle' and column_name = 'initial_weight_type') like '%unknown%');
do $$ declare ok boolean := false; begin
  begin update public.cattle set initial_weight_type = 'guess' where false;
    perform 1 from pg_constraint where conname = 'cattle_initial_weight_type_chk';
    ok := found;
  end;
  perform pg_temp.check('T24 initial_weight_type constrained to measured/estimated/unknown', ok);
end $$;

-- T25 a mistaken purchase is UNDONE (purchase_reversal), never edited or deleted
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('11111111-0000-0000-0000-000000000001', 'purchase', 'purchase', 20, 999, '2026-02-10', 'T25 typo purchase');
insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, reverses_id)
select item_id, 'consumption', 'purchase_reversal', qty, recorded_at, 'T25 undo', id from public.inventory_transactions where notes = 'T25 typo purchase';
select pg_temp.check('T25 undo carries the original cost and takes it back out of the average',
  (select unit_cost from public.inventory_transactions where notes = 'T25 undo') = 999
  and public.inventory_unit_cost_as_of('11111111-0000-0000-0000-000000000001', '2026-02-11')
      = public.inventory_unit_cost_as_of('11111111-0000-0000-0000-000000000001', '2026-02-09')   -- typo + undo leave no trace
  and exists (select 1 from public.inventory_transactions where notes = 'T25 typo purchase'));
do $$ declare ok boolean := false; begin
  begin insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes, reverses_id)
        select item_id, 'consumption', 'purchase_reversal', qty, recorded_at, 'bad undo', id from public.inventory_transactions where notes = 'T2 feed';
  exception when check_violation then ok := true; end;
  perform pg_temp.check('T25 only a purchase row can be undone as a purchase', ok);
end $$;

do $$ declare f int; t int; begin
  select count(*) filter (where not ok), count(*) into f, t from _r;
  raise notice '== % of % ledger checks passed', t - f, t;
  if f > 0 then raise exception '% ledger check(s) failed', f; end if;
end $$;
