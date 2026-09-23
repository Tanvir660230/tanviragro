-- ============================================================================
-- Migration 032: Enterprise Identity, Organization Hierarchy & RBAC Platform
-- Sprint 21 — Production Identity Platform
-- ============================================================================

-- ── 2. Enhanced Business Users ────────────────────────────────────────────────
ALTER TABLE public.business_users
  ADD COLUMN IF NOT EXISTS identity_type        TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS org_unit_id          UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_name         TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS permissions_override JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metadata             JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── 3. Persistent Audit Log Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  old_value     JSONB,
  new_value     JSONB,
  metadata      JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Session Tracking ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id    UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  device_name    TEXT,
  device_type    TEXT CHECK (device_type IN ('mobile','desktop','tablet','api','unknown')),
  ip_address     TEXT,
  user_agent     TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  revoked_at     TIMESTAMPTZ,
  revoked_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. Delegation System ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delegations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delegator_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegation_type   TEXT NOT NULL CHECK (delegation_type IN ('act_on_behalf','approval','vacation','emergency')),
  scope_permissions JSONB NOT NULL DEFAULT '[]',
  valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until       TIMESTAMPTZ,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_delegation CHECK (delegator_id <> delegate_id)
);

-- ── 6. ABAC Policy Store ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.abac_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  subject_role    TEXT,
  subject_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL,
  action          TEXT NOT NULL,
  conditions      JSONB NOT NULL DEFAULT '{}',
  effect          TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
  priority        INTEGER NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. Password Policy Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  min_length            INTEGER NOT NULL DEFAULT 8,
  require_uppercase     BOOLEAN NOT NULL DEFAULT true,
  require_lowercase     BOOLEAN NOT NULL DEFAULT true,
  require_numbers       BOOLEAN NOT NULL DEFAULT true,
  require_symbols       BOOLEAN NOT NULL DEFAULT false,
  max_age_days          INTEGER DEFAULT 90,
  prevent_reuse_count   INTEGER DEFAULT 5,
  max_failed_attempts   INTEGER NOT NULL DEFAULT 5,
  lockout_duration_min  INTEGER NOT NULL DEFAULT 30,
  session_timeout_min   INTEGER NOT NULL DEFAULT 480,
  mfa_required          BOOLEAN NOT NULL DEFAULT false,
  mfa_grace_period_days INTEGER DEFAULT 7,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1. Identity & Organization Types ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
  unit_type       TEXT NOT NULL CHECK (unit_type IN ('company','branch','region','farm','department','team')),
  name            TEXT NOT NULL,
  code            TEXT,
  manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, code)
);

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE public.organization_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for organization_units" ON public.organization_units;
CREATE POLICY "Tenant isolation for organization_units" ON public.organization_units
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant audit log isolation" ON public.audit_logs;
CREATE POLICY "Tenant audit log isolation" ON public.audit_logs
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User can view own sessions" ON public.user_sessions;
CREATE POLICY "User can view own sessions" ON public.user_sessions
  FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Delegation tenant isolation" ON public.delegations;
CREATE POLICY "Delegation tenant isolation" ON public.delegations
  FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR delegator_id = auth.uid() OR delegate_id = auth.uid()
  );

ALTER TABLE public.abac_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ABAC policy tenant isolation" ON public.abac_policies;
CREATE POLICY "ABAC policy tenant isolation" ON public.abac_policies
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

ALTER TABLE public.password_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Password policy tenant isolation" ON public.password_policies;
CREATE POLICY "Password policy tenant isolation" ON public.password_policies
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Fix existing RLS to support team member access
DROP POLICY IF EXISTS "business_users team isolation" ON public.business_users;
CREATE POLICY "business_users team isolation" ON public.business_users
  FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "cattle in own business" ON public.cattle;
CREATE POLICY "cattle in own business" ON public.cattle
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "inventory_items in own business" ON public.inventory_items;
CREATE POLICY "inventory_items in own business" ON public.inventory_items
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "cost_entries in own business" ON public.cost_entries;
CREATE POLICY "cost_entries in own business" ON public.cost_entries
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_units_biz ON public.organization_units(business_id, unit_type);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON public.organization_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_biz ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_biz ON public.user_sessions(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON public.delegations(delegate_id, is_active);
CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON public.delegations(delegator_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bus_users_user ON public.business_users(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_abac_resource ON public.abac_policies(business_id, resource_type, action);

-- ── log_audit RPC ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_audit(
  p_business_id UUID, p_user_id UUID,
  p_action TEXT, p_entity_type TEXT, p_entity_id TEXT,
  p_old_value JSONB DEFAULT NULL, p_new_value JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL, p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL, p_severity TEXT DEFAULT 'info'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    business_id, user_id, action, entity_type, entity_id,
    old_value, new_value, metadata, ip_address, user_agent, severity
  ) VALUES (
    p_business_id, p_user_id, p_action, p_entity_type, p_entity_id,
    p_old_value, p_new_value, p_metadata, p_ip_address, p_user_agent, p_severity
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── revoke_user_sessions RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(
  p_target_user_id UUID, p_revoked_by UUID, p_business_id UUID
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.user_sessions
  SET is_active = false, revoked_at = now(), revoked_by = p_revoked_by
  WHERE user_id = p_target_user_id AND business_id = p_business_id AND is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.revoke_user_sessions(UUID,UUID,UUID);
-- DROP FUNCTION IF EXISTS public.log_audit(UUID,UUID,TEXT,TEXT,TEXT,JSONB,JSONB,JSONB,TEXT,TEXT,TEXT);
-- DROP TABLE IF EXISTS public.abac_policies CASCADE;
-- DROP TABLE IF EXISTS public.password_policies CASCADE;
-- DROP TABLE IF EXISTS public.delegations CASCADE;
-- DROP TABLE IF EXISTS public.user_sessions CASCADE;
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.organization_units CASCADE;
-- ============================================================================

