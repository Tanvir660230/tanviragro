-- ================================================================
-- Tanvir Agro ERP — Tape Measure Support
-- Adds girth_cm and length_cm columns to weight_logs so that
-- weights recorded via the ফিতা (tape) calculator are stored
-- with their raw measurements for audit and re-calculation.
-- ================================================================

alter table weight_logs
  add column if not exists girth_cm  numeric(6,1),
  add column if not exists length_cm numeric(6,1);
