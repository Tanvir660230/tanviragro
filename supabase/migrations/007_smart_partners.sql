-- ================================================================
-- Tanvir Agro ERP — Smart Partners Migration
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- ── Add partner_type column ───────────────────────────────────────
alter table partners
  add column if not exists partner_type text not null default 'capital'
  check (partner_type in ('capital', 'labor', 'hybrid'));

-- ── Add labor_value_monthly column ───────────────────────────────
alter table partners
  add column if not exists labor_value_monthly numeric(14,2);

-- ── Add loss_allocation to the transaction type enum ─────────────
alter type partner_transaction_type add value if not exists 'loss_allocation';
