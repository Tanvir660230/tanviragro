#!/usr/bin/env bash
# Replays every migration into a THROWAWAY local Postgres database and runs the feed-ledger
# tests (supabase/tests/feed_ledger.sql). Never point this at production.
# Env: PG_BIN, PGHOST, PGPORT, PGUSER as in run_rls_tests.sh; TEST_DB (default tanviragro_ledger_test)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL="${PG_BIN:+$PG_BIN/}psql"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGCLIENTENCODING=UTF8
DB="${TEST_DB:-tanviragro_ledger_test}"
case "$DB" in *prod*|postgres) echo "refusing to use database '$DB'"; exit 2;; esac

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
cp "$HERE"/../migrations/*.sql "$WORK/"
# known replay defects in committed migrations (DB-11) — patched in the temp copy only
f="$WORK/003_new_features.sql"; alters="$(sed -n '13,14p' "$f")"
if grep -q "vendor_id uuid references vendors" <<<"$alters"; then sed -i '13,14d' "$f"; printf '\n%s\n' "$alters" >> "$f"; fi
f="$WORK/032_enterprise_identity_organization.sql"
if sed -n '111p' "$f" | grep -q "^-- ── 1\. Identity"; then
  { sed -n '1,5p' "$f"; sed -n '111,126p' "$f"; sed -n '6,110p' "$f"; sed -n '127,$p' "$f"; } > "$f.tmp"; mv "$f.tmp" "$f"
fi
f="$WORK/026_livestock_domain_architecture.sql"
{ echo "alter table public.health_events add column if not exists deleted_at timestamptz;"; cat "$f"; } > "$f.tmp"; mv "$f.tmp" "$f"

"$PSQL" -q -d postgres -c "drop database if exists \"$DB\"" -c "create database \"$DB\"" >/dev/null
"$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase_stub.sql" >/dev/null
while IFS= read -r m; do
  if ! out="$("$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -1 -f "$m" 2>&1)"; then
    echo "MIGRATION FAILED: $(basename "$m")"; echo "$out" | grep -m3 ERROR; exit 1
  fi
done < <(ls "$WORK"/*.sql | sort)
echo "all migrations applied"
"$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/feed_ledger.sql" 2>&1 | grep -oE "(PASS|FAIL) .*|== .*|ERROR: .*"
"$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/feed_usage.sql" 2>&1 | grep -oE "(PASS|FAIL) .*|== .*|ERROR: .*"
