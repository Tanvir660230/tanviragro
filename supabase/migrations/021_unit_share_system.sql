-- Unit-based share valuation + sweat equity (labor vesting) system
-- Partners earn units based on capital invested and/or labor contributed over time.
-- Share % = own units / total units × 100  (automatic, no manual percentage entry needed)

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS unit_price_bdt INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS cliff_months  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_mode   TEXT    NOT NULL DEFAULT 'auto';

COMMENT ON COLUMN public.businesses.unit_price_bdt IS 'BDT value of one equity unit (default ৳1,000). Determines how many units each ৳1 of investment or labor is worth.';
COMMENT ON COLUMN public.partners.cliff_months      IS 'Months a labor partner must work before any units vest (0 = immediate vesting).';
COMMENT ON COLUMN public.partners.share_mode        IS 'auto = share % computed from units; manual = uses profit_share_pct column directly.';
