-- Rollback of 20260927090000_partner_share_rules.sql. The app falls back to the partner's own
-- share fields when the rules table is missing (lib/partners/load-positions.ts).
begin;
drop table if exists public.partner_share_rules;
drop function if exists public.trg_partner_share_rule_business();
alter table public.partners drop column if exists left_at;
commit;
