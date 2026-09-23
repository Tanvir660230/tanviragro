import { NextRequest, NextResponse } from "next/server";
import { runDeepHealthChecks } from "@/lib/monitoring/health";
import { telemetryService } from "@/lib/monitoring/telemetry";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiRoute(req, {
      allowCron: true,
      requiredPermission: PERMISSIONS.SETTINGS_VIEW,
      rateLimitConfig: { maxRequests: 60, windowMs: 60_000 },
    });

    if ("response" in authResult) {
      return authResult.response;
    }

    const healthData = await runDeepHealthChecks();
    const systemMetrics = telemetryService.getSystemMetrics();
    const errors = telemetryService.getErrors();
    const perf = telemetryService.getPerformanceMetrics(25);
    const incidents = telemetryService.getIncidents();

    return NextResponse.json({
      ...healthData,
      systemMetrics,
      activeErrorsCount: errors.filter((e) => e.status === "active").length,
      recentPerformanceMetrics: perf,
      incidents,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    telemetryService.recordError(errorMsg, "api", "critical");
    return NextResponse.json(
      {
        overallStatus: "CRITICAL_OUTAGE",
        error: "Failed to execute health check probes",
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}
