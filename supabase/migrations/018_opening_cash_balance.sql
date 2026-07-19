-- ================================================================
-- Tanvir Agro ERP — Migration 018: Opening Cash Balance
-- ================================================================

-- Add opening_cash_balance to businesses so accounting can track
-- the starting cash before any transactions were recorded in the system.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC(14, 2) NOT NULL DEFAULT 0;
