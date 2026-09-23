/**
 * Delegation API
 * Sprint 21: Act-on-behalf, approval delegation, vacation mode, emergency override
 * GET  /api/identity/delegations       — list active delegations for current user
 * POST /api/identity/delegations       — create delegation
 * DELETE /api/identity/delegations     — revoke delegation
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import { AuditService } from "@/lib/logging/audit";

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.SETTINGS_VIEW,
      rateLimitConfig: { maxRequests: 30, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId, user } = auth.context;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("delegations")
      .select("id, delegator_id, delegate_id, delegation_type, scope_permissions, valid_from, valid_until, notes, is_active, created_at")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .or(`delegator_id.eq.${user.id},delegate_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: "Failed to fetch delegations" }, { status: 500 });

    return NextResponse.json({ success: true, delegations: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.TEAM_MANAGE,
      rateLimitConfig: { maxRequests: 10, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId, user } = auth.context;

    const body = await req.json();
    const { delegateId, delegationType, scopePermissions, validUntil, notes } = body;

    if (!delegateId || !delegationType) {
      return NextResponse.json({ error: "delegateId and delegationType are required" }, { status: 400 });
    }
    if (delegateId === user.id) {
      return NextResponse.json({ error: "Cannot delegate to yourself" }, { status: 400 });
    }

    const validTypes = ["act_on_behalf", "approval", "vacation", "emergency"];
    if (!validTypes.includes(delegationType)) {
      return NextResponse.json({ error: `Invalid delegation type. Must be: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("delegations")
      .insert({
        business_id: businessId,
        delegator_id: user.id,
        delegate_id: delegateId,
        delegation_type: delegationType,
        scope_permissions: scopePermissions ?? [],
        valid_until: validUntil ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to create delegation" }, { status: 500 });

    void AuditService.record({
      businessId,
      userId: user.id,
      action: "DELEGATION_CREATED",
      entityType: "delegations",
      entityId: data.id,
      metadata: { delegateId, delegationType },
      severity: "warn",
    });

    return NextResponse.json({ success: true, delegation: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.TEAM_MANAGE,
      rateLimitConfig: { maxRequests: 10, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId, user } = auth.context;

    const body = await req.json();
    const { delegationId } = body;
    if (!delegationId) return NextResponse.json({ error: "delegationId is required" }, { status: 400 });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await (supabase as any)
      .from("delegations")
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq("id", delegationId)
      .eq("business_id", businessId)
      .eq("delegator_id", user.id);

    if (error) return NextResponse.json({ error: "Failed to revoke delegation" }, { status: 500 });

    void AuditService.record({
      businessId, userId: user.id,
      action: "DELEGATION_REVOKED", entityType: "delegations", entityId: delegationId,
      severity: "warn",
    });

    return NextResponse.json({ success: true, message: "Delegation revoked" });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
