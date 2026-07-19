CREATE OR REPLACE FUNCTION get_inventory_stats(p_business_id UUID, p_30_days_ago DATE)
RETURNS TABLE (
    item_id UUID,
    total_stock NUMERIC,
    total_consumed NUMERIC,
    consumed_last_30d NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        it.item_id,
        SUM(CASE WHEN it.type = 'purchase' THEN it.qty ELSE -it.qty END) as total_stock,
        SUM(CASE WHEN it.type = 'consumption' THEN it.qty ELSE 0 END) as total_consumed,
        SUM(CASE WHEN it.type = 'consumption' AND it.recorded_at >= p_30_days_ago THEN it.qty ELSE 0 END) as consumed_last_30d
    FROM inventory_transactions it
    JOIN inventory_items i ON i.id = it.item_id
    WHERE i.business_id = p_business_id
    GROUP BY it.item_id;
END;
$$ LANGUAGE plpgsql;
