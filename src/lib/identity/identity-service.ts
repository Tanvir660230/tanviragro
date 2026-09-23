/**
 * Enterprise Identity Service
 * Sprint 21: Central service for identity operations, organization context,
 * delegation resolution, and password policy enforcement.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessContext } from "@/types/context";
import type { AbacPolicy, Delegation, PasswordPolicy } from "./types";
import { abacPolicyEngine } from "./abac-engine";
import { AuditService } from "@/lib/logging/audit";
import { logger } from "@/lib/logging/logger";

export class IdentityService {
  static async getAbacPolicies(supabase: SupabaseClient, businessId: string): Promise<AbacPolicy[]> {
    const { data, error } = await (supabase as any)
      .from("abac_policies").select("*")
      .eq("business_id", businessId).eq("is_active", true)
      .order("priority", { ascending: false });
    if (error) {
      logger.warn("Failed to load ABAC policies", { businessId, error: error.message });
      return [];
    }
    return (data ?? []) as AbacPolicy[];
  }

  static async evaluateAbac(
    supabase: SupabaseClient, ctx: BusinessContext,
    resourceType: string, action: string,
    resourceAttributes?: { ownerId?: string; businessId?: string; orgUnitId?: string }
  ): Promise<{ allowed: boolean; reason: string }> {
    const policies = await IdentityService.getAbacPolicies(supabase, ctx.businessId);
    const decision = abacPolicyEngine.evaluate(policies, {
      userId: ctx.user.id, businessId: ctx.businessId,
      role: ctx.role, isOwner: ctx.isOwner,
      resourceType, action,
      resourceOwnerId: resourceAttributes?.ownerId,
      resourceBusinessId: resourceAttributes?.businessId,
      resourceOrgUnitId: resourceAttributes?.orgUnitId,
    });
    return { allowed: decision.allowed, reason: decision.reason };
  }

  static async getActiveDelegations(
    supabase: SupabaseClient, delegateUserId: string, businessId: string
  ): Promise<Delegation[]> {
    const now = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from("delegations").select("*")
      .eq("delegate_id", delegateUserId).eq("business_id", businessId).eq("is_active", true)
      .lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`);
    if (error) {
      logger.warn("Failed to load delegations", { delegateUserId, error: error.message });
      return [];
    }
    return (data ?? []) as Delegation[];
  }

  static async getEffectivePermissions(supabase: SupabaseClient, ctx: BusinessContext): Promise<string[]> {
    const base = [...ctx.permissions];
    const delegations = await IdentityService.getActiveDelegations(supabase, ctx.user.id, ctx.businessId);
    const delegatedPerms = new Set<string>();
    for (const d of delegations) {
      for (const p of d.scope_permissions) delegatedPerms.add(p);
    }
    return [...new Set([...base, ...delegatedPerms])];
  }

  static async validatePassword(
    supabase: SupabaseClient, businessId: string, password: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const { data } = await (supabase as any)
      .from("password_policies").select("*").eq("business_id", businessId).maybeSingle();
    const policy = data as PasswordPolicy | null;
    if (!policy) {
      if (password.length < 8) return { valid: false, errors: ["Password must be at least 8 characters"] };
      return { valid: true, errors: [] };
    }
    const errors: string[] = [];
    if (password.length < policy.min_length) errors.push(`Password must be at least ${policy.min_length} characters`);
    if (policy.require_uppercase && !/[A-Z]/.test(password)) errors.push("Must contain uppercase letter");
    if (policy.require_lowercase && !/[a-z]/.test(password)) errors.push("Must contain lowercase letter");
    if (policy.require_numbers && !/\d/.test(password)) errors.push("Must contain a number");
    if (policy.require_symbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push("Must contain a special character");
    return { valid: errors.length === 0, errors };
  }

  static async deactivateMember(
    supabase: SupabaseClient, ctx: BusinessContext, targetUserId: string
  ): Promise<{ success: boolean; sessionsRevoked: number; error?: string }> {
    try {
      const { error } = await (supabase as any)
        .from("business_users")
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq("user_id", targetUserId).eq("business_id", ctx.businessId);
      if (error) return { success: false, sessionsRevoked: 0, error: "Failed to deactivate member" };
      const { data: revokedCount } = await (supabase as any).rpc("revoke_user_sessions", {
        p_target_user_id: targetUserId, p_revoked_by: ctx.user.id, p_business_id: ctx.businessId,
      });
      void AuditService.recordCritical({
        businessId: ctx.businessId, userId: ctx.user.id,
        action: "MEMBER_DEACTIVATED", entityType: "business_users", entityId: targetUserId,
        metadata: { revokedSessions: revokedCount ?? 0 },
      });
      return { success: true, sessionsRevoked: revokedCount ?? 0 };
    } catch (err: unknown) {
      return { success: false, sessionsRevoked: 0, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
}
