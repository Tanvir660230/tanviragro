/**
 * Session Management API
 * Sprint 21: Device tracking, session list, force-logout
 * GET  /api/identity/sessions   — list active sessions for current user
 * DELETE /api/identity/sessions — revoke a session (force logout)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import { AuditService } from "@/lib/logging/audit";
import { getClientIp } from "@/lib/security";

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

    const { data: sessions, error } = await (supabase as any)
      .from("user_sessions")
      .select("id, device_name, device_type, ip_address, last_active_at, created_at, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("last_active_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sessions: sessions ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.SETTINGS_VIEW,
      rateLimitConfig: { maxRequests: 10, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId, user } = auth.context;

    const body = await req.json();
    const { sessionId, targetUserId } = body;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Owner/admin can revoke any session in their business; others only their own
    const effectiveTargetUserId = (auth.context.isAdmin && targetUserId) ? targetUserId : user.id;

    const { error } = await (supabase as any)
      .from("user_sessions")
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq("id", sessionId)
      .eq("user_id", effectiveTargetUserId);

    if (error) return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });

    void AuditService.record({
      businessId,
      userId: user.id,
      action: "SESSION_REVOKED",
      entityType: "user_sessions",
      entityId: sessionId,
      metadata: { targetUserId: effectiveTargetUserId },
      severity: "warn",
    });

    return NextResponse.json({ success: true, message: "Session revoked" });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
