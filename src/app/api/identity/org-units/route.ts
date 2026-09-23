/**
 * Organization Units API
 * Sprint 21: Enterprise org hierarchy management
 * GET  /api/identity/org-units        — list org units for current business
 * POST /api/identity/org-units        — create org unit
 * PATCH /api/identity/org-units/[id] — update org unit
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import { AuditService } from "@/lib/logging/audit";

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.SETTINGS_VIEW,
      rateLimitConfig: { maxRequests: 60, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId } = auth.context;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("organization_units")
      .select("id, parent_id, unit_type, name, code, manager_user_id, is_active, created_at")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("unit_type")
      .order("name");

    if (error) return NextResponse.json({ error: "Failed to fetch organization units" }, { status: 500 });

    return NextResponse.json({ success: true, units: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.SETTINGS_EDIT,
      rateLimitConfig: { maxRequests: 20, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId, user } = auth.context;

    const body = await req.json();
    const { unitType, name, code, parentId, managerUserId, metadata } = body;

    const validTypes = ["company", "branch", "region", "farm", "department", "team"];
    if (!unitType || !validTypes.includes(unitType)) {
      return NextResponse.json({ error: `unitType must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("organization_units")
      .insert({
        business_id: businessId,
        unit_type: unitType,
        name,
        code: code ?? null,
        parent_id: parentId ?? null,
        manager_user_id: managerUserId ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Unit code already exists in this business" }, { status: 409 });
      return NextResponse.json({ error: "Failed to create organization unit" }, { status: 500 });
    }

    void AuditService.record({
      businessId, userId: user.id,
      action: "ORG_UNIT_CREATED", entityType: "organization_units", entityId: data.id,
      metadata: { unitType, name },
    });

    return NextResponse.json({ success: true, unit: data }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
