-- ============================================================================
-- Baseline: columns that exist in PRODUCTION but were never captured in a migration
-- (DB-01 / BUG-23). Observed in the 2026-09-24 read-only production snapshot.
-- On production this is a no-op (IF NOT EXISTS). On a fresh database it makes the
-- schema match production so later migrations can be tested faithfully.
-- ============================================================================

alter table public.businesses
  add column if not exists default_daily_gain_kg numeric;

alter table public.feed_recipes
  add column if not exists active_from  date,
  add column if not exists active_until date,
  add column if not exists deleted_at   timestamptz;

alter table public.inventory_items
  add column if not exists roughage_active_from  date,
  add column if not exists roughage_active_until date,
  add column if not exists is_discontinued       boolean not null default false;

-- sales.deleted_at / reverted_reason are used by the app and by revert_cattle_sale (20260618);
-- production has 0 sales rows so they could not be observed. No-op if present.
alter table public.sales
  add column if not exists deleted_at      timestamptz,
  add column if not exists reverted_reason text;

-- health_events.deleted_at is used by ~57 queries and exists in production (DB-11).
alter table public.health_events
  add column if not exists deleted_at timestamptz;
