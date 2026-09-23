-- Migration 026: Comprehensive Livestock Domain Architecture (Sprint 07)
-- Supports 100,000+ animals across multi-farm infrastructure, breeding, full health logs, pens, categories, death tracking, document attachments, and timeline audit logs.

-- 1. Farms & Pens
CREATE TABLE IF NOT EXISTS public.farms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  location    TEXT,
  capacity    INTEGER DEFAULT 500,
  manager_id  UUID,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_farm_code UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.pens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  farm_id           UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'fattening' CHECK (type IN ('fattening', 'quarantine', 'nursery', 'maternity', 'isolation', 'general')),
  capacity          INTEGER NOT NULL DEFAULT 20,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pen_code UNIQUE (farm_id, code)
);

-- 2. Animal Breeds & Categories
CREATE TABLE IF NOT EXISTS public.animal_breeds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  species           TEXT NOT NULL DEFAULT 'cattle' CHECK (species IN ('cattle', 'buffalo', 'goat', 'sheep')),
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  description       TEXT,
  origin_country    TEXT,
  avg_daily_gain_kg NUMERIC(4,2),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.animal_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_animal_cat_code UNIQUE (business_id, code)
);

-- 3. Enhance Cattle Table
ALTER TABLE public.cattle
  ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pen_id UUID REFERENCES public.pens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS electronic_id TEXT;


-- 4. Disease Outbreaks & Veterinary Diagnosis Records
CREATE TABLE IF NOT EXISTS public.disease_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id           UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  disease_name        TEXT NOT NULL,
  symptoms            TEXT[] DEFAULT '{}',
  diagnosis_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosed_by_vet_id UUID,
  severity            TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  is_contagious       BOOLEAN NOT NULL DEFAULT false,
  isolation_pen_id    UUID REFERENCES public.pens(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_treatment', 'recovered', 'chronic', 'deceased')),
  resolution_date     DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Comprehensive Breeding & Calving Records
CREATE TABLE IF NOT EXISTS public.breeding_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cow_id                UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  sire_id               UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  sire_tag_or_breed     TEXT NOT NULL,
  insemination_date     DATE NOT NULL,
  insemination_type     TEXT NOT NULL DEFAULT 'AI' CHECK (insemination_type IN ('AI', 'natural')),
  technician_name       TEXT,
  status                TEXT NOT NULL DEFAULT 'inseminated' CHECK (status IN ('open', 'inseminated', 'pregnant', 'calved', 'failed')),
  pd_check_date         DATE,
  is_pregnant           BOOLEAN,
  pd_confirmed_at       DATE,
  expected_calving_date DATE,
  actual_calving_date   DATE,
  dry_off_date          DATE,
  calf_id               UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Mortality & Post-Mortem Tracking
CREATE TABLE IF NOT EXISTS public.cattle_death_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id                   UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  death_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  cause_of_death              TEXT NOT NULL,
  post_mortem_notes           TEXT,
  certified_by_vet_id         UUID,
  estimated_casualty_loss_bdt NUMERIC(12,2) NOT NULL DEFAULT 0,
  disposal_method             TEXT NOT NULL DEFAULT 'burial' CHECK (disposal_method IN ('burial', 'incineration', 'rendering', 'other')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cattle_death UNIQUE (cattle_id)
);

-- 7. Universal Document & File Attachments
CREATE TABLE IF NOT EXISTS public.document_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('cattle', 'health_event', 'breeding', 'sale', 'death', 'farm')),
  entity_id        UUID NOT NULL,
  file_name        TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  file_size_bytes  BIGINT NOT NULL,
  storage_path     TEXT NOT NULL,
  uploaded_by      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. High-Performance Timeline & Audit Engine
CREATE TABLE IF NOT EXISTS public.livestock_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entity_type    TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  action         TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'HEALTH_ADMINISTERED', 'BREEDING_EVENT', 'SALE', 'DEATH')),
  actor_id       TEXT NOT NULL,
  actor_role     TEXT NOT NULL,
  previous_state JSONB,
  new_state      JSONB,
  ip_address     TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Scalability Indexes (100,000+ Head Performance)
CREATE INDEX IF NOT EXISTS idx_cattle_business_status ON public.cattle(business_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cattle_farm_pen ON public.cattle(farm_id, pen_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cattle_electronic_id ON public.cattle(business_id, electronic_id) WHERE electronic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weight_logs_cattle_recorded ON public.weight_logs(cattle_id, recorded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_health_events_cattle_sched ON public.health_events(cattle_id, scheduled_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_disease_records_cattle ON public.disease_records(cattle_id, status);
CREATE INDEX IF NOT EXISTS idx_breeding_cow_insem ON public.breeding_records(cow_id, insemination_date DESC);
CREATE INDEX IF NOT EXISTS idx_livestock_audit_lookup ON public.livestock_audit_logs(business_id, entity_type, entity_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_doc_attachments_entity ON public.document_attachments(business_id, entity_type, entity_id);

ALTER TABLE public.cattle
  ADD COLUMN IF NOT EXISTS breed_id UUID REFERENCES public.animal_breeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.animal_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dam_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sire_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_end_date DATE;

-- Unique tag check per active business
CREATE UNIQUE INDEX IF NOT EXISTS idx_cattle_tag_unique_business 
ON public.cattle (business_id, lower(tag_id)) 
WHERE deleted_at IS NULL;
