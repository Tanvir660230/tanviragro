-- ============================================================================
-- Fixed assets bought with an existing payment record
-- A fixed asset (depreciation, book value) can point at the cost entry that paid for it.
-- The cost entry (entry_class = 'asset') is the CASH record; the linked fixed asset is the
-- VALUE record (cost, depreciation, book value). Every calculation counts the money once:
--   cash / capital expenditure  ← the cost entry
--   asset value / depreciation   ← the fixed asset
-- Additive; nullable; no data change. Rollback: supabase/rollback/20260925150000_fixed_asset_source_down.sql
-- ============================================================================
begin;

alter table public.fixed_assets
  add column if not exists source_cost_entry_id uuid references public.cost_entries(id) on delete restrict;
create index if not exists idx_fixed_assets_source on public.fixed_assets (source_cost_entry_id) where source_cost_entry_id is not null;

comment on column public.fixed_assets.source_cost_entry_id is
  'Payment record of this asset (cost_entries, entry_class = asset). Cash is counted from the payment, value and depreciation from this row — never both.';

-- guard: same business, the payment is an asset payment, linked assets never exceed the payment
create or replace function public.trg_fixed_asset_source_check() returns trigger language plpgsql as $$
declare v_amount numeric; v_class text; v_biz uuid; v_linked numeric;
begin
  if new.source_cost_entry_id is null then return new; end if;
  select amount, entry_class, business_id into v_amount, v_class, v_biz
  from public.cost_entries where id = new.source_cost_entry_id and deleted_at is null;
  if not found then raise exception 'Payment record not found' using errcode = 'foreign_key_violation'; end if;
  if v_biz <> new.business_id then raise exception 'Payment record belongs to another business' using errcode = '42501'; end if;
  if v_class <> 'asset' then raise exception 'The payment record must be classed as an asset purchase' using errcode = 'check_violation'; end if;
  select coalesce(sum(purchase_cost), 0) into v_linked from public.fixed_assets
  where source_cost_entry_id = new.source_cost_entry_id and id <> new.id;
  if v_linked + new.purchase_cost > v_amount + 0.005 then
    raise exception 'Linked assets (৳%) would exceed the payment (৳%)', v_linked + new.purchase_cost, v_amount using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_fixed_asset_source_check on public.fixed_assets;
create trigger trg_fixed_asset_source_check before insert or update of source_cost_entry_id, purchase_cost, business_id
  on public.fixed_assets for each row execute function public.trg_fixed_asset_source_check();

-- guard: a payment that a fixed asset points at cannot be deleted, reclassed or reduced below
-- its assets (the asset's cash would silently disappear) — remove or unlink the asset first
create or replace function public.trg_cost_entry_linked_asset_check() returns trigger language plpgsql as $$
declare v_linked numeric;
begin
  select coalesce(sum(purchase_cost), 0) into v_linked from public.fixed_assets where source_cost_entry_id = old.id;
  if v_linked = 0 then return new; end if;
  if new.deleted_at is not null or new.entry_class <> 'asset' or new.amount + 0.005 < v_linked then
    raise exception 'This payment is linked to fixed assets (৳%) — remove or unlink them on the Fixed Assets page first', v_linked
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_cost_entry_linked_asset_check on public.cost_entries;
create trigger trg_cost_entry_linked_asset_check before update of deleted_at, entry_class, amount
  on public.cost_entries for each row execute function public.trg_cost_entry_linked_asset_check();

commit;
