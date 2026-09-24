-- ============================================================================
-- Estimated vs measured weights.
-- Rollback: supabase/rollback/20260925120000_weight_types_down.sql
--
-- cattle.initial_weight_type: how the weight entered at purchase was obtained.
--   'measured'  = weighed on a scale / tape at purchase
--   'estimated' = a guess used until the animal was weighed (not a measurement)
--   'unknown'   = recorded before this distinction existed (treated like measured,
--                 which is how the app has always used it)
-- weight_logs.weight_type: 'measured' (default) or 'estimated'.
--
-- Growth (ADG, weight gain) is computed from MEASURED weights only: when the initial
-- weight is an estimate, the baseline is the first measured weight. Nothing is
-- overwritten: the estimate stays on record, labelled.
-- Additive and idempotent.
-- ============================================================================
begin;

alter table public.cattle
  add column if not exists initial_weight_type text not null default 'unknown';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cattle_initial_weight_type_chk') then
    alter table public.cattle add constraint cattle_initial_weight_type_chk
      check (initial_weight_type in ('measured','estimated','unknown'));
  end if;
end $$;
comment on column public.cattle.initial_weight_type is
  'measured | estimated | unknown. An estimated initial weight is never used as a growth baseline.';

alter table public.weight_logs
  add column if not exists weight_type text not null default 'measured';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'weight_logs_weight_type_chk') then
    alter table public.weight_logs add constraint weight_logs_weight_type_chk
      check (weight_type in ('measured','estimated'));
  end if;
end $$;
comment on column public.weight_logs.weight_type is 'measured (scale/tape) or estimated (visual guess)';

commit;
