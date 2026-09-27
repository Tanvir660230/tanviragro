-- Rollback of 20260928090000_cattle_status_rules.sql
-- Removes the trigger. The data changes are kept on purpose: animals converted from status
-- 'quarantined' stay active with is_quarantined = true (the meaning they always had), and the
-- back-filled death records ("Not recorded") only add a date that was missing.
begin;
drop trigger if exists trg_cattle_quarantine_is_a_flag on public.cattle;
drop function if exists public.cattle_quarantine_is_a_flag();
commit;
