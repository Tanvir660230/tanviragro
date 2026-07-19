-- ================================================================
-- Tanvir Agro ERP — Migration 020: Cattle soft-delete
-- ================================================================

-- Add deleted_at column so cattle can be soft-deleted (same pattern
-- already used on cost_entries, weight_logs, inventory_items, partners).
ALTER TABLE public.cattle
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for fast lookups of non-deleted cattle (most common query path).
CREATE INDEX IF NOT EXISTS idx_cattle_active
  ON public.cattle (business_id, created_at DESC)
  WHERE deleted_at IS NULL;
