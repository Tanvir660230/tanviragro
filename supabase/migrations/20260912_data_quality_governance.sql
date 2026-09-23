-- ================================================================
-- Tanvir Agro ERP — Phase 3.3: Data Quality & Governance
-- Read-only data quality audit RPC for tenant-scoped integrity checks.
--
-- SAFETY: This migration contains NO writes to production data.
--   • All checks are SELECT-only.
--   • Function is SECURITY INVOKER so RLS is enforced — a tenant can
--     only audit rows its own policies allow.
--   • No schema, constraint, or policy is dropped or weakened.
--
-- Deployment: apply via `supabase db push` by a DBA in the normal
-- migration pipeline. Rollback is provided at the bottom.
-- ================================================================

create or replace function public.get_data_quality_report(p_business_id uuid)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_json jsonb := '[]'::jsonb;
  v_check jsonb;
  v_issue_count int := 0;
  v_overall_healthy boolean := true;
begin
  if p_business_id is null then
    raise exception 'p_business_id is required';
  end if;

  -- ── Check 1: Duplicate cattle tags within the tenant ────────────
  begin
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'tag_id', d.tag_id,
        'count', d.cnt,
        'cattle_ids', d.ids
      )
    ), '[]'::jsonb)
    into v_check
    from (
      select tag_id, count(*) as cnt,
             jsonb_agg(id::text) as ids
      from cattle
      where business_id = p_business_id
        and deleted_at is null
      group by tag_id
      having count(*) > 1
      order by cnt desc
    ) d;

    select count(*) into v_issue_count
    from (
      select tag_id from cattle
      where business_id = p_business_id
        and deleted_at is null
      group by tag_id
      having count(*) > 1
    ) dup;
    v_issue_count := coalesce(v_issue_count, 0);

    v_json := v_json || jsonb_build_object(
      'check', 'duplicate_cattle_tags',
      'description', 'Cattle records sharing the same ear tag within one business',
      'passed', v_issue_count = 0,
      'issue_count', v_issue_count,
      'details', v_check
    );
    if v_issue_count > 0 then v_overall_healthy := false; end if;
  exception when others then
    v_json := v_json || jsonb_build_object(
      'check', 'duplicate_cattle_tags',
      'passed', false,
      'issue_count', -1,
      'error', sqlerrm,
      'details', '[]'::jsonb
    );
  end;

  -- ── Check 2: Orphaned weight logs (missing cattle) ──────────────
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'weight_log_id', w.id::text,
      'cattle_id', w.cattle_id::text
    )), '[]'::jsonb)
    into v_check
    from weight_logs w
    where w.cattle_id not in (
      select id from cattle where business_id = p_business_id
    );

    select count(*) into v_issue_count from weight_logs w
    where w.cattle_id not in (
      select id from cattle where business_id = p_business_id
    );

    v_json := v_json || jsonb_build_object(
      'check', 'orphaned_weight_logs',
      'description', 'Weight logs referencing cattle outside the tenant or missing cattle',
      'passed', coalesce(v_issue_count, 0) = 0,
      'issue_count', v_issue_count,
      'details', v_check
    );
    if coalesce(v_issue_count, 0) > 0 then v_overall_healthy := false; end if;
  exception when others then
    v_json := v_json || jsonb_build_object(
      'check', 'orphaned_weight_logs',
      'passed', false,
      'issue_count', -1,
      'error', sqlerrm,
      'details', '[]'::jsonb
    );
  end;
-- ── Check 3: Negative stock computed from transactions ──────────
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'item_id', s.item_id::text,
      'item_name', s.item_name,
      'net_stock', s.net_stock
    )), '[]'::jsonb)
    into v_check
    from (
      select it.item_id,
             ii.name as item_name,
             round(coalesce(sum(
               case
                 when it.type = 'purchase'    then it.qty
                 when it.type = 'consumption' then -it.qty
                 else 0
               end
             ), 0)::numeric, 4)::float8 as net_stock
      from inventory_transactions it
      join inventory_items ii on ii.id = it.item_id
      where ii.business_id = p_business_id
      group by it.item_id, ii.name
      having round(coalesce(sum(
        case
          when it.type = 'purchase'    then it.qty
          when it.type = 'consumption' then -it.qty
          else 0
        end
      ), 0)::numeric, 4) < -0.0001
      order by net_stock
    ) s;

    select count(*) into v_issue_count from (
      select it.item_id
      from inventory_transactions it
      join inventory_items ii on ii.id = it.item_id
      where ii.business_id = p_business_id
      group by it.item_id
      having round(coalesce(sum(
        case
          when it.type = 'purchase'    then it.qty
          when it.type = 'consumption' then -it.qty
          else 0
        end
      ), 0)::numeric, 4) < -0.0001
    ) neg;

    v_json := v_json || jsonb_build_object(
      'check', 'negative_stock_items',
      'description', 'Inbound/outbound transaction sums below zero (guard trigger should prevent new ones)',
      'passed', coalesce(v_issue_count, 0) = 0,
      'issue_count', v_issue_count,
      'details', v_check
    );
    if coalesce(v_issue_count, 0) > 0 then v_overall_healthy := false; end if;
  exception when others then
    v_json := v_json || jsonb_build_object(
      'check', 'negative_stock_items',
      'passed', false,
      'issue_count', -1,
      'error', sqlerrm,
      'details', '[]'::jsonb
    );
  end;
-- ── Check 4: Cross-tenant anomalies ─────────────────────────────
  -- Querying across tenants here is blocked by RLS for authenticated
  -- callers; this check flags any row the caller can see whose
  -- tenant scoping disagrees, which should be impossible for
  -- well-formed RLS policies.
  begin
    v_check := '[]'::jsonb;
    v_issue_count := 0;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'cost_entries'
        and column_name = 'business_id'
    ) then
      select jsonb_agg(jsonb_build_object(
               'table', 'cost_entries', 'record_id', id::text
             ))
        into v_check
        from cost_entries
        where business_id is distinct from p_business_id;
      v_check := coalesce(v_check, '[]'::jsonb);
      select count(*) into v_issue_count from cost_entries
        where business_id is distinct from p_business_id;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'inventory_items'
        and column_name = 'business_id'
    ) then
      select v_check || coalesce(jsonb_agg(jsonb_build_object(
               'table', 'inventory_items', 'record_id', id::text
             )), '[]'::jsonb)
        into v_check
        from inventory_items
        where business_id is distinct from p_business_id;
      select v_issue_count + count(*) into v_issue_count
        from inventory_items
        where business_id is distinct from p_business_id;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'sales'
        and column_name = 'cattle_id'
    ) then
      select v_check || coalesce(jsonb_agg(jsonb_build_object(
               'table', 'sales', 'record_id', id::text
             )), '[]'::jsonb)
        into v_check
        from sales s
        where s.cattle_id in (
          select id from cattle
          where business_id is distinct from p_business_id
        );
      select v_issue_count + count(*) into v_issue_count
        from sales s
        where s.cattle_id in (
          select id from cattle
          where business_id is distinct from p_business_id
        );
    end if;

    v_json := v_json || jsonb_build_object(
      'check', 'cross_tenant_anomalies',
      'description', 'Records visible to this caller whose tenant scoping disagrees',
      'passed', coalesce(v_issue_count, 0) = 0,
      'issue_count', v_issue_count,
      'details', v_check
    );
    if coalesce(v_issue_count, 0) > 0 then v_overall_healthy := false; end if;
  exception when others then
    v_json := v_json || jsonb_build_object(
      'check', 'cross_tenant_anomalies',
      'passed', false,
      'issue_count', -1,
      'error', sqlerrm,
      'details', '[]'::jsonb
    );
  end;
-- ── Check 5: Cattle with missing required fields ────────────────
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'cattle_id', c.id::text,
      'missing_fields', c.missing
    )), '[]'::jsonb)
    into v_check
    from (
      select id, (
        select jsonb_agg(f) from unnest(
          case
            when tag_id is null or btrim(tag_id) = '' then array['tag_id']
            else '{}'::text[]
          end ||
          case
            when purchase_date is null then array['purchase_date']
            else '{}'::text[]
          end ||
          case
            when purchase_price is null or purchase_price <= 0 then array['purchase_price']
            else '{}'::text[]
          end
        ) f
      ) as missing
      from cattle
      where business_id = p_business_id and deleted_at is null
    ) c
    where jsonb_array_length(coalesce(c.missing, '[]'::jsonb)) > 0;

    select count(*) into v_issue_count from (
      select id
      from cattle
      where business_id = p_business_id and deleted_at is null
        and (tag_id is null or btrim(tag_id) = ''
             or purchase_date is null
             or purchase_price is null or purchase_price <= 0)
    ) bad;

    v_json := v_json || jsonb_build_object(
      'check', 'cattle_missing_required_fields',
      'description', 'Active cattle missing tag_id, purchase_date, or a positive purchase_price',
      'passed', coalesce(v_issue_count, 0) = 0,
      'issue_count', v_issue_count,
      'details', v_check
    );
    if coalesce(v_issue_count, 0) > 0 then v_overall_healthy := false; end if;
  exception when others then
    v_json := v_json || jsonb_build_object(
      'check', 'cattle_missing_required_fields',
      'passed', false,
      'issue_count', -1,
      'error', sqlerrm,
      'details', '[]'::jsonb
    );
  end;

  return json_build_object(
    'business_id', p_business_id,
    'generated_at', now(),
    'overall_healthy', v_overall_healthy,
    'total_issue_count', coalesce((
      select sum(case when (c->>'issue_count')::int > 0 then (c->>'issue_count')::int else 0 end)
      from jsonb_array_elements(v_json) c
    ), 0),
    'checks', v_json
  );
end;
$$;

grant execute on function public.get_data_quality_report(uuid) to authenticated;

-- ================================================================
-- ROLLBACK:
--   drop function if exists public.get_data_quality_report(uuid);
-- ================================================================