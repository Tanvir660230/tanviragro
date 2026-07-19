-- Migration 012: cattle_treatments table for individual medical log
CREATE TABLE IF NOT EXISTS cattle_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
  medicine_item_id UUID REFERENCES inventory_items(id),
  dose_administered NUMERIC(10,4),
  dose_unit TEXT DEFAULT 'ml',
  vet_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  additional_medical_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  diagnosis TEXT,
  notes TEXT,
  treated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cattle_treatments_cattle_id ON cattle_treatments(cattle_id);
CREATE INDEX IF NOT EXISTS idx_cattle_treatments_treated_at ON cattle_treatments(treated_at DESC);

-- Enable RLS consistent with other tables
ALTER TABLE cattle_treatments ENABLE ROW LEVEL SECURITY;

-- Owners can do everything on their own cattle treatments
CREATE POLICY "owner_all_cattle_treatments"
  ON cattle_treatments
  FOR ALL
  USING (
    cattle_id IN (
      SELECT c.id FROM cattle c
      JOIN businesses b ON b.id = c.business_id
      WHERE b.owner_id = auth.uid()
    )
  );
