-- ROLLBACK for 20260925120000_weight_types.sql. Run the corrections rollback first.
-- Weights themselves are untouched; only the type labels are removed.
begin;
alter table public.cattle drop constraint if exists cattle_initial_weight_type_chk;
alter table public.cattle drop column if exists initial_weight_type;
alter table public.weight_logs drop constraint if exists weight_logs_weight_type_chk;
alter table public.weight_logs drop column if exists weight_type;
commit;
