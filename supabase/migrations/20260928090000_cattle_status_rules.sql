-- ============================================================================
-- Cattle status rules: one meaning for "quarantined", a dated death for every dead animal.
--
-- 1. Quarantine is a FLAG (is_quarantined) on an animal that is still on the farm — never a
--    status. Some screens wrote status = 'quarantined'; every calculation (homepage, cattle
--    list, feed split, Money, partners) counts only status 'active' as on the farm, so such an
--    animal vanished: it was listed as "dead", its cost shown as a loss, its feed given to others.
--    Existing rows are converted, and a trigger turns any future 'quarantined' write into
--    status 'active' + is_quarantined = true, whichever screen writes it.
-- 2. Every dead animal has a cattle_death_records row (the death date). Dead animals marked
--    from the list had none, so the feed split used the row's last edit time as the death day.
--    Existing ones get a record dated on their last update (the best date known), cause
--    "Not recorded" — the owner can correct it.
--
-- 3. Sold or dead animals keep no open health tasks (they showed as "overdue" forever). Only
--    tasks not done yet are cancelled, with the same note the app uses, so undoing a death
--    brings them back.
--
-- Rollback: supabase/rollback/20260928090000_cattle_status_rules_down.sql
-- ============================================================================
begin;

-- 1. quarantine: status → flag
update public.cattle
   set status = 'active', is_quarantined = true
 where status = 'quarantined';

create or replace function public.cattle_quarantine_is_a_flag()
returns trigger language plpgsql as $$
begin
  if new.status = 'quarantined' then
    new.status := 'active';
    new.is_quarantined := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_cattle_quarantine_is_a_flag on public.cattle;
create trigger trg_cattle_quarantine_is_a_flag
  before insert or update of status on public.cattle
  for each row execute function public.cattle_quarantine_is_a_flag();

-- 2. a dated death record for every dead animal that has none
insert into public.cattle_death_records (business_id, cattle_id, death_date, cause_of_death)
select c.business_id, c.id, (c.updated_at at time zone 'Asia/Dhaka')::date, 'Not recorded'
  from public.cattle c
 where c.status = 'dead'
   and c.deleted_at is null
   and not exists (select 1 from public.cattle_death_records d where d.cattle_id = c.id)
on conflict (cattle_id) do nothing;

-- 3. no open health tasks for animals that have left
update public.health_events h
   set deleted_at = now(),
       notes = case when c.status = 'dead' then 'Auto-cancelled due to animal mortality'
                    else 'Auto-cancelled due to animal sale' end
  from public.cattle c
 where c.id = h.cattle_id
   and c.status in ('dead', 'sold')
   and h.completed_at is null
   and h.deleted_at is null;

commit;
