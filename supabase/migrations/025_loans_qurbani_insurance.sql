-- ================================================================
-- Tanvir Agro ERP — Loans, Qurbani Marking, Insurance Tracking
-- ================================================================

-- ── 1. Loans table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loans (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  lender_name       TEXT          NOT NULL,
  principal_amount  NUMERIC(14,2) NOT NULL CHECK (principal_amount > 0),
  interest_rate_pct NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (interest_rate_pct >= 0),
  loan_date         DATE          NOT NULL,
  due_date          DATE,
  purpose           TEXT,
  status            TEXT          NOT NULL DEFAULT 'active'
    CONSTRAINT loans_status_check CHECK (status IN ('active', 'paid')),
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

COMMENT ON TABLE public.loans IS
  'Tracks borrowings: from family, bank, or any lender. '
  'Interest rate is annual %. Due date is optional.';

-- ── 2. Loan payments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_payments (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id    UUID          NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount     NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_at    DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_payments IS
  'Individual repayment installments against a loan.';

-- ── 3. RLS policies ──────────────────────────────────────────────
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans_owner" ON public.loans
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "loan_payments_owner" ON public.loan_payments
  FOR ALL USING (
    loan_id IN (
      SELECT l.id FROM public.loans l
      JOIN public.businesses b ON b.id = l.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

-- ── 4. Cattle: Qurbani marking + Insurance ───────────────────────
ALTER TABLE public.cattle
  ADD COLUMN IF NOT EXISTS is_qurbani_marked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS insurance_expiry   DATE;

COMMENT ON COLUMN public.cattle.is_qurbani_marked IS
  'True when this cattle is reserved/confirmed for Qurbani sale.';
COMMENT ON COLUMN public.cattle.insurance_expiry IS
  'Expiry date of livestock insurance policy. NULL = no insurance.';
