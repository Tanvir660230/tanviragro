-- ============================================================================
-- Historical data corrections — batch 20260925-feed-corrections
-- Sources: docs/PRODUCTION_FEED_RECONCILIATION.md (C1–C8) and the owner's answers of
-- 2026-09-24 (C3, C6, C9, C11, C12). Requires migrations 20260925100000,
-- 20260925110000 and 20260925120000.
-- Rollback: supabase/rollback/20260925_feed_historical_corrections_down.sql
--
-- Principles:
--   * No row is deleted. No existing non-NULL quantity or cost is changed.
--   * A wrong stock movement is undone by an explicit consumption_reversal row that
--     points at it (reverses_id) — the original stays as evidence.
--   * Only corrections supported by the data or confirmed by the owner are applied.
--   * Every change writes an audit row (inventory_ledger_audit / data_correction_audit).
--   * Idempotent: re-running changes nothing.
-- ============================================================================
begin;

-- ── C1: 2026-08-29 was auto-deducted twice (second run 1.6 s after the first) ─────
-- The next physical true-up (2026-09-03) already reset stock to the count, so the
-- duplicate only mis-dated consumption. Value-neutral re-dating: undo the duplicate on
-- 08-29, record the same quantity/cost as consumption on 09-03.
with dup as (
  select t.*
  from public.inventory_transactions t
  where t.id in (
    '7ef6393e-cadc-4929-b28e-5878d9b85ea7','fea4b43d-d44f-4b86-b706-72658a11210e',
    '72bc7dc0-df3d-403e-a852-85430aca42fd','b2483cfe-63fc-43f1-8f0d-7b25b9c35ca5',
    '00f3b999-cf35-4051-80a0-bbe1f2fbb94c','bd1a6944-c0ca-4f9d-b745-af8f1a9803b0',
    '5ba57090-85f2-4406-baaf-9a6bcce044f6')
    and t.recorded_at = '2026-08-29'
    and t.notes ilike 'Auto-Feed Deduction%'
),
rev as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select item_id, 'purchase', 'consumption_reversal', qty, unit_cost, 'correction', recorded_at,
         'Correction C1: reversal of duplicate auto-deduction ' || id, 'correction:C1:reversal:' || id, id
  from dup
  where not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'correction:C1:reversal:' || dup.id)
  returning id, reverses_id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260925-feed-corrections', 'reverses_id', null, reverses_id::text,
       'C1: duplicate 2026-08-29 deduction reversed (value-neutral re-dating)',
       'PRODUCTION_FEED_RECONCILIATION.md §2: duplicate rows created 07:28:11.2 on 2026-08-31, 1.6 s after the first run'
from rev;

with dup as (
  select t.* from public.inventory_transactions t
  where t.id in (select reverses_id from public.inventory_transactions where idempotency_key like 'correction:C1:reversal:%')
),
top as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, is_estimate, recorded_at, notes, idempotency_key)
  select item_id, 'consumption', 'consumption', qty, unit_cost, 'manual', true, date '2026-09-03',
         'Correction C1: consumption re-dated from 2026-08-29 to 2026-09-03 (' || id || ')',
         'correction:C1:redate:' || id
  from dup
  where not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'correction:C1:redate:' || dup.id)
  returning id, notes
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260925-feed-corrections', 'recorded_at', '2026-08-29', '2026-09-03',
       'C1: duplicate quantity attributed to the 2026-09-03 physical true-up', notes
from top;

-- ── C9: 30 rows written by the removed auto-engine on 2026-09-24 ──────────────────
-- Created 09:27:17–09:27:30 UTC by one page view (local dev server → production), for
-- 2026-09-20…24, the last day before it had ended. Formula quantities, not a recording
-- of feeding, and not covered by any physical count. Undone so those days show as NOT
-- RECORDED; the owner records the real feeding or a stock count instead.
with gen as (
  select t.* from public.inventory_transactions t
  where t.id in (
    'b46de69e-29ba-4408-b0d0-971b5d0c81c8','7b984014-160f-4c9f-bce3-120019895a66','b602d81a-9869-4fb8-9cbe-643123430ccc',
    'd9559234-f1da-4816-a6e5-4ddc62d6ee28','22d333b7-c17d-426b-a71b-841f5c1255a3','8d8b7836-61b3-4cb9-852c-114b9612fd0a',
    '3f401fff-e7dd-4385-873e-565c19dd36d7','afe245a1-7233-48e0-bd75-3f002a89a507','a0b3483c-3fff-4df9-b8e2-e1237c63cec2',
    '3bd264f5-e96d-475f-8597-11fd5b06f8fc','69ba9566-7f7b-4c4f-9ac7-52cc49051636','408be284-87df-4e0b-a1a5-f9441396334a',
    '52573292-99e2-4fd8-a9c3-bc2ce92aca6b','0375b9c2-b19d-445c-8f2f-f769beea5e5e','13790fd4-27d4-4307-9035-611c8d7c33dc',
    '7060a61d-b7bb-4cf3-8418-6c4f9dc72a82','5e4d7aac-9c3f-4b95-924e-52dedd91978c','c8b94084-04cd-4b66-81d7-3bdc5990dc35',
    '1e452e94-f955-4333-bcd1-047d1c850c4e','14239675-3611-4ffd-abac-68dc1551c8c5','269ee349-617c-41cd-bef8-30d52e8783cc',
    '0b046354-9139-4f33-918c-d15a995f1386','13e4eeff-4917-4337-a6c7-1aeb9d0665e1','6991d401-e660-41a6-8ac2-417946b6f5f9',
    'f6ee02cd-5d18-42e2-bc77-7c87f38020d5','1647c528-7561-4680-9135-85f6e1a73fdf','70d6c58b-0504-4b27-9ba2-839fed69a13b',
    'f172be27-142e-4768-9c6a-9adf26a2439d','4f715d8d-5899-4b09-aaab-8cb2c5b3abee','cfe01e98-a1df-4075-a1e8-e73ffc813f5f')
    and t.notes ilike 'Auto-Feed Deduction%'
    and t.created_at >= '2026-09-24 09:27:00+00' and t.created_at < '2026-09-24 09:28:00+00'
),
rev as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select item_id, 'purchase', 'consumption_reversal', qty, unit_cost, 'correction', recorded_at,
         'Correction C9: undo automatic deduction created by a page view on 2026-09-24 (' || id || ')',
         'correction:C9:reversal:' || id, id
  from gen
  where not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'correction:C9:reversal:' || gen.id)
  returning id, reverses_id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260925-feed-corrections', 'reverses_id', null, reverses_id::text,
       'C9: formula deduction generated by the removed auto-engine on a page view — not recorded feeding',
       'FEED_COSTING_IMPLEMENTATION_REPORT.md §8: 30 rows created 2026-09-24 09:27:17–09:27:30 UTC for 09-20…09-24'
from rev;

-- ── C4 + C5: fill MISSING (NULL) costs, only for quantity that was actually received ──
-- WAC as of the row date, applied to the part of the row covered by stock received up to
-- that date. Uncovered quantity keeps no cost (handled by C11 for Mix Feed).
with outs as (
  select t.id, t.item_id, t.recorded_at, t.qty, t.unit_cost, t.cost_source,
         coalesce(sum(t.qty) over (partition by t.item_id order by t.recorded_at, t.created_at, t.id
                                   rows between unbounded preceding and 1 preceding), 0) as out_before
  from public.inventory_transactions t
  where t.type = 'consumption'
),
cand as (
  select o.*,
         (select coalesce(sum(i.qty), 0) from public.inventory_transactions i
          where i.item_id = o.item_id and i.type = 'purchase' and i.movement_type <> 'consumption_reversal'
            and i.recorded_at <= o.recorded_at) as in_to_date,
         public.inventory_unit_cost_as_of(o.item_id, o.recorded_at) as wac
  from outs o
  where o.cost_source = 'missing' and o.unit_cost is null
),
fill as (
  select id, item_id, qty, wac,
         least(qty, greatest(0, in_to_date - out_before)) as covered
  from cand
  where wac is not null
),
upd as (
  update public.inventory_transactions t
  set unit_cost = round(f.wac * f.covered / f.qty, 6), cost_source = 'correction'
  from fill f
  where t.id = f.id and f.covered > 0 and t.cost_source = 'missing' and t.unit_cost is null
  returning t.id, t.unit_cost, f.covered, f.qty, f.wac
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'fill_missing_cost', '20260925-feed-corrections', 'unit_cost', null, unit_cost::text,
       'C4/C5: missing cost filled at weighted-average cost as of the row date',
       'covered ' || covered || ' of ' || qty || ' @ WAC ' || wac
from upd;

-- ── C11: Mix Feed deducted 34.38 kg more than was ever in stock ───────────────────
-- The only Mix Feed stock-in is the external purchase of 122 kg @ ৳45 on 2026-06-01
-- (an ordinary purchase row — correct as it is). The owner confirmed (2026-09-24) that
-- all Mix Feed came from that purchase and none was mixed. The old engine kept deducting
-- by formula until 2026-06-16 (156.38 kg). Quantity beyond the 122 kg cannot have been fed,
-- so exactly that excess is undone; the excess carries no value (it never existed).
with rows as (
  select t.id, t.item_id, t.qty, t.recorded_at, t.unit_cost, t.cost_source,
         sum(t.qty) over (order by t.recorded_at, t.created_at, t.id) as out_through,
         (select coalesce(sum(i.qty), 0) from public.inventory_transactions i
          where i.item_id = t.item_id and i.type = 'purchase' and i.movement_type <> 'consumption_reversal') as in_total
  from public.inventory_transactions t
  where t.item_id = '76817533-320a-4781-a74c-75a1e7aee509' and t.type = 'consumption'
),
excess as (
  select *, round(least(qty, greatest(0, out_through - in_total)), 4) as ex from rows
),
rev as (
  insert into public.inventory_transactions
    (item_id, type, movement_type, qty, unit_cost, cost_source, recorded_at, notes, idempotency_key, reverses_id)
  select item_id, 'purchase', 'consumption_reversal', ex, 0, 'correction', recorded_at,
         'Correction C11: undo ' || ex || ' kg deducted beyond the Mix Feed ever in stock (' || id || ')',
         'correction:C11:reversal:' || id, id
  from excess
  where ex > 0
    and not exists (select 1 from public.inventory_transactions x where x.idempotency_key = 'correction:C11:reversal:' || excess.id)
  returning id, reverses_id, qty
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'insert_correction', '20260925-feed-corrections', 'reverses_id', null, reverses_id::text,
       'C11: quantity deducted beyond total Mix Feed received (owner: all Mix Feed came from the 122 kg purchase)',
       qty || ' kg undone'
from rev;

-- rows that were entirely beyond stock never had a value: 0, not "missing"
with phantom as (
  update public.inventory_transactions t set unit_cost = 0, cost_source = 'correction'
  where t.item_id = '76817533-320a-4781-a74c-75a1e7aee509' and t.type = 'consumption'
    and t.unit_cost is null and t.cost_source = 'missing'
    and exists (select 1 from public.inventory_transactions r
                where r.reverses_id = t.id and r.movement_type = 'consumption_reversal' and r.qty = t.qty)
  returning t.id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason)
select id, 'fill_missing_cost', '20260925-feed-corrections', 'unit_cost', null, '0',
       'C11: row fully undone — the quantity never existed, so it has no value'
from phantom;

-- ── C3: 50 kg কুড়া at ৳0 on 2026-08-25 — owner confirmed it was received free ─────
with z as (
  update public.inventory_transactions t set cost_source = 'zero_confirmed'
  where t.id = '3afda62b-3120-450e-b856-61026a139b74' and t.unit_cost = 0 and t.cost_source = 'zero_unconfirmed'
  returning t.id
)
insert into public.inventory_ledger_audit (transaction_id, action, correction_batch, field, old_value, new_value, reason, evidence)
select id, 'classify', '20260925-feed-corrections', 'cost_source', 'zero_unconfirmed', 'zero_confirmed',
       'C3: owner confirmed on 2026-09-24 that the 50 kg bran was received free (৳0, no cash)',
       'Invoice memo, supplier Bashundia Mor, 2026-08-25'
from z;

-- ── C6: WiFi bill recorded under "feed" → Utilities › WiFi / Internet ──────────────
with cat as (
  select c.id from public.expense_categories c
  where c.business_id = 'dcf3e774-ae39-4c7e-be80-ae8d2ad71d39' and c.kind = 'utility' and c.name = 'WiFi / Internet'
),
upd as (
  update public.cost_entries e set category = 'utilities', category_id = (select id from cat)
  where e.id = '17a72421-538f-44ac-a78a-50d97647b57d' and e.category = 'feed' and exists (select 1 from cat)
  returning e.id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason, evidence)
select '20260925-feed-corrections', 'cost_entries', id, 'category', 'feed', 'utilities / WiFi / Internet',
       'C6: WiFi bill is a utility, not feed (owner confirmed 2026-09-24)', 'Wifi bill and Connection Charge, ৳1,050, 2026-06-21'
from upd;

-- ── C12: C005 / C006 initial weights were estimates (owner, 2026-09-24) ───────────
-- The values stay on record (180 kg / 250 kg), labelled estimated; the 2026-09-14
-- scale weights (200 kg / 210 kg) are the measurements. No weight is changed.
with upd as (
  update public.cattle c set initial_weight_type = 'estimated'
  where c.id in ('2cf7ef74-6198-4356-ad99-60127ab3d19d', 'a970c5b1-0946-4182-8b0f-513e66f49ed7')
    and c.initial_weight_type <> 'estimated'
  returning c.id, c.tag_id, c.initial_weight_kg
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason, evidence)
select '20260925-feed-corrections', 'cattle', id, 'initial_weight_type', 'unknown', 'estimated',
       'C12: initial weight was entered without weighing (owner confirmed 2026-09-24)',
       tag_id || ': ' || initial_weight_kg || ' kg estimated at purchase; measured weight recorded 2026-09-14'
from upd;

commit;

-- Not applied here (by design):
--   C2  opening stock → reclassified as opening_balance by the ledger migration (audited there).
--   C7/C8 per-animal and accounting figures are computed, not stored — fixed by the code change.
--   The 15 days with no recorded feeding stay NOT RECORDED (never back-filled).
--   Straw physical count (owner: ≈128 pieces; ledger: 240) — record a stock count in the app.
