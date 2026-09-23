-- Migration 028: Enterprise Breeding, Pregnancy & Reproduction Platform (Sprint 16)
-- Complete lifecycle: Heat cycles, Semen inventory, AI & Natural breeding, Pregnancy diagnosis & Gestation, Calving & Offspring registration, Pedigree Lineage, and Fertility analytics.

-- 1. Semen Straw & Genetic Material Inventory
CREATE TABLE IF NOT EXISTS public.semen_inventory (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bull_code             TEXT NOT NULL,
  bull_name             TEXT NOT NULL,
  breed                 TEXT NOT NULL,
  straw_code            TEXT NOT NULL,
  straws_in_stock       INTEGER NOT NULL DEFAULT 0 CHECK (straws_in_stock >= 0),
  straws_reserved       INTEGER NOT NULL DEFAULT 0 CHECK (straws_reserved >= 0),
  straws_used           INTEGER NOT NULL DEFAULT 0 CHECK (straws_used >= 0),
  cost_per_straw_bdt    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost_per_straw_bdt >= 0),
  supplier              TEXT,
  storage_canister      TEXT,
  motility_percent      NUMERIC(4,1) CHECK (motility_percent IS NULL OR (motility_percent >= 0 AND motility_percent <= 100)),
  genetic_traits        JSONB DEFAULT '{}'::jsonb,
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Heat / Estrus Detection Logs
CREATE TABLE IF NOT EXISTS public.heat_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id                   UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  detected_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  heat_type                   TEXT NOT NULL DEFAULT 'natural' CHECK (heat_type IN ('natural', 'induced', 'sync_protocol')),
  intensity                   TEXT NOT NULL DEFAULT 'standing_heat' CHECK (intensity IN ('standing_heat', 'mounting_others', 'mucous_discharge', 'restlessness', 'silent_heat')),
  observed_by                 TEXT,
  optimal_breeding_start      TIMESTAMPTZ NOT NULL,
  optimal_breeding_end        TIMESTAMPTZ NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inseminated', 'missed', 'expired', 'cancelled')),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Comprehensive Breeding Attempts & Inseminations
CREATE TABLE IF NOT EXISTS public.breeding_attempts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cow_id                      UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  heat_record_id              UUID REFERENCES public.heat_records(id) ON DELETE SET NULL,
  breeding_type               TEXT NOT NULL DEFAULT 'AI' CHECK (breeding_type IN ('AI', 'natural', 'embryo_transfer')),
  semen_inventory_id          UUID REFERENCES public.semen_inventory(id) ON DELETE SET NULL,
  sire_id                     UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  sire_tag_or_code            TEXT NOT NULL,
  sire_breed                  TEXT,
  insemination_date           DATE NOT NULL,
  insemination_time           TIME,
  technician_name             TEXT,
  technician_cost_bdt         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (technician_cost_bdt >= 0),
  straw_cost_bdt              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (straw_cost_bdt >= 0),
  total_breeding_cost_bdt     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_breeding_cost_bdt >= 0),
  attempt_number_in_cycle     INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number_in_cycle >= 1),
  status                      TEXT NOT NULL DEFAULT 'inseminated' CHECK (status IN ('inseminated', 'pregnancy_confirmed', 'pregnancy_failed', 'aborted', 'calved')),
  pd_check_scheduled_date     DATE NOT NULL,
  pd_check_actual_date        DATE,
  pd_method                   TEXT CHECK (pd_method IS NULL OR pd_method IN ('rectal_palpation', 'ultrasound', 'blood_test', 'milk_progesterone')),
  pd_result                   TEXT NOT NULL DEFAULT 'pending' CHECK (pd_result IN ('pending', 'pregnant', 'open', 'inconclusive')),
  pd_examined_by              TEXT,
  pd_gestation_days           INTEGER,
  expected_calving_date       DATE NOT NULL,
  dry_off_date                DATE NOT NULL,
  transition_diet_date        DATE,
  pregnancy_risk_level        TEXT NOT NULL DEFAULT 'normal' CHECK (pregnancy_risk_level IN ('normal', 'elevated', 'high')),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Calving & Delivery Records

CREATE TABLE IF NOT EXISTS public.calving_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  breeding_attempt_id         UUID REFERENCES public.breeding_attempts(id) ON DELETE SET NULL,
  cow_id                      UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  sire_id                     UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  sire_name_or_code           TEXT,
  calving_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  calving_time                TIME,
  calving_type                TEXT NOT NULL DEFAULT 'single' CHECK (calving_type IN ('single', 'twin', 'triplet')),
  delivery_difficulty         TEXT NOT NULL DEFAULT 'unassisted' CHECK (delivery_difficulty IN ('unassisted', 'easy_assist', 'difficult_dystocia', 'caesarean')),
  birth_presentation          TEXT DEFAULT 'normal_anterior' CHECK (birth_presentation IS NULL OR birth_presentation IN ('normal_anterior', 'posterior_breech', 'transverse', 'head_turned')),
  attendant_name              TEXT,
  delivery_cost_bdt           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_cost_bdt >= 0),
  vet_fee_bdt                 NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (vet_fee_bdt >= 0),
  placenta_expelled_cleanly   BOOLEAN DEFAULT true,
  dam_postpartum_condition    TEXT DEFAULT 'healthy' CHECK (dam_postpartum_condition IN ('healthy', 'metritis', 'milk_fever', 'ketosis', 'injured', 'critical')),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Offspring Registered from Calving
CREATE TABLE IF NOT EXISTS public.birth_offspring (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  calving_record_id           UUID NOT NULL REFERENCES public.calving_records(id) ON DELETE CASCADE,
  calf_cattle_id              UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  tag_number                  TEXT NOT NULL,
  name                        TEXT,
  gender                      TEXT NOT NULL CHECK (gender IN ('bull', 'heifer')),
  birth_weight_kg             NUMERIC(5,2) NOT NULL CHECK (birth_weight_kg > 0),
  birth_status                TEXT NOT NULL DEFAULT 'alive' CHECK (birth_status IN ('alive', 'stillborn', 'died_after_birth')),
  colostrum_fed_within_hours  NUMERIC(4,1),
  colostrum_quality           TEXT CHECK (colostrum_quality IS NULL OR colostrum_quality IN ('excellent', 'good', 'fair', 'poor')),
  navel_dipped                BOOLEAN DEFAULT true,
  initial_valuation_bdt       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (initial_valuation_bdt >= 0),
  weaning_target_date         DATE,
  actual_weaning_date         DATE,
  weaning_weight_kg           NUMERIC(5,2),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Reproductive Reminders & Notification Queue
CREATE TABLE IF NOT EXISTS public.reproduction_reminders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id                   UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  reference_id                UUID,
  reminder_type               TEXT NOT NULL CHECK (reminder_type IN ('heat_due', 'breeding_window', 'pd_check_due', 'dry_off_due', 'transition_diet_due', 'calving_due', 'calving_overdue', 'weaning_due')),
  scheduled_for               DATE NOT NULL,
  is_dismissed                BOOLEAN NOT NULL DEFAULT false,
  dismissed_at                TIMESTAMPTZ,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_semen_inv_biz_stock ON public.semen_inventory(business_id, straws_in_stock) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_heat_records_biz_cow ON public.heat_records(business_id, cattle_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_heat_records_active ON public.heat_records(business_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_breeding_attempts_biz_cow ON public.breeding_attempts(business_id, cow_id, insemination_date DESC);
CREATE INDEX IF NOT EXISTS idx_breeding_attempts_status ON public.breeding_attempts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_breeding_attempts_pd_sched ON public.breeding_attempts(business_id, pd_check_scheduled_date) WHERE pd_result = 'pending';
CREATE INDEX IF NOT EXISTS idx_breeding_attempts_calving_exp ON public.breeding_attempts(business_id, expected_calving_date) WHERE status = 'pregnancy_confirmed';
CREATE INDEX IF NOT EXISTS idx_calving_records_biz_cow ON public.calving_records(business_id, cow_id, calving_date DESC);
CREATE INDEX IF NOT EXISTS idx_birth_offspring_calving ON public.birth_offspring(calving_record_id);
CREATE INDEX IF NOT EXISTS idx_birth_offspring_calf ON public.birth_offspring(calf_cattle_id);
CREATE INDEX IF NOT EXISTS idx_repro_reminders_sched ON public.reproduction_reminders(business_id, scheduled_for) WHERE is_dismissed = false;

-- Enable Row Level Security
ALTER TABLE public.semen_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heat_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeding_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calving_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birth_offspring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reproduction_reminders ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS "Tenant isolation semen_inventory" ON public.semen_inventory;
CREATE POLICY "Tenant isolation semen_inventory" ON public.semen_inventory
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation heat_records" ON public.heat_records;
CREATE POLICY "Tenant isolation heat_records" ON public.heat_records
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation breeding_attempts" ON public.breeding_attempts;
CREATE POLICY "Tenant isolation breeding_attempts" ON public.breeding_attempts
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation calving_records" ON public.calving_records;
CREATE POLICY "Tenant isolation calving_records" ON public.calving_records
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation birth_offspring" ON public.birth_offspring;
CREATE POLICY "Tenant isolation birth_offspring" ON public.birth_offspring
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation reproduction_reminders" ON public.reproduction_reminders;
CREATE POLICY "Tenant isolation reproduction_reminders" ON public.reproduction_reminders
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

