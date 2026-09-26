-- Rollback of 20260927120000_cash_counts (drops the counts that were written down).
begin;
drop table if exists public.cash_counts;
commit;
