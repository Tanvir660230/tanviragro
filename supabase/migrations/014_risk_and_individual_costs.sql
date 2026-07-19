-- ================================================================
-- Tanvir Agro ERP — Individual Costs & Risk Management
-- ================================================================

-- ── Add 'stolen' status if it does not exist ─────────────────────
ALTER TYPE cattle_status ADD VALUE IF NOT EXISTS 'stolen';

-- ── Add cattle_id to cost_entries ───────────────────────────────
ALTER TABLE cost_entries
ADD COLUMN IF NOT EXISTS cattle_id UUID REFERENCES cattle(id) ON DELETE SET NULL;
