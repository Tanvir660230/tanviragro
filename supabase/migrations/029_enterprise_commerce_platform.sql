-- ==============================================================================
-- Migration: 029_enterprise_commerce_platform.sql
-- Description: Enterprise Commerce, Purchasing, Sales, Transfer Logistics & Ownership Platform
-- ==============================================================================

-- 1. Commerce Orders (Purchase, Sale, Consignments)
CREATE TABLE IF NOT EXISTS public.commerce_orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number                TEXT NOT NULL,
  order_type                  TEXT NOT NULL CHECK (order_type IN ('purchase', 'sale', 'transfer', 'contract')),
  counterparty_type           TEXT NOT NULL CHECK (counterparty_type IN ('vendor', 'customer', 'partner', 'internal_farm')),
  counterparty_id             UUID,
  counterparty_name           TEXT NOT NULL,
  counterparty_contact        TEXT,
  status                      TEXT NOT NULL DEFAULT 'draft' CHECK (
                                status IN ('draft', 'pending_approval', 'approved', 'in_progress', 'in_transit', 'delivered', 'completed', 'cancelled')
                              ),
  order_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date      DATE,
  currency                    TEXT NOT NULL DEFAULT 'BDT',
  subtotal_amount             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_amount                  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_amount             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  transport_cost              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  commission_amount           NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  net_total_amount            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  paid_amount                 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  payment_status              TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')),
  payment_terms               TEXT,
  contract_id                 UUID,
  notes                       TEXT,
  approved_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at                 TIMESTAMPTZ,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                  TIMESTAMPTZ,
  UNIQUE(business_id, order_number)
);

-- 2. Commerce Order Line Items
CREATE TABLE IF NOT EXISTS public.commerce_order_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID NOT NULL REFERENCES public.commerce_orders(id) ON DELETE CASCADE,
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id                   UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  item_type                   TEXT NOT NULL DEFAULT 'livestock' CHECK (item_type IN ('livestock', 'feed', 'semen', 'equipment', 'service', 'other')),
  tag_id                      TEXT,
  description                 TEXT NOT NULL,
  quantity                    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price                  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  initial_weight_kg           NUMERIC(8,2),
  final_weight_kg             NUMERIC(8,2),
  rate_per_kg                 NUMERIC(10,2),
  total_price                 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status                      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'inspected', 'received', 'delivered', 'rejected')),
  inspection_notes            TEXT,
  notes                       TEXT,
  metadata                    JSONB DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 3. Commercial Invoices

CREATE TABLE IF NOT EXISTS public.commerce_invoices (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id                    UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  invoice_number              TEXT NOT NULL,
  invoice_type                TEXT NOT NULL CHECK (invoice_type IN ('purchase_invoice', 'sale_invoice', 'transport_invoice', 'tax_invoice')),
  customer_or_vendor_name     TEXT NOT NULL,
  customer_or_vendor_contact  TEXT,
  issue_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                    DATE NOT NULL,
  subtotal                    NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_rate                    NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  tax_amount                  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_amount             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_amount                NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  paid_amount                 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  balance_due                 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status                      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled')),
  payment_instructions        TEXT,
  pdf_url                     TEXT,
  notes                       TEXT,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, invoice_number)
);

-- 4. Commerce Payments & Installments
CREATE TABLE IF NOT EXISTS public.commerce_payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_id                  UUID REFERENCES public.commerce_invoices(id) ON DELETE SET NULL,
  order_id                    UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  payment_number              TEXT NOT NULL,
  payment_type                TEXT NOT NULL DEFAULT 'receipt' CHECK (payment_type IN ('receipt', 'disbursement', 'refund', 'installment')),
  payment_method              TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'mobile_banking', 'bKash', 'Nagad', 'other')),
  amount                      NUMERIC(14,2) NOT NULL,
  payment_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_txn_id            TEXT,
  account_code                TEXT NOT NULL DEFAULT '1010',
  received_or_paid_by         TEXT,
  notes                       TEXT,
  receipt_attachment_url      TEXT,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, payment_number)
);

-- 5. Commerce Transfers & Transport Logistics

CREATE TABLE IF NOT EXISTS public.commerce_transfers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id                    UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  transfer_number             TEXT NOT NULL,
  transfer_type               TEXT NOT NULL CHECK (
                                transfer_type IN ('farm_to_farm', 'department', 'pen_to_pen', 'sale_delivery', 'purchase_inbound', 'temporary_exhibition')
                              ),
  origin_name                 TEXT NOT NULL,
  origin_id                   UUID,
  destination_name            TEXT NOT NULL,
  destination_id              UUID,
  cattle_ids                  UUID[] NOT NULL DEFAULT '{}',
  vehicle_type                TEXT,
  vehicle_number              TEXT,
  driver_name                 TEXT,
  driver_phone                TEXT,
  scheduled_departure         TIMESTAMPTZ,
  actual_departure            TIMESTAMPTZ,
  estimated_arrival           TIMESTAMPTZ,
  actual_arrival              TIMESTAMPTZ,
  transport_cost              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  transit_status              TEXT NOT NULL DEFAULT 'scheduled' CHECK (
                                transit_status IN ('scheduled', 'dispatched', 'in_transit', 'arrived', 'inspected', 'completed', 'cancelled')
                              ),
  inspection_checklist        JSONB DEFAULT '{"health_ok": true, "injuries": false, "feed_provided": true, "water_provided": true}'::jsonb,
  inspected_by                TEXT,
  inspection_notes            TEXT,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, transfer_number)
);

-- 6. Animal Legal Ownership History & Digital Chain of Custody
CREATE TABLE IF NOT EXISTS public.animal_ownership_history (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cattle_id                   UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  tag_id                      TEXT,
  transfer_reason             TEXT NOT NULL CHECK (
                                transfer_reason IN ('purchase', 'sale', 'inheritance', 'internal_transfer', 'partner_allocation', 'lease', 'disposal')
                              ),
  previous_owner_name         TEXT NOT NULL,
  previous_owner_contact      TEXT,
  new_owner_name              TEXT NOT NULL,
  new_owner_contact           TEXT,
  transfer_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  transfer_price              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  legal_document_ref          TEXT,
  digital_signature_hash      TEXT,
  witness_name                TEXT,
  approval_status             TEXT NOT NULL DEFAULT 'verified' CHECK (approval_status IN ('pending', 'verified', 'contested', 'archived')),
  notes                       TEXT,
  recorded_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Commercial Contracts & Agreements
CREATE TABLE IF NOT EXISTS public.commerce_contracts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  contract_number             TEXT NOT NULL,
  title                       TEXT NOT NULL,
  contract_type               TEXT NOT NULL CHECK (
                                contract_type IN ('purchase_agreement', 'sale_contract', 'supply_framework', 'ownership_transfer', 'transport_contract', 'custom_farming')
                              ),
  counterparty_name           TEXT NOT NULL,
  counterparty_contact        TEXT,
  start_date                  DATE NOT NULL,
  end_date                    DATE,
  total_contract_value        NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  terms_and_conditions        TEXT,
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (
                                status IN ('draft', 'active', 'fulfilled', 'terminated', 'expired')
                              ),
  document_url                TEXT,
  signed_at                   TIMESTAMPTZ,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, contract_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commerce_orders_biz_status ON public.commerce_orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_biz_type ON public.commerce_orders(business_id, order_type);
CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order_id ON public.commerce_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_order_items_cattle_id ON public.commerce_order_items(cattle_id);
CREATE INDEX IF NOT EXISTS idx_commerce_invoices_biz_status ON public.commerce_invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_commerce_payments_invoice ON public.commerce_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commerce_transfers_biz_status ON public.commerce_transfers(business_id, transit_status);
CREATE INDEX IF NOT EXISTS idx_ownership_history_cattle ON public.animal_ownership_history(cattle_id);
CREATE INDEX IF NOT EXISTS idx_commerce_contracts_biz ON public.commerce_contracts(business_id, status);

-- Row Level Security
ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animal_ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business commerce orders') THEN
    CREATE POLICY "Users can view their business commerce orders" ON public.commerce_orders
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business commerce order items') THEN
    CREATE POLICY "Users can view their business commerce order items" ON public.commerce_order_items
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business commerce invoices') THEN
    CREATE POLICY "Users can view their business commerce invoices" ON public.commerce_invoices
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business commerce payments') THEN
    CREATE POLICY "Users can view their business commerce payments" ON public.commerce_payments
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business commerce transfers') THEN
    CREATE POLICY "Users can view their business commerce transfers" ON public.commerce_transfers
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business animal ownership history') THEN
    CREATE POLICY "Users can view their business animal ownership history" ON public.animal_ownership_history
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business commerce contracts') THEN
    CREATE POLICY "Users can view their business commerce contracts" ON public.commerce_contracts
      FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

