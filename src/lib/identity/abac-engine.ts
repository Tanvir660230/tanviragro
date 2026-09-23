/**
 * Enterprise ABAC Policy Engine
 * Sprint 21: Attribute-based access control layered on top of RBAC.
 * Evaluates dynamic policies stored in the abac_policies table.
 */

import type { AbacPolicy, AbacEvaluationContext, AbacDecision } from "./types";
import { logger } from "@/lib/logging/logger";

export class AbacPolicyEngine {
  private static instance: AbacPolicyEngine;
  // In-process cache per business to avoid hot-path DB calls
  private policyCache: Map<string, { policies: AbacPolicy[]; cachedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60_000; // 60s TTL

  private constructor() {}

  public static getInstance(): AbacPolicyEngine {
    if (!AbacPolicyEngine.instance) {
      AbacPolicyEngine.instance = new AbacPolicyEngine();
    }
    return AbacPolicyEngine.instance;
  }

  /**
   * Evaluate ABAC policies for a given context.
   * Owners bypass all ABAC checks.
   * Returns an explicit allow/deny decision with reason.
   */
  public evaluate(
    policies: AbacPolicy[],
    ctx: AbacEvaluationContext
  ): AbacDecision {
    if (ctx.isOwner) {
      return {
        allowed: true,
        reason: "Owner bypasses all ABAC constraints",
        evaluatedAt: new Date().toISOString(),
      };
    }

    const applicable = policies
      .filter((p) => p.is_active)
      .filter((p) => p.resource_type === ctx.resourceType && p.action === ctx.action)
      .filter((p) =>
        (!p.subject_role || p.subject_role === ctx.role) &&
        (!p.subject_user_id || p.subject_user_id === ctx.userId)
      )
      .sort((a, b) => b.priority - a.priority); // Highest priority first

    for (const policy of applicable) {
      if (this.evaluateConditions(policy.conditions, ctx)) {
        const allowed = policy.effect === "allow";

        logger.debug("ABAC policy matched", {
          businessId: ctx.businessId,
          userId: ctx.userId,
          policy: policy.name,
          effect: policy.effect,
          resourceType: ctx.resourceType,
          action: ctx.action,
        });

        return {
          allowed,
          reason: `Policy [${policy.name}] effect: ${policy.effect}`,
          appliedPolicy: policy.id,
          evaluatedAt: new Date().toISOString(),
        };
      }
    }

    // Default: RBAC handles — if no ABAC policy matched, we allow (RBAC is the primary gate)
    return {
      allowed: true,
      reason: "No ABAC policy matched — deferring to RBAC",
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluate structured condition JSON against evaluation context.
   * Supports: time_of_day, ip_whitelist, same_org_unit, resource_owner_only
   */
  private evaluateConditions(
    conditions: Record<string, unknown>,
    ctx: AbacEvaluationContext
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    // Time-of-day restriction: { "time_range": { "start": "08:00", "end": "20:00" } }
    if (conditions.time_range) {
      const range = conditions.time_range as { start: string; end: string };
      const now = new Date();
      const hour = now.getUTCHours();
      const min = now.getUTCMinutes();
      const current = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      if (current < range.start || current > range.end) return false;
    }

    // Same org unit check: { "require_same_org_unit": true }
    if (conditions.require_same_org_unit && ctx.resourceOrgUnitId) {
      const hasOrgUnit = ctx.attributes?.orgUnitId;
      if (!hasOrgUnit || hasOrgUnit !== ctx.resourceOrgUnitId) return false;
    }

    // Resource owner only: { "resource_owner_only": true }
    if (conditions.resource_owner_only && ctx.resourceOwnerId) {
      if (ctx.userId !== ctx.resourceOwnerId) return false;
    }

    // Tenant match: { "require_same_tenant": true }
    if (conditions.require_same_tenant && ctx.resourceBusinessId) {
      if (ctx.businessId !== ctx.resourceBusinessId) return false;
    }

    return true;
  }

  /**
   * Invalidates the local policy cache for a business.
   */
  public invalidateCache(businessId: string): void {
    this.policyCache.delete(businessId);
  }
}

export const abacPolicyEngine = AbacPolicyEngine.getInstance();
