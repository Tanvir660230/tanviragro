-- ================================================================
-- Tanvir Agro ERP — Indexes + Partners Soft Delete
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- ── Partners soft delete ──────────────────────────────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── Performance indexes ───────────────────────────────────────────
-- Cattle queries (most frequent: by business, by status)
CREATE INDEX IF NOT EXISTS idx_cattle_business_id       ON cattle(business_id);
CREATE INDEX IF NOT EXISTS idx_cattle_business_status   ON cattle(business_id, status);

-- Weight logs (fetched per cattle, ordered by date)
CREATE INDEX IF NOT EXISTS idx_weight_logs_cattle_id    ON weight_logs(cattle_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_cattle_date  ON weight_logs(cattle_id, recorded_at DESC);

-- Sales (joined to cattle for P&L)
CREATE INDEX IF NOT EXISTS idx_sales_cattle_id          ON sales(cattle_id);

-- Health events (per cattle, per business)
CREATE INDEX IF NOT EXISTS idx_health_events_cattle_id  ON health_events(cattle_id);
CREATE INDEX IF NOT EXISTS idx_health_events_business   ON health_events(business_id, scheduled_at);

-- Cost entries (per business)
CREATE INDEX IF NOT EXISTS idx_cost_entries_business_id ON cost_entries(business_id);

-- Inventory transactions (per item, filtered by type)
CREATE INDEX IF NOT EXISTS idx_inv_txn_item_id          ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item_type        ON inventory_transactions(item_id, type);

-- Partners (per business, excluding soft-deleted)
CREATE INDEX IF NOT EXISTS idx_partners_business_id     ON partners(business_id) WHERE deleted_at IS NULL;

-- Partner transactions (per partner)
CREATE INDEX IF NOT EXISTS idx_partner_txn_partner_id   ON partner_transactions(partner_id);
