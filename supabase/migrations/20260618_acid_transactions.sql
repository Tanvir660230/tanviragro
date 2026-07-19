-- Migration: True ACID transactions for cattle sales and reversals
-- This replaces multi-step frontend API logic with secure database-level transactions.

-- 1. RPC for Selling Cattle
CREATE OR REPLACE FUNCTION sell_cattle(
  p_cattle_id UUID,
  p_sale_price_total NUMERIC,
  p_weight_at_sale_kg NUMERIC,
  p_sold_at DATE,
  p_buyer_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_status cattle_status;
BEGIN
  -- Lock the cattle row for update to prevent concurrent modifications
  SELECT status INTO v_status
  FROM cattle
  WHERE id = p_cattle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cattle not found';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Cattle is not active (current status: %)', v_status;
  END IF;

  -- Insert sale record
  INSERT INTO sales (cattle_id, sale_price_total, weight_at_sale_kg, sold_at, buyer_name)
  VALUES (p_cattle_id, p_sale_price_total, p_weight_at_sale_kg, p_sold_at, p_buyer_name)
  RETURNING id INTO v_sale_id;

  -- Update cattle status to sold
  UPDATE cattle
  SET status = 'sold'
  WHERE id = p_cattle_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. RPC for Reverting Cattle Sale
CREATE OR REPLACE FUNCTION revert_cattle_sale(
  p_cattle_id UUID,
  p_sale_id UUID,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_cattle_status cattle_status;
  v_sale_deleted_at TIMESTAMPTZ;
BEGIN
  -- Lock the cattle row
  SELECT status INTO v_cattle_status
  FROM cattle
  WHERE id = p_cattle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cattle not found';
  END IF;

  IF v_cattle_status <> 'sold' THEN
    RAISE EXCEPTION 'Cattle is not currently marked as sold';
  END IF;

  -- Lock and check the sale row
  SELECT deleted_at INTO v_sale_deleted_at
  FROM sales
  WHERE id = p_sale_id AND cattle_id = p_cattle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale record not found for this cattle';
  END IF;

  IF v_sale_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale record is already deleted/reverted';
  END IF;

  -- Update cattle status back to active
  UPDATE cattle
  SET status = 'active'
  WHERE id = p_cattle_id;

  -- Soft delete the sale record
  UPDATE sales
  SET deleted_at = NOW(),
      reverted_reason = p_reason
  WHERE id = p_sale_id;

END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
