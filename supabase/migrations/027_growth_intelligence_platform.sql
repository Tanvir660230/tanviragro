-- ============================================================================
-- Migration 027: Enterprise Weight, Growth & Performance Intelligence Platform
-- ============================================================================

-- 1. Extend weight_logs with comprehensive biometrics and provenance
ALTER TABLE public.weight_logs
  ADD COLUMN IF NOT EXISTS bcs NUMERIC(3,1) CHECK (bcs IS NULL OR (bcs >= 1.0 AND bcs <= 9.0)),
  ADD COLUMN IF NOT EXISTS withers_height_cm NUMERIC(5,1) CHECK (withers_height_cm IS NULL OR withers_height_cm > 0),
  ADD COLUMN IF NOT EXISTS body_length_cm NUMERIC(5,1) CHECK (body_length_cm IS NULL OR body_length_cm > 0),
  ADD COLUMN IF NOT EXISTS heart_girth_cm NUMERIC(5,1) CHECK (heart_girth_cm IS NULL OR heart_girth_cm > 0),
  ADD COLUMN IF NOT EXISTS weighing_method TEXT DEFAULT 'manual' CHECK (weighing_method IN ('manual', 'bulk', 'qr', 'rfid', 'bluetooth_scale', 'csv_import', 'offline')),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS adg_since_last NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS days_since_last INTEGER,
  ADD COLUMN IF NOT EXISTS recorded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create growth_targets table for animal-level and herd-level performance goals
CREATE TABLE IF NOT EXISTS public.growth_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  target_weight_kg NUMERIC(6,2) NOT NULL CHECK (target_weight_kg > 0),
  target_adg_kg NUMERIC(4,3) CHECK (target_adg_kg IS NULL OR target_adg_kg > 0),
  target_finish_date DATE,
  target_market_type TEXT DEFAULT 'beef' CHECK (target_market_type IN ('beef', 'dairy', 'qurbani', 'breeding', 'custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'adjusted', 'cancelled')),
  achieved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_cattle_active_target UNIQUE (cattle_id, deleted_at)
);

-- 3. Create growth_alert_acknowledgements table for tracking acknowledged/dismissed alerts
CREATE TABLE IF NOT EXISTS public.growth_alert_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  notes TEXT
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.growth_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_alert_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "growth_targets_tenant_isolation" ON public.growth_targets;
CREATE POLICY "growth_targets_tenant_isolation"
  ON public.growth_targets
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM public.business_users WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "growth_alert_ack_tenant_isolation" ON public.growth_alert_acknowledgements;
CREATE POLICY "growth_alert_ack_tenant_isolation"
  ON public.growth_alert_acknowledgements
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM public.business_users WHERE user_id = auth.uid()
  ));


-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_weight_logs_adg ON public.weight_logs(cattle_id, recorded_at DESC, weight_kg) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_growth_targets_business_cattle ON public.growth_targets(business_id, cattle_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_growth_targets_status ON public.growth_targets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_growth_alert_ack ON public.growth_alert_acknowledgements(business_id, cattle_id, alert_type);

-- 6. Trigger to automatically update updated_at on growth_targets
CREATE OR REPLACE FUNCTION public.set_growth_target_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growth_targets_updated_at ON public.growth_targets;
CREATE TRIGGER trg_growth_targets_updated_at
  BEFORE UPDATE ON public.growth_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_growth_target_updated_at();

-- ============================================================================
-- ROLLBACK STRATEGY:
-- DROP TRIGGER IF EXISTS trg_growth_targets_updated_at ON public.growth_targets;
-- DROP FUNCTION IF EXISTS public.set_growth_target_updated_at();
-- DROP TABLE IF EXISTS public.growth_alert_acknowledgements CASCADE;
-- DROP TABLE IF EXISTS public.growth_targets CASCADE;
-- ALTER TABLE public.weight_logs
--   DROP COLUMN IF EXISTS bcs,
--   DROP COLUMN IF EXISTS withers_height_cm,
--   DROP COLUMN IF EXISTS body_length_cm,
--   DROP COLUMN IF EXISTS heart_girth_cm,
--   DROP COLUMN IF EXISTS weighing_method,
--   DROP COLUMN IF EXISTS photo_url,
--   DROP COLUMN IF EXISTS adg_since_last,
--   DROP COLUMN IF EXISTS days_since_last,
--   DROP COLUMN IF EXISTS recorded_by_user_id;
-- ============================================================================
