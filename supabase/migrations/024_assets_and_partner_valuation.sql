-- ================================================================
-- Tanvir Agro ERP — Capital Assets & Partner Entry Valuation
-- ================================================================

-- ── 1. Capital Asset class on cost_entries ────────────────────────
-- Separates capital expenditure (equipment, infrastructure) from
-- operating expenses in P&L.  Cash-flow statement still includes both.
ALTER TABLE public.cost_entries
  ADD COLUMN IF NOT EXISTS entry_class TEXT NOT NULL DEFAULT 'expense'
  CONSTRAINT cost_entries_entry_class_check
    CHECK (entry_class IN ('expense', 'asset'));

COMMENT ON COLUMN public.cost_entries.entry_class IS
  'expense = operating cost, deducted from P&L; '
  'asset   = capital expenditure, excluded from P&L, tracked as business asset.';

-- ── 2. Partner entry valuation snapshot ──────────────────────────
-- entry_netpl    : netPL (after mgmt fee) at the time this partner joined.
--                  Ensures new partners only share profits earned AFTER joining.
-- entry_valuation: pre-money business valuation when partner joined.
--                  Used for transparent share-% calculation.
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS entry_netpl      NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS entry_valuation  NUMERIC(14, 2);

COMMENT ON COLUMN public.partners.entry_netpl IS
  'Snapshot of netPL (post management fee) when this partner joined. '
  'pendingProfit = (currentNetPL - entry_netpl) * share% - profitReceived. '
  'NULL for founding partners (treated as 0 — they share all historical profit).';

COMMENT ON COLUMN public.partners.entry_valuation IS
  'Pre-money business valuation (partner equity + cattle value + assets) '
  'at the moment this partner joined. Used for share-% transparency.';
