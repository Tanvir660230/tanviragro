#!/usr/bin/env bash
# Apply ledger migration + corrections to a fresh production copy, then roll both back and
# verify that every original row is exactly as before and stock/value nets are unchanged.
set -uo pipefail
# Usage: TEST_DB=<local copy> bash supabase/tests/feed_ledger_rollback.sh
# The database must be a LOCAL copy loaded with data but WITHOUT the ledger migration.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$HERE/../.."
PSQL="${PG_BIN:+$PG_BIN/}psql"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGCLIENTENCODING=UTF8
case "$PGHOST" in 127.0.0.1|localhost|::1) ;; *) echo "refusing non-local host $PGHOST"; exit 2;; esac
DB="${TEST_DB:?set TEST_DB to a local copy}"
q() { "$PSQL" -At -d "$DB" -v ON_ERROR_STOP=1 -c "$1"; }
run() { "$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"${TMPDIR:-/tmp}/rollback_$DB.err" || { echo "FAILED: $1"; cat "${TMPDIR:-/tmp}/rollback_$DB.err"; exit 1; }; }

# fingerprint of the 665 original rows (fields that existed before the migration)
FP="select md5(string_agg(id::text||'|'||type||'|'||trim_scale(qty)::text||'|'||coalesce(trim_scale(unit_cost)::text,'NULL')||'|'||recorded_at::text||'|'||coalesce(notes,''), ',' order by id)) from public.inventory_transactions where id in (select id from _orig)"
NET="select string_agg(item_id::text||'='||round(q,4)||'/'||round(v,2), ';' order by item_id) from (select item_id, sum(case when type='purchase' then qty else -qty end) q, sum(case when type='purchase' then qty*coalesce(unit_cost,0) else -qty*coalesce(unit_cost,0) end) v from public.inventory_transactions group by item_id) s"

# cost entries and cattle must also come back exactly
FPX="select md5(coalesce((select string_agg(id::text||'|'||category||'|'||amount::text||'|'||recorded_at::text||'|'||coalesce(deleted_at::text,''), ',' order by id) from public.cost_entries),'')||coalesce((select string_agg(id::text||'|'||coalesce(initial_weight_kg::text,''), ',' order by id) from public.cattle),''))"
q "create table public._orig as select id from public.inventory_transactions" >/dev/null
fp0=$(q "$FP"); net0=$(q "$NET"); n0=$(q "select count(*) from public.inventory_transactions"); fpx0=$(q "$FPX")
echo "original: rows=$n0 fingerprint=$fp0"

run "$REPO/supabase/migrations/20260925100000_feed_inventory_ledger.sql"
run "$REPO/supabase/migrations/20260925110000_expense_categories.sql"
run "$REPO/supabase/migrations/20260925120000_weight_types.sql"
run "$REPO/supabase/migrations/20260925130000_feed_usage_periods.sql"
run "$REPO/supabase/corrections/20260925_feed_historical_corrections.sql"
# exercise a usage period on the real data: straw in use 2026-08-28 → 2026-09-20, 128 pieces left
q "select public.close_feed_usage_period(public.open_feed_usage_period(business_id, 'item', id, '2026-08-28'), '2026-09-20', jsonb_build_array(jsonb_build_object('item_id', id, 'qty', 128))) from public.inventory_items where name like 'Straw%'" >/dev/null
echo "straw period: $(q "select status || ' consumed=' || consumed_qty || ' value=' || consumed_value from public.v_feed_usage_lines where item_name like 'Straw%'")"
run "$REPO/supabase/corrections/20260925_feed_historical_corrections.sql"   # idempotent
echo "after corrections: wifi=$(q "select category from public.cost_entries where id='17a72421-538f-44ac-a78a-50d97647b57d'") estimated_weights=$(q "select count(*) from public.cattle where initial_weight_type='estimated'")"
echo "applied: rows=$(q "select count(*) from public.inventory_transactions") audit=$(q "select count(*) from public.inventory_ledger_audit")"

run "$REPO/supabase/rollback/20260925_feed_historical_corrections_down.sql"
echo "corrections rolled back: rows=$(q "select count(*) from public.inventory_transactions") rollback-audit=$(q "select count(*) from public.inventory_ledger_audit where action='rollback'")"
run "$REPO/supabase/rollback/20260925_feed_historical_corrections_down.sql"   # idempotent
echo "second corrections rollback: rows=$(q "select count(*) from public.inventory_transactions")"

run "$REPO/supabase/rollback/20260925130000_feed_usage_periods_down.sql"
run "$REPO/supabase/rollback/20260925120000_weight_types_down.sql"
run "$REPO/supabase/rollback/20260925110000_expense_categories_down.sql"
run "$REPO/supabase/rollback/20260925100000_feed_inventory_ledger_down.sql"
fp1=$(q "$FP"); net1=$(q "$NET"); fpx1=$(q "$FPX")
cols=$(q "select count(*) from information_schema.columns where table_name='inventory_transactions' and column_name in ('movement_type','idempotency_key','cost_source','is_estimate','reverses_id','created_by')")
trg=$(q "select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid='public.inventory_transactions'::regclass and not tgisinternal")
kept=$(q "select to_regclass('public.inventory_ledger_audit_rolled_back') is not null")
echo "ledger rolled back: new columns left=$cols triggers=$trg audit kept=$kept"

ok=1
[ "$fp0" = "$fp1" ] && echo "PASS original rows identical (every value) after full rollback" || { echo "FAIL original rows changed"; ok=0; }
[ "$net0" = "$net1" ] && echo "PASS stock and value per item identical after full rollback" || { echo "FAIL per-item net changed"; echo "$net0"; echo "$net1"; ok=0; }
[ "$fpx0" = "$fpx1" ] && echo "PASS cost entries and cattle identical after full rollback" || { echo "FAIL cost entries / cattle changed"; ok=0; }
[ "$cols" = "0" ] && echo "PASS ledger columns removed" || { echo "FAIL columns remain"; ok=0; }
[[ "$trg" == *trg_check_inventory_stock* ]] && echo "PASS old stock guard restored" || { echo "FAIL old guard missing"; ok=0; }
[ "$kept" = "t" ] && echo "PASS audit trail kept (renamed)" || { echo "FAIL audit trail lost"; ok=0; }
q "drop table public._orig" >/dev/null
[ $ok = 1 ] && echo "== rollback test passed" || { echo "== rollback test FAILED"; exit 1; }
