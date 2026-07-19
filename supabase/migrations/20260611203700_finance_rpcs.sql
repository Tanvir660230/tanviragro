CREATE OR REPLACE FUNCTION get_monthly_consumptions(p_business_id UUID)
RETURNS TABLE (
    month_yr TEXT,
    category TEXT,
    total_cost NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(it.recorded_at, 'YYYY-MM') as month_yr,
        i.category::TEXT as category,
        SUM(it.qty * COALESCE(it.unit_cost, 0)) as total_cost
    FROM inventory_transactions it
    JOIN inventory_items i ON i.id = it.item_id
    WHERE i.business_id = p_business_id
      AND it.type = 'consumption'
    GROUP BY TO_CHAR(it.recorded_at, 'YYYY-MM'), i.category;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cattle_consumptions(p_business_id UUID)
RETURNS TABLE (
    cattle_id UUID,
    category TEXT,
    total_cost NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        it.cattle_id,
        i.category::TEXT as category,
        SUM(it.qty * COALESCE(it.unit_cost, 0)) as total_cost
    FROM inventory_transactions it
    JOIN inventory_items i ON i.id = it.item_id
    WHERE i.business_id = p_business_id
      AND it.type = 'consumption'
      AND it.cattle_id IS NOT NULL
    GROUP BY it.cattle_id, i.category;
END;
$$ LANGUAGE plpgsql;
