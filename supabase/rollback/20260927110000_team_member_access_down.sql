-- Rollback of 20260927110000: remove the "team members" policies it added (owners keep theirs).
-- Note: 20260924120000 also names its policies "tenant members" (not "team members"), so they stay.
begin;
do $$
declare r record;
begin
  for r in select tablename from pg_policies where schemaname = 'public' and policyname = 'team members' loop
    execute format('drop policy if exists "team members" on public.%I', r.tablename);
  end loop;
end $$;
commit;
