-- Extend businesses table with two user-configurable settings that affect calculations.

-- 1. Fiscal year start month (1=Jan … 12=Dec).
--    Bangladesh standard: 7 (July). Affects "This Year" date preset in Finance reports.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month SMALLINT NOT NULL DEFAULT 7
    CONSTRAINT businesses_fiscal_year_start_month_check CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

-- 2. Default roughage type used in daily feed requirement calculations.
--    Maps to DM% values in feed-calculator.ts (straw=0.90, hay=0.85, silage=0.35, grass=0.20).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS default_roughage_type TEXT NOT NULL DEFAULT 'straw'
    CONSTRAINT businesses_default_roughage_type_check CHECK (default_roughage_type IN ('straw', 'hay', 'silage', 'grass'));
