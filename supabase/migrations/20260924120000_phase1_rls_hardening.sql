-- ============================================================================
-- Phase 1 security hardening: RLS + SECURITY DEFINER functions
-- Audit IDs: SEC-02, SEC-03, SEC-04, SEC-10 (see docs/TANVIR_AGRO_AUDIT_REPORT.md)
--
-- STATUS: NOT APPLIED. Written 2026-09-24 without access to the live policy list.
-- BEFORE APPLYING:
--   1. Run docs/sql/live_security_snapshot.sql on production and review section 2:
--      any extra permissive policy on these tables (e.g. USING (true)) would still
--      grant access, because permissive policies are OR-ed. Drop those too.
--   2. Take a backup (or confirm PITR).
--   3. Apply to a STAGING project first; log in as owner and as a worker and
--      click through cattle, inventory, finance, team, profile avatar upload.
--   4. Then apply to production (supabase db push, or paste into the SQL editor).
-- Idempotent: safe to re-run.
-- ============================================================================

begin;

-- ── 0. Prerequisite column (added by 032; guard in case 032 was never applied) ──
alter table public.business_users add column if not exists is_active boolean not null default true;

-- ── 1. Helper predicates ───────────────────────────────────────────────────
-- SECURITY DEFINER so policies on businesses <-> business_users don't recurse.
create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  );
$$;

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.business_users bu
    where bu.business_id = p_business_id and bu.user_id = auth.uid() and bu.is_active
  );
$$;

-- True when auth.uid() and p_user_id belong to at least one common business.
create or replace function public.shares_business_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where public.is_business_member(b.id)
      and (
        b.owner_id = p_user_id
        or exists (
          select 1 from public.business_users bu
          where bu.business_id = b.id and bu.user_id = p_user_id and bu.is_active
        )
      )
  );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.shares_business_with(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated, service_role;
grant execute on function public.is_business_member(uuid) to authenticated, service_role;
grant execute on function public.shares_business_with(uuid) to authenticated, service_role;

-- ── 2. SEC-02: business_users — no self-escalation ──────────────────────────
-- Old policies let a member UPDATE/INSERT their own row (role -> 'owner', or any business_id).
drop policy if exists "Owners can manage business_users" on public.business_users;
drop policy if exists "business_users team isolation" on public.business_users;
drop policy if exists "business_users read" on public.business_users;
drop policy if exists "business_users owner insert" on public.business_users;
drop policy if exists "business_users owner update" on public.business_users;
drop policy if exists "business_users owner delete" on public.business_users;

create policy "business_users read" on public.business_users
  for select using (user_id = auth.uid() or public.is_business_member(business_id));
create policy "business_users owner insert" on public.business_users
  for insert with check (public.is_business_owner(business_id));
create policy "business_users owner update" on public.business_users
  for update using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
create policy "business_users owner delete" on public.business_users
  for delete using (public.is_business_owner(business_id));

-- Members may READ their business row (writes stay owner-only via the 001 policy).
drop policy if exists "members can view their business" on public.businesses;
create policy "members can view their business" on public.businesses
  for select using (public.is_business_member(id));

-- ── 3. SEC-03: tables created in 026 without RLS ─────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'farms','pens','animal_categories','disease_records','breeding_records',
    'cattle_death_records','document_attachments','livestock_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant members" on public.%I', t);
    execute format(
      'create policy "tenant members" on public.%I for all '
      'using (public.is_business_member(business_id)) '
      'with check (public.is_business_member(business_id))', t);
  end loop;
end $$;

-- animal_breeds: business_id NULL = shared reference data (readable, not writable).
alter table public.animal_breeds enable row level security;
drop policy if exists "breeds read" on public.animal_breeds;
drop policy if exists "breeds tenant write" on public.animal_breeds;
create policy "breeds read" on public.animal_breeds
  for select to authenticated
  using (business_id is null or public.is_business_member(business_id));
create policy "breeds tenant write" on public.animal_breeds
  for all to authenticated
  using (business_id is not null and public.is_business_member(business_id))
  with check (business_id is not null and public.is_business_member(business_id));

-- ── 4. SEC-04: SECURITY DEFINER functions that trusted caller-supplied IDs ──
-- Broken (references it.inventory_item_id) and unused by the app.
drop function if exists public.get_finance_summary(uuid);

-- Only ever answers for the caller.
create or replace function public.get_user_business_role(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_biz_id uuid;
  v_role text;
begin
  if p_user_id is distinct from auth.uid() then
    return null;
  end if;

  select id into v_biz_id from public.businesses where owner_id = p_user_id limit 1;
  if v_biz_id is not null then
    return json_build_object('business_id', v_biz_id, 'role', 'owner');
  end if;

  select business_id, role::text into v_biz_id, v_role
  from public.business_users
  where user_id = p_user_id and is_active
  limit 1;
  if v_biz_id is not null then
    return json_build_object('business_id', v_biz_id, 'role', v_role);
  end if;

  return null;
end;
$$;

-- Audit rows: caller must belong to the business; user_id is forced to the caller.
create or replace function public.log_audit(
  p_business_id uuid, p_user_id uuid,
  p_action text, p_entity_type text, p_entity_id text,
  p_old_value jsonb default null, p_new_value jsonb default null,
  p_metadata jsonb default null, p_ip_address text default null,
  p_user_agent text default null, p_severity text default 'info'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_user uuid := p_user_id;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;
    if p_business_id is not null and not public.is_business_member(p_business_id) then
      raise exception 'not a member of this business' using errcode = '42501';
    end if;
    v_user := auth.uid();
  end if;

  insert into public.audit_logs (
    business_id, user_id, action, entity_type, entity_id,
    old_value, new_value, metadata, ip_address, user_agent, severity
  ) values (
    p_business_id, v_user, p_action, p_entity_type, p_entity_id,
    p_old_value, p_new_value, p_metadata, p_ip_address, p_user_agent, p_severity
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Session revocation: owner of the business, or the user themself.
create or replace function public.revoke_user_sessions(
  p_target_user_id uuid, p_revoked_by uuid, p_business_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_by uuid := p_revoked_by;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;
    if p_target_user_id is distinct from auth.uid()
       and not public.is_business_owner(p_business_id) then
      raise exception 'not allowed to revoke these sessions' using errcode = '42501';
    end if;
    v_by := auth.uid();
  end if;

  update public.user_sessions
  set is_active = false, revoked_at = now(), revoked_by = v_by
  where user_id = p_target_user_id and business_id = p_business_id and is_active = true;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.get_user_business_role(uuid) from public, anon;
revoke all on function public.log_audit(uuid,uuid,text,text,text,jsonb,jsonb,jsonb,text,text,text) from public, anon;
revoke all on function public.revoke_user_sessions(uuid,uuid,uuid) from public, anon;
grant execute on function public.get_user_business_role(uuid) to authenticated, service_role;
grant execute on function public.log_audit(uuid,uuid,text,text,text,jsonb,jsonb,jsonb,text,text,text) to authenticated, service_role;
grant execute on function public.revoke_user_sessions(uuid,uuid,uuid) to authenticated, service_role;

-- ── 5. SEC-10: profiles + storage ───────────────────────────────────────────
-- Confirmed 2026-09-24: the anon key could read all profile rows.
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "profiles visible to self and teammates" on public.profiles;
create policy "profiles visible to self and teammates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_business_with(id));

-- Any authenticated user could overwrite any avatar/logo object.
drop policy if exists "Anyone can update their avatar." on storage.objects;
drop policy if exists "Authenticated users can update logos." on storage.objects;
drop policy if exists "avatar owner can update" on storage.objects;
drop policy if exists "logo owner can update" on storage.objects;
create policy "avatar owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
  with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy "logo owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and owner_id = auth.uid()::text)
  with check (bucket_id = 'logos' and owner_id = auth.uid()::text);

commit;

-- ── Post-apply checks (run manually; expected results in comments) ──────────
-- select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity;
--   -> 0 rows
-- select has_function_privilege('anon','public.get_user_business_role(uuid)','execute');   -> false
-- select to_regprocedure('public.get_finance_summary(uuid)');                             -> null
-- As a WORKER session: update business_users set role='owner' where user_id=auth.uid();  -> 0 rows updated
-- As ANON: select count(*) from profiles;                                                  -> permission error or 0
