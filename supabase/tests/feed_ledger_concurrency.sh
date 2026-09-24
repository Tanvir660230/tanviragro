#!/usr/bin/env bash
# Concurrency test: two sessions try to consume the whole stock of one item at the same time.
# Exactly one may succeed. Run after run_feed_ledger_tests.sh (uses the same TEST_DB).
set -uo pipefail
PSQL="${PG_BIN:+$PG_BIN/}psql"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGCLIENTENCODING=UTF8
DB="${TEST_DB:-tanviragro_ledger_test}"
case "$DB" in *prod*|postgres) echo "refusing to use database '$DB'"; exit 2;; esac
ITEM=11111111-0000-0000-0000-0000000000c1
"$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 <<SQL
insert into public.inventory_items (id, business_id, name, unit, category)
select '$ITEM', id, 'T Concurrency', 'kg', 'feed' from public.businesses
where owner_id = '00000000-0000-0000-0000-0000000000f1' on conflict do nothing;
insert into public.inventory_transactions (item_id, type, movement_type, qty, unit_cost, recorded_at, notes)
values ('$ITEM', 'purchase', 'purchase', 10, 10, '2026-03-01', 'conc purchase');
SQL
attempt() {  # each session holds its transaction open for 2 s after inserting
  "$PSQL" -q -d "$DB" -v ON_ERROR_STOP=1 -c "begin; insert into public.inventory_transactions (item_id, type, movement_type, qty, recorded_at, notes) values ('$ITEM','consumption','consumption',10,'2026-03-02','conc $1'); select pg_sleep(2); commit;" >/dev/null 2>&1 && echo ok || echo rejected
}
A=$(mktemp); B=$(mktemp)
attempt A > "$A" & attempt B > "$B" & wait
ra=$(cat "$A"); rb=$(cat "$B")
stock=$("$PSQL" -At -d "$DB" -c "select qty_on_hand from public.v_inventory_balance where item_id = '$ITEM'")
echo "session A: $ra, session B: $rb, final stock: $stock"
oks="$(printf '%s\n%s\n' "$ra" "$rb" | grep -c '^ok$')"
if [ "$oks" = "1" ] && awk -v s="$stock" 'BEGIN { exit !(s + 0 == 0) }'; then
  echo "PASS T4c concurrent double-spend: exactly one session succeeded, stock never negative"
else
  echo "FAIL T4c concurrent double-spend"; exit 1
fi
