-- Undo 20261014090000_cash_holders.sql (the app keeps working without the tables: the holder view is hidden).
begin;
drop table if exists public.cash_holder_log;
alter table public.cash_counts drop constraint if exists cash_counts_holder_fk;
drop index if exists public.idx_cash_counts_holder;
alter table public.cash_counts drop column if exists holder_id;
drop table if exists public.cash_handovers;
drop table if exists public.cash_holder_tags;
drop table if exists public.cash_holders;
commit;
