-- Add quarantine flag to cattle table
ALTER TABLE cattle ADD COLUMN is_quarantined BOOLEAN DEFAULT false;
