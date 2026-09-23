#!/usr/bin/env bash
# Replays every migration into a THROWAWAY local Postgres database and runs the RLS tests.
# Never point this at production.
#
# Requirements: a local PostgreSQL 15+ server you can reach as a superuser.
#   PG_BIN   directory containing psql      (default: psql on PATH)
#   PGHOST / PGPORT / PGUSER               (defaults: 127.0.0.1 / 5432 / postgres)
#   TEST_DB  database to (re)create        (default: tanviragro_rls_test)
#
# Usage: bash supabase/tests/run_rls_tests.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"
PSQL="${PG_BIN:+$PG_BIN/}psql"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-tanviragro_rls_test}"

case "$DB" in *prod*|postgres) echo "refusing to use database '$DB'"; exit 2;; esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$MIGRATIONS"/*.sql "$WORK/"

# ── Known defects in committed migrations (DB-11). Fixed ONLY in this temp copy. ──
# 003: ALTERs reference `vendors` before it is created -> move them after the CREATE TABLEs.
f="$WORK/003_new_features.sql"
alters="$(sed -n '13,14p' "$f")"
if grep -q "vendor_id uuid references vendors" <<<"$alters"; then
  sed -i '13,14d' "$f"
  printf '\n%s\n' "$alters" >> "$f"
fi
# 032: section "1" (creates organization_units) sits after sections 2-7 -> move it first.
f="$WORK/032_enterprise_identity_organization.sql"
if sed -n '111p' "$f" | grep -q "^-- ── 1\. Identity"; then
  { sed -n '1,5p' "$f"; sed -n '111,126p' "$f"; sed -n '6,110p' "$f"; sed -n '127,$p' "$f"; } > "$f.tmp"
  mv "$f.tmp" "$f"
fi
# 026: indexes health_events.deleted_at, a column no migration creates (exists in prod).
f="$WORK/026_livestock_domain_architecture.sql"
{ echo "alter table public.health_events add column if not exists deleted_at timestamptz;"; cat "$f"; } > "$f.tmp"
mv "$f.tmp" "$f"

"$PSQL" -q -d postgres -c "drop database if exists \"$DB\"" -c "create database \"$DB\"" >/dev/null
"$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase_stub.sql"

while IFS= read -r m; do
  if ! out="$("$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -1 -f "$m" 2>&1)"; then
    echo "MIGRATION FAILED: $(basename "$m")"; echo "$out" | grep -m3 ERROR; exit 1
  fi
done < <(ls "$WORK"/*.sql | sort)
echo "all migrations applied"

"$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/rls_phase1.sql" 2>&1 | grep -E "PASS|FAIL|==|ERROR"
