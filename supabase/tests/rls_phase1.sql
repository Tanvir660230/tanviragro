-- RLS / privilege regression tests for 20260924120000_phase1_rls_hardening.sql
-- Runs on a throwaway database that has all migrations applied (never on production).
-- Each check prints "PASS <name>" or "FAIL <name>: <detail>" via NOTICE; the final
-- statement raises if anything failed, so psql exits non-zero.
-- Simulates PostgREST: SET ROLE authenticated/anon + request.jwt.claims.

\set ON_ERROR_STOP on
set client_min_messages = notice;

create temp table _results (name text, ok boolean, detail text);
grant all on _results to public;

create or replace function pg_temp.act_as(p_sub uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'role', p_role)::text, false);
  execute format('set role %I', p_role);
end $$;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void
language plpgsql as $$
begin
  insert into _results values (p_name, coalesce(p_ok, false), p_detail);
  raise notice '%', (case when coalesce(p_ok,false) then 'PASS ' else 'FAIL ' end) || p_name
    || (case when coalesce(p_ok,false) then '' else ': ' || coalesce(p_detail,'') end);
end $$;

-- ── Fixtures (as superuser; the signup trigger creates a profile + business per user) ──
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test', '{"full_name":"Owner A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test', '{"full_name":"Owner B"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'worker@test',  '{"full_name":"Worker"}');

create temp table _ids as
select
  (select id from public.businesses where owner_id = '00000000-0000-0000-0000-00000000000a') as biz_a,
  (select id from public.businesses where owner_id = '00000000-0000-0000-0000-00000000000b') as biz_b;
grant select on _ids to public;

insert into public.business_users (business_id, user_id, role)
select biz_a, '00000000-0000-0000-0000-0000000000a1', 'worker' from _ids;

insert into public.farms (business_id, name, code) select biz_a, 'Farm A', 'FA' from _ids;
insert into public.farms (business_id, name, code) select biz_b, 'Farm B', 'FB' from _ids;

insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict do nothing;
insert into storage.objects (bucket_id, name, owner, owner_id) values
  ('avatars', 'owner-a/pic.png', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a');

-- ── SEC-02: worker cannot escalate their own membership ───────────────────
do $$
declare n int; biz_b uuid := (select biz_b from _ids);
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  update public.business_users set role = 'owner' where user_id = auth.uid();
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.check('worker cannot set own role to owner', n = 0, n || ' row(s) updated');
end $$;

do $$
declare n int; biz_b uuid := (select biz_b from _ids);
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  update public.business_users set business_id = biz_b where user_id = auth.uid();
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.check('worker cannot move own membership to another business', n = 0, n || ' row(s) updated');
end $$;

do $$
declare ok boolean := false; biz_b uuid := (select biz_b from _ids);
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  begin
    insert into public.business_users (business_id, user_id, role) values (biz_b, auth.uid(), 'owner');
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  reset role;
  perform pg_temp.check('worker cannot insert themselves into another business', ok, 'insert succeeded');
end $$;

do $$
declare n int; biz_a uuid := (select biz_a from _ids);
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
  update public.business_users set role = 'manager'
   where business_id = biz_a and user_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  update public.business_users set role = 'worker'
   where business_id = biz_a and user_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  perform pg_temp.check('owner can still change a member role', n = 1, n || ' row(s) updated');
end $$;

-- ── Tenant reads ─────────────────────────────────────────────────────────
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  select count(*) into n from public.businesses where id = (select biz_a from _ids);
  reset role;
  perform pg_temp.check('worker can read their employer business row', n = 1, n || ' visible');
end $$;

-- ── SEC-03: farms (was: no RLS) ─────────────────────────────────────────────
do $$
declare n_a int; n_b int; n_out int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  select count(*) into n_a from public.farms where business_id = (select biz_a from _ids);
  select count(*) into n_b from public.farms where business_id = (select biz_b from _ids);
  reset role;
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
  select count(*) into n_out from public.farms where business_id = (select biz_a from _ids);
  reset role;
  perform pg_temp.check('member sees own farms', n_a = 1, n_a || ' visible');
  perform pg_temp.check('member cannot see other tenant farms', n_b = 0, n_b || ' visible');
  perform pg_temp.check('outsider cannot see farms of A', n_out = 0, n_out || ' visible');
end $$;

do $$
declare n int := -1; denied boolean := false;
begin
  perform pg_temp.act_as(null, 'anon');
  begin
    select count(*) into n from public.farms;
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  perform pg_temp.check('anon cannot read farms', denied or n = 0, n || ' visible');
end $$;

-- ── SEC-10: profiles ────────────────────────────────────────────────────────
do $$
declare n int := -1; denied boolean := false;
begin
  perform pg_temp.act_as(null, 'anon');
  begin
    select count(*) into n from public.profiles;
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  perform pg_temp.check('anon cannot read profiles', denied or n = 0, n || ' visible');
end $$;

do $$
declare n_team int; n_out int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
  select count(*) into n_team from public.profiles where id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into n_out from public.profiles where id = '00000000-0000-0000-0000-00000000000b';
  reset role;
  perform pg_temp.check('owner can see teammate profile', n_team = 1, n_team || ' visible');
  perform pg_temp.check('owner cannot see unrelated profile', n_out = 0, n_out || ' visible');
end $$;

-- ── SEC-04: SECURITY DEFINER functions ───────────────────────────────────────
do $$
declare r json;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  r := public.get_user_business_role('00000000-0000-0000-0000-00000000000b');
  reset role;
  perform pg_temp.check('get_user_business_role refuses other users', r is null, coalesce(r::text,'null'));
end $$;

do $$
begin
  perform pg_temp.check('anon cannot execute get_user_business_role',
    not has_function_privilege('anon', 'public.get_user_business_role(uuid)', 'execute'));
  perform pg_temp.check('get_finance_summary dropped',
    to_regprocedure('public.get_finance_summary(uuid)') is null);
end $$;

do $$
declare ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  begin
    perform public.log_audit((select biz_b from _ids), '00000000-0000-0000-0000-00000000000b',
                             'forged', 'x', 'y');
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  perform pg_temp.check('log_audit rejects foreign business', ok, 'forged row inserted');
end $$;

do $$
declare v_id uuid; v_user uuid;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  v_id := public.log_audit((select biz_a from _ids), '00000000-0000-0000-0000-00000000000b',
                           'real', 'x', 'y');
  reset role;
  select user_id into v_user from public.audit_logs where id = v_id;
  perform pg_temp.check('log_audit forces user_id to caller',
    v_user = '00000000-0000-0000-0000-0000000000a1', coalesce(v_user::text, 'null'));
end $$;

do $$
declare ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  begin
    perform public.revoke_user_sessions('00000000-0000-0000-0000-00000000000a',
                                        '00000000-0000-0000-0000-0000000000a1', (select biz_a from _ids));
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  perform pg_temp.check('worker cannot revoke owner sessions', ok, 'revocation allowed');
end $$;

-- ── SEC-10: storage avatar overwrite ─────────────────────────────────────────
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
  update storage.objects set name = 'owner-a/hacked.png' where name = 'owner-a/pic.png';
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.check('user cannot overwrite another user avatar', n = 0, n || ' row(s) updated');
end $$;

-- ── Summary ────────────────────────────────────────────────────────────────
do $$
declare f int; t int;
begin
  select count(*) filter (where not ok), count(*) into f, t from _results;
  raise notice '== % of % checks passed', t - f, t;
  if f > 0 then raise exception '% RLS check(s) failed', f; end if;
end $$;
