-- Undo 20260929090000_sale_cost_snapshot.sql (the app keeps working without the column).
begin;
alter table public.sales drop column if exists cost_at_sale;
commit;
