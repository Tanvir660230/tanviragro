-- ==============================================================================
-- Migration: 030_enterprise_livestock_financial_engine.sql
-- Description: Enterprise Livestock Financial Engine, Cost Allocations, IAS 41 Biological Asset Valuations, Profitability & Governance
-- ==============================================================================

-- 1. Cost & Profit Centers
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code                        TEXT NOT NULL,
  name                        TEXT NOT NULL,
  type                        TEXT NOT NULL CHECK (type IN ('farm', 'pen', 'feedlot', 'breed', 'herd', 'production_cycle', 'department', 'commerce')),
  parent_id                   UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  manager_name                TEXT,
  allocated_budget            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, code)
);

-- 2. Animal Financial Ledger (Authoritative Unit Economics & Life Cycle Costing)
CREATE TABLE IF NOT EXISTS public.animal_financial_ledgers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id                   UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  tag_id                      TEXT,
  cost_center_id              UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  purchase_cost               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  feed_cost                   NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  medicine_cost               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vaccine_cost                NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  labor_allocated             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  breeding_cost               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  transport_cost              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  overhead_allocated          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  insurance_cost              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  mortality_loss              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_accumulated_cost      NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sale_revenue                NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  net_profit                  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  gross_margin_pct            NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  net_margin_pct              NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  weight_gain_kg              NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  cost_per_kg_gain            NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  current_biological_value    NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  last_valuation_date         DATE,
  roi_pct                     NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  lifetime_value              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'deceased', 'transferred', 'culled')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, cattle_id)
);


-- 3. Cost Allocation Runs (Audit Log of Proportional Overhead / Labor Allocations)

CREATE TABLE IF NOT EXISTS public.cost_allocations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  allocation_batch_number     TEXT NOT NULL,
  source_cost_id              UUID,
  source_category             TEXT NOT NULL,
  allocation_method           TEXT NOT NULL CHECK (allocation_method IN ('head_count', 'weight_proportional', 'feed_days', 'equal_split', 'direct')),
  total_amount                NUMERIC(14,2) NOT NULL,
  target_scope                TEXT NOT NULL CHECK (target_scope IN ('all_active', 'farm', 'pen', 'breed', 'herd', 'cycle')),
  target_scope_id             TEXT,
  recipients_count            INTEGER NOT NULL DEFAULT 0,
  applied_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  journal_entry_id            UUID,
  notes                       TEXT,
  performed_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, allocation_batch_number)
);

-- 4. Biological Asset Valuations (IAS 41 Agricultural Fair Value Adjustments)
CREATE TABLE IF NOT EXISTS public.biological_asset_valuations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  valuation_number            TEXT NOT NULL,
  valuation_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  valuation_basis             TEXT NOT NULL DEFAULT 'market_weight_estimate' CHECK (valuation_basis IN ('market_weight_estimate', 'market_active_quotes', 'discounted_cash_flow', 'historical_cost')),
  market_rate_per_kg          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_head_count            INTEGER NOT NULL DEFAULT 0,
  total_herd_weight_kg        NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  previous_book_value         NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  new_fair_value              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unrealized_gain_loss        NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  journal_entry_id            UUID,
  is_posted                   BOOLEAN NOT NULL DEFAULT false,
  valuator_notes              TEXT,
  approved_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, valuation_number)
);

-- 5. Financial Budgets & Forecasting

CREATE TABLE IF NOT EXISTS public.financial_budgets (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  fiscal_year                 INTEGER NOT NULL,
  month                       INTEGER CHECK (month BETWEEN 1 AND 12),
  cost_center_id              UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  account_code                TEXT NOT NULL,
  budgeted_amount             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  actual_amount               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  variance_amount             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  variance_pct                NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, fiscal_year, month, cost_center_id, account_code)
);

-- 6. Accounting Period Locks & Internal Controls
CREATE TABLE IF NOT EXISTS public.financial_period_locks (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  lock_name                   TEXT NOT NULL,
  start_date                  DATE NOT NULL,
  end_date                    DATE NOT NULL,
  is_locked                   BOOLEAN NOT NULL DEFAULT true,
  locked_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason                      TEXT,
  unlocked_at                 TIMESTAMPTZ,
  unlocked_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(business_id, start_date, end_date)
);

-- 7. Journal Reversals & Storno Audit Trail
CREATE TABLE IF NOT EXISTS public.financial_reversals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  original_journal_id         UUID NOT NULL,
  reversal_journal_id         UUID NOT NULL,
  reversal_reason             TEXT NOT NULL,
  reversed_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Enable Row Level Security (RLS) ──────────────────────────────────────────
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animal_financial_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biological_asset_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reversals ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for cost_centers" ON public.cost_centers;
CREATE POLICY "Tenant isolation for cost_centers" ON public.cost_centers
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for animal_financial_ledgers" ON public.animal_financial_ledgers;
CREATE POLICY "Tenant isolation for animal_financial_ledgers" ON public.animal_financial_ledgers
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for cost_allocations" ON public.cost_allocations;
CREATE POLICY "Tenant isolation for cost_allocations" ON public.cost_allocations
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for biological_asset_valuations" ON public.biological_asset_valuations;
CREATE POLICY "Tenant isolation for biological_asset_valuations" ON public.biological_asset_valuations
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for financial_budgets" ON public.financial_budgets;
CREATE POLICY "Tenant isolation for financial_budgets" ON public.financial_budgets
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for financial_period_locks" ON public.financial_period_locks;
CREATE POLICY "Tenant isolation for financial_period_locks" ON public.financial_period_locks
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for financial_reversals" ON public.financial_reversals;
CREATE POLICY "Tenant isolation for financial_reversals" ON public.financial_reversals
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));


-- ── Performance Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cost_centers_biz ON public.cost_centers(business_id, type);
CREATE INDEX IF NOT EXISTS idx_animal_fin_ledger_biz ON public.animal_financial_ledgers(business_id, cattle_id);
CREATE INDEX IF NOT EXISTS idx_animal_fin_ledger_status ON public.animal_financial_ledgers(business_id, status);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_biz ON public.cost_allocations(business_id, applied_date);
CREATE INDEX IF NOT EXISTS idx_bio_valuations_biz ON public.biological_asset_valuations(business_id, valuation_date);
CREATE INDEX IF NOT EXISTS idx_fin_budgets_biz ON public.financial_budgets(business_id, fiscal_year, month);
CREATE INDEX IF NOT EXISTS idx_fin_period_locks_biz ON public.financial_period_locks(business_id, is_locked);

