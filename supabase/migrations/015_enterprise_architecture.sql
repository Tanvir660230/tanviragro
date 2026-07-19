-- ================================================================
-- Tanvir Agro ERP — Phase 8: Enterprise Architecture
-- RBAC (Role-Based Access Control) & Financial Locks
-- ================================================================

-- ── 1. RBAC (Business Users) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'worker',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- Note: The business owner is implicitly an 'owner'. 
-- This table is for additional staff (managers/workers).

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage business_users"
  ON business_users
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ── 2. Financial Locks (Accounting Audits) ───────────────────────────
CREATE TABLE IF NOT EXISTS financial_locks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
  locked_until  DATE NOT NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage locks"
  ON financial_locks
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ── 3. Role Access (Business ID & Role) ──────────────────────────────
CREATE OR REPLACE FUNCTION get_user_business_role(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_biz_id UUID;
  v_role TEXT;
BEGIN
  -- Check if user is an owner
  SELECT id INTO v_biz_id
  FROM businesses
  WHERE owner_id = p_user_id
  LIMIT 1;

  IF v_biz_id IS NOT NULL THEN
    RETURN json_build_object('business_id', v_biz_id, 'role', 'owner');
  END IF;

  -- Check if user is an employee
  SELECT business_id, role::TEXT INTO v_biz_id, v_role
  FROM business_users
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_biz_id IS NOT NULL THEN
    RETURN json_build_object('business_id', v_biz_id, 'role', v_role);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Data Scaling (Finance Summary RPC) ──────────────────────────
CREATE OR REPLACE FUNCTION get_finance_summary(p_business_id UUID)
RETURNS JSON AS $$
DECLARE
  v_revenue NUMERIC;
  v_cogs NUMERIC;
  v_loss_cogs NUMERIC;
  v_opex NUMERIC;
  v_raw_feed NUMERIC;
  v_sold_count INT;
  v_active_count INT;
  v_loss_count INT;
  v_exited_count INT;
  v_total_count INT;
  v_feed_costs NUMERIC;
BEGIN
  SELECT COALESCE(SUM(s.sale_price_total), 0), COALESCE(SUM(c.purchase_price), 0), COUNT(s.id)
  INTO v_revenue, v_cogs, v_sold_count
  FROM sales s
  JOIN cattle c ON s.cattle_id = c.id
  WHERE c.business_id = p_business_id;

  SELECT COALESCE(SUM(purchase_price), 0), COUNT(id)
  INTO v_loss_cogs, v_loss_count
  FROM cattle
  WHERE business_id = p_business_id AND status IN ('dead', 'stolen');

  SELECT COUNT(id) INTO v_active_count
  FROM cattle
  WHERE business_id = p_business_id AND status = 'active';

  SELECT COALESCE(SUM(amount), 0) INTO v_opex
  FROM cost_entries
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(qty * unit_cost), 0) INTO v_raw_feed
  FROM inventory_transactions it
  JOIN inventory_items ii ON it.inventory_item_id = ii.id
  WHERE ii.business_id = p_business_id AND it.type = 'consumption';

  v_exited_count := v_sold_count + v_loss_count;
  v_total_count := v_exited_count + v_active_count;
  
  IF v_total_count > 0 THEN
    v_feed_costs := v_raw_feed * (v_exited_count::NUMERIC / v_total_count::NUMERIC);
  ELSE
    v_feed_costs := 0;
  END IF;

  RETURN json_build_object(
    'totalRevenue', v_revenue,
    'totalCogs', v_cogs,
    'lossCogs', v_loss_cogs,
    'totalOpex', v_opex,
    'feedCosts', v_feed_costs,
    'netPL', v_revenue - v_cogs - v_loss_cogs - v_opex - v_feed_costs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
