/**
 * Enterprise Identity Platform — Core Types
 * Sprint 21: Full identity type system for multi-tenant ERP
 */

export type IdentityType =
  | "user"
  | "employee"
  | "contractor"
  | "external_partner"
  | "customer"
  | "supplier"
  | "veterinarian"
  | "api_client"
  | "service_account";

export type OrgUnitType = "company" | "branch" | "region" | "farm" | "department" | "team";

export type DelegationType = "act_on_behalf" | "approval" | "vacation" | "emergency";

export type AbacEffect = "allow" | "deny";

export type SessionDeviceType = "mobile" | "desktop" | "tablet" | "api" | "unknown";

export type AuditSeverity = "info" | "warn" | "critical";

// ── Organization Unit ──────────────────────────────────────────────────────────
export interface OrganizationUnit {
  id: string;
  business_id: string;
  parent_id: string | null;
  unit_type: OrgUnitType;
  name: string;
  code: string | null;
  manager_user_id: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Identity Member ────────────────────────────────────────────────────────────
export interface IdentityMember {
  id: string;
  business_id: string;
  user_id: string;
  role: string;
  identity_type: IdentityType;
  org_unit_id: string | null;
  display_name: string | null;
  phone: string | null;
  is_active: boolean;
  invited_by: string | null;
  joined_at: string | null;
  deactivated_at: string | null;
  permissions_override: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Delegation ────────────────────────────────────────────────────────────────
export interface Delegation {
  id: string;
  business_id: string;
  delegator_id: string;
  delegate_id: string;
  delegation_type: DelegationType;
  scope_permissions: string[];
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
}

// ── ABAC Policy ───────────────────────────────────────────────────────────────
export interface AbacPolicy {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  subject_role: string | null;
  subject_user_id: string | null;
  resource_type: string;
  action: string;
  conditions: Record<string, unknown>;
  effect: AbacEffect;
  priority: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── ABAC Evaluation Context ────────────────────────────────────────────────────
export interface AbacEvaluationContext {
  userId: string;
  businessId: string;
  role: string;
  isOwner: boolean;
  resourceType: string;
  action: string;
  resourceOwnerId?: string;
  resourceBusinessId?: string;
  resourceOrgUnitId?: string;
  attributes?: Record<string, unknown>;
}

// ── ABAC Decision ─────────────────────────────────────────────────────────────
export interface AbacDecision {
  allowed: boolean;
  reason: string;
  appliedPolicy?: string;
  evaluatedAt: string;
}

// ── Password Policy ───────────────────────────────────────────────────────────
export interface PasswordPolicy {
  id: string;
  business_id: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
  max_age_days: number | null;
  prevent_reuse_count: number | null;
  max_failed_attempts: number;
  lockout_duration_min: number;
  session_timeout_min: number;
  mfa_required: boolean;
  mfa_grace_period_days: number | null;
  created_at: string;
  updated_at: string;
}

// ── Session ────────────────────────────────────────────────────────────────────
export interface UserSession {
  id: string;
  user_id: string;
  business_id: string | null;
  device_name: string | null;
  device_type: SessionDeviceType | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  expires_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
}

// ── Audit Log Record ──────────────────────────────────────────────────────────
export interface AuditLogRecord {
  id: string;
  business_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown | null;
  new_value: unknown | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  severity: AuditSeverity;
  created_at: string;
}
