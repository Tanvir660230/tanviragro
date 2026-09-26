-- Rollback of 20260927100000. Enum values cannot be dropped in Postgres; they stay unused.
-- Rows of the new types must be removed or changed first, or the app will read them as unknown.
begin;
drop table if exists public.partner_cycles;
alter table public.partner_transactions drop column if exists cost_entry_id;
commit;
