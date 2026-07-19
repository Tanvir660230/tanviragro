ALTER TABLE feed_recipes ADD COLUMN is_active BOOLEAN DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN is_active_roughage BOOLEAN DEFAULT false;
