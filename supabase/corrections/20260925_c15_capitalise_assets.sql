-- ============================================================================
-- Correction C15 — long-term farm assets are assets, not operating expenses
-- Owner instruction (2026-09-24): the cow shed, the straw cutting machine, the motor and the
-- farm equipment are capital expenditure. They were entered as ordinary expenses (the
-- machine even under "utilities"), so the whole purchase price hit operating profit at once.
--
-- For each payment record (nothing deleted; date, amount and description unchanged):
--   1. cost_entries.entry_class 'expense' → 'asset'  (the payment stays the CASH record)
--   2. the machine's category 'utilities' → 'equipment'
--   3. a fixed asset linked to it (source_cost_entry_id) — the VALUE record, depreciated.
-- The shed payment (৳103,280) itemises a motor (৳11,700): shed ৳91,580 + motor ৳11,700.
-- Useful lives are ASSUMPTIONS (straight-line, no salvage) — change them on the Fixed Assets page.
-- Requires migration 20260925150000. Every change audited (cost_entry_audit trigger +
-- data_correction_audit). Idempotent. Rollback: supabase/rollback/20260925_c15_capitalise_assets_down.sql
-- ============================================================================
begin;

create temp table c15 (cost_entry_id uuid, asset_name text, category text, cost numeric, life numeric, note text) on commit drop;
insert into c15 values
  ('f0c20881-9f6a-4520-a42a-695abda180d4', 'Cow shed (গরুর শেড)',                   'infrastructure', 91580, 10, 'Shed construction, payment of 2026-06-01 less the motor'),
  ('f0c20881-9f6a-4520-a42a-695abda180d4', 'Water motor (মোটর)',                    'equipment',      11700,  5, 'Item 1 of the shed payment of 2026-06-01'),
  ('e91d5e4d-3d92-4537-b007-db48107111a8', 'Straw cutting machine (খড় কাটার মেশিন)', 'equipment',      23200,  5, 'Entered as "utilities" on 2026-08-06'),
  ('a55d486e-1f44-4b23-97c9-c2d8edc51a47', 'CCTV, power bank, memory card',         'equipment',       7400,  3, 'Equipment payment of 2026-06-13'),
  ('9c478a4b-44a5-43e9-978e-b3f47fdc67a7', 'Chain, lock, mat',                      'equipment',       2020,  3, 'Equipment payment of 2026-06-10'),
  ('fb4e8374-63e2-47c1-b886-5f97f51c107d', 'Bucket and related (Musfik)',           'equipment',        990,  3, 'Equipment payment of 2026-06-03');

-- safety: every payment exists, is not deleted, and its linked assets add up to exactly its amount
do $$
declare r record;
begin
  for r in select c.cost_entry_id, sum(c.cost) as linked, ce.amount, ce.deleted_at
           from c15 c left join public.cost_entries ce on ce.id = c.cost_entry_id group by 1, 3, 4 loop
    if r.amount is null or r.deleted_at is not null then raise exception 'C15: payment % not found — nothing changed', r.cost_entry_id; end if;
    if abs(r.linked - r.amount) > 0.005 then raise exception 'C15: assets ৳% ≠ payment ৳% (%) — nothing changed', r.linked, r.amount, r.cost_entry_id; end if;
  end loop;
end $$;

-- 1. payment records become asset payments
with upd as (
  update public.cost_entries ce set entry_class = 'asset'
  where ce.id in (select distinct cost_entry_id from c15) and ce.entry_class = 'expense'
  returning ce.id, ce.amount, ce.recorded_at
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason, evidence)
select '20260925-c15-capitalise-assets', 'cost_entries', id, 'entry_class', 'expense', 'asset',
       'C15: long-term asset purchase, not an operating expense (owner 2026-09-24)', recorded_at || ', ৳' || amount
from upd;

-- 2. the machine is equipment, not a utility
with upd as (
  update public.cost_entries set category = 'equipment'
  where id = 'e91d5e4d-3d92-4537-b007-db48107111a8' and category = 'utilities'
  returning id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason, evidence)
select '20260925-c15-capitalise-assets', 'cost_entries', id, 'category', 'utilities', 'equipment',
       'C15: a straw cutting machine is equipment, not a utility', 'Khor katar machine kinesi, ৳23,200, 2026-08-06'
from upd;

-- 3. fixed assets (value, depreciation), linked to their payment
with ins as (
  insert into public.fixed_assets (business_id, name, category, description, purchase_date, purchase_cost, salvage_value,
                                   useful_life_years, depreciation_method, is_active, notes, source_cost_entry_id)
  select ce.business_id, c.asset_name, c.category, c.note, ce.recorded_at, c.cost, 0, c.life, 'straight_line', true,
         'C15: capitalised from payment ' || ce.id || '. Useful life ' || c.life || ' years is an assumption — confirm or change.',
         ce.id
  from c15 c join public.cost_entries ce on ce.id = c.cost_entry_id
  where not exists (select 1 from public.fixed_assets f where f.source_cost_entry_id = c.cost_entry_id and f.name = c.asset_name)
  returning id, name, purchase_cost, source_cost_entry_id
)
insert into public.data_correction_audit (correction_batch, table_name, row_id, field, old_value, new_value, reason, evidence)
select '20260925-c15-capitalise-assets', 'fixed_assets', id, 'created', null, name || ' ৳' || purchase_cost,
       'C15: fixed asset for payment ' || source_cost_entry_id, null
from ins;

commit;

-- check (read-only): each payment = its linked assets; nothing counted twice
select ce.recorded_at, ce.category, ce.entry_class, ce.amount,
       (select sum(f.purchase_cost) from public.fixed_assets f where f.source_cost_entry_id = ce.id) as linked_assets
from public.cost_entries ce where ce.id in ('f0c20881-9f6a-4520-a42a-695abda180d4','e91d5e4d-3d92-4537-b007-db48107111a8',
  'a55d486e-1f44-4b23-97c9-c2d8edc51a47','9c478a4b-44a5-43e9-978e-b3f47fdc67a7','fb4e8374-63e2-47c1-b886-5f97f51c107d')
order by ce.recorded_at;
