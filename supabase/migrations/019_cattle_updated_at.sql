-- ================================================================
-- Tanvir Agro ERP — Migration 019: Cattle updated_at
-- ================================================================

-- Add updated_at so overhead allocation can correctly compute
-- the exit date for sold/dead/stolen cattle.
ALTER TABLE public.cattle
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill: for non-active cattle, use created_at as a safe default.
UPDATE public.cattle
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- Auto-update on every row change going forward.
CREATE OR REPLACE FUNCTION update_cattle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cattle_updated_at_trigger ON public.cattle;
CREATE TRIGGER cattle_updated_at_trigger
  BEFORE UPDATE ON public.cattle
  FOR EACH ROW EXECUTE FUNCTION update_cattle_updated_at();
