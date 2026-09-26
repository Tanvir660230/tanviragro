-- ============================================================================
-- Partner share rules with a start date, and retiring a partner instead of deleting.
--
-- A partner's share (fixed % of profit, or taka × days), and whether they bear loss, can
-- change over time: "Mohiuddin 50% → 40% from 1 October". Each change is a row that applies
-- from `effective_from` until the partner's next row. Nothing is overwritten, so past
-- results keep the rule that was in force (lib/partners/position.ts reads these rows).
--
-- `partners.left_at`: a partner who leaves keeps their history; from that day they get no
-- new share (their money is withdrawn as a normal withdrawal).
--
-- Backfill: every partner gets one row from the day they joined with their current setting.
-- Rollback: supabase/rollback/20260927090000_partner_share_rules_down.sql
-- ============================================================================
begin;

create table if not exists public.partner_share_rules (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  partner_id     uuid not null references public.partners(id) on delete cascade,
  effective_from date not null,
  share_mode     text not null check (share_mode in ('auto', 'manual')),
  fixed_pct      numeric(6,3) not null default 0 check (fixed_pct >= 0 and fixed_pct <= 100),
  bears_loss     boolean not null default true,
  note           text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  deleted_at     timestamptz
);
-- one live rule per partner per day
create unique index if not exists uq_partner_share_rule_day
  on public.partner_share_rules (partner_id, effective_from) where deleted_at is null;
create index if not exists idx_partner_share_rules_business on public.partner_share_rules (business_id, effective_from);

alter table public.partner_share_rules enable row level security;
drop policy if exists "tenant members" on public.partner_share_rules;
-- the same access as the partners table: team members where the membership helper exists
-- (migration 20260924120000), otherwise the owner (production had not run that migration on 2026-09-26)
do $$
begin
  if to_regprocedure('public.is_business_member(uuid)') is not null then
    execute 'create policy "tenant members" on public.partner_share_rules for all '
            'using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))';
  else
    execute 'create policy "tenant members" on public.partner_share_rules for all '
            'using (business_id in (select b.id from public.businesses b where b.owner_id = auth.uid())) '
            'with check (business_id in (select b.id from public.businesses b where b.owner_id = auth.uid()))';
  end if;
end $$;

-- a rule belongs to its partner's business
create or replace function public.trg_partner_share_rule_business() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.partners p where p.id = new.partner_id and p.business_id = new.business_id) then
    raise exception 'Partner belongs to another business' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_partner_share_rule_business on public.partner_share_rules;
create trigger trg_partner_share_rule_business before insert or update on public.partner_share_rules
  for each row execute function public.trg_partner_share_rule_business();

alter table public.partners add column if not exists left_at date;

insert into public.partner_share_rules (business_id, partner_id, effective_from, share_mode, fixed_pct, bears_loss, note)
select p.business_id, p.id, p.joined_at,
       case when p.share_mode = 'manual' then 'manual' else 'auto' end,
       case when p.share_mode = 'manual' then coalesce(p.profit_share_pct, 0) else 0 end,
       case when p.partner_type = 'labor' then false else coalesce(p.bears_loss, true) end,
       'Setting at the time share rules began'
from public.partners p
where p.deleted_at is null
  and not exists (select 1 from public.partner_share_rules r where r.partner_id = p.id and r.deleted_at is null);

commit;
