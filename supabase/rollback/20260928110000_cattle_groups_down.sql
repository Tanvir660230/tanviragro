-- Rollback of 20260928110000_cattle_groups.sql.
-- Every animal keeps its share in cattle.purchase_price / sales.sale_price_total, so dropping
-- the groups loses only the grouping (who was bought / sold together) and the split history.
begin;
drop trigger if exists trg_sale_group_guard on public.sales;
drop trigger if exists trg_cattle_group_share_guard on public.cattle;
drop function if exists public.trg_sale_group_guard();
drop function if exists public.trg_cattle_group_share_guard();
drop function if exists public.revert_cattle_sale_group(uuid);
drop function if exists public.sell_cattle_group(uuid, date, numeric, text, text, text, jsonb);
drop function if exists public.allocate_cattle_purchase_group(uuid, text, text, jsonb);
drop function if exists public.link_cattle_purchase_group(uuid, uuid[], numeric, text, text, text, text, jsonb);
drop function if exists public.create_cattle_purchase_group(uuid, date, numeric, text, text, text, text, jsonb);
drop function if exists public.cattle_group_check_shares(jsonb, uuid[], numeric);
drop function if exists public.cattle_group_assert(uuid, date);
alter table public.sales  drop column if exists sale_group_id;
alter table public.cattle drop column if exists purchase_group_id;
drop table if exists public.cattle_sale_groups;
drop table if exists public.cattle_purchase_groups;
commit;
