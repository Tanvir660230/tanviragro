-- ================================================================
-- Tanvir Agro ERP — Advanced ERP Settings
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- 1. Add missing fields to businesses table
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS default_tax_rate numeric DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS billing_plan text DEFAULT 'Free';

-- 2. Create API Keys table for Integrations
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Enable RLS for API keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Only business owners can view their API keys
CREATE POLICY "Business owners can view their API keys"
  ON public.api_keys FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Business owners can insert API keys
CREATE POLICY "Business owners can insert API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Business owners can delete API keys
CREATE POLICY "Business owners can delete API keys"
  ON public.api_keys FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
