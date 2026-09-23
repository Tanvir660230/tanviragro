import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { AnalyticsAggregationService } from "@/lib/analytics/aggregation-service";
import type { ExecutiveRoleSlug } from "@/lib/analytics/types";
import { PERMISSIONS } from "@/constants/roles";

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.REPORTS_VIEW,
      rateLimitConfig: { maxRequests: 60, windowMs: 60_000 },
    });

    if ("response" in authResult) {
      return authResult.response;
    }

    const { auth } = authResult;
    if (auth.type !== "user") {
      return NextResponse.json({ error: "User session required" }, { status: 401 });
    }

    const ctx = auth.context;
    const { searchParams } = new URL(req.url);
    const roleSlug = (searchParams.get("role") || "ceo") as ExecutiveRoleSlug;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const dashboardData = await AnalyticsAggregationService.getExecutiveDashboardData(
      supabase,
      ctx.businessId,
      roleSlug
    );

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to aggregate analytics data.";
    console.error("[API Analytics KPIs Error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

