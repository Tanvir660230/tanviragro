import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import { runSupabaseDataQualityAudit } from "@/lib/governance/data-quality-auditor";

// Read-only Enterprise Data Quality audit — admin / owner endpoint.
// Exposes tenant-scoped integrity checks (duplicates, orphans, negative
// stock, cross-tenant anomalies, missing required fields) WITHOUT mutating
// any production data.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      allowCron: true,
      requiredPermission: PERMISSIONS.SETTINGS_VIEW,
      rateLimitConfig: { maxRequests: 30, windowMs: 60_000 },
    });

    if ("response" in authResult) {
      return authResult.response;
    }

    const { auth } = authResult;
    if (auth.type !== "user") {
      return NextResponse.json(
        { ok: false, error: "Data quality audit requires an authenticated user context" },
        { status: 403 }
      );
    }

    const businessId = auth.context.businessId;
    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: "No business context is available" },
        { status: 400 }
      );
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const report = await runSupabaseDataQualityAudit(supabase, businessId);

    return NextResponse.json({ ok: true, report });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "Failed to run data quality audit", message: errorMsg },
      { status: 500 }
    );
  }
}