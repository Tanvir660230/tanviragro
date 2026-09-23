import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { AiPredictionEngine } from "@/lib/ai/prediction-engine";
import { AiAuditService } from "@/lib/ai/audit-service";
import { PERMISSIONS } from "@/constants/roles";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const authResult = await authenticateApiRoute(req, {
      requiredPermission: PERMISSIONS.REPORTS_VIEW,
      rateLimitConfig: { maxRequests: 30, windowMs: 60_000 },
    });
    if ("response" in authResult) return authResult.response;
    const { auth } = authResult;
    if (auth.type !== "user") return NextResponse.json({ error: "User session required" }, { status: 401 });
    const { businessId, user } = auth.context;

    const body = await req.json();
    const { task, payload } = body;
    let result: unknown = null;

    switch (task) {
      case "disease_risk":       result = AiPredictionEngine.predictDiseaseRisk(payload); break;
      case "mortality_risk":     result = AiPredictionEngine.assessMortalityRisk(payload); break;
      case "growth_trajectory":  result = AiPredictionEngine.predictGrowthTrajectory(payload); break;
      case "feed_demand":        result = AiPredictionEngine.forecastFeedDemand(payload); break;
      case "breeding_probability": result = AiPredictionEngine.computeBreedingProbability(payload); break;
      default:
        return NextResponse.json({ error: `Unsupported prediction task: ${task}` }, { status: 400 });
    }

    const latencyMs = Date.now() - startTime;
    AiAuditService.logInference({
      businessId, userId: user.id, task: task || "disease_risk",
      provider: "local_rules",
      model: (result as any)?.explainability?.modelName || "RuleEngine-v1",
      latencyMs, prompt: JSON.stringify(payload), outputSummary: JSON.stringify(result),
      confidenceScore: (result as any)?.explainability?.confidenceScore || 0.9,
    });

    return NextResponse.json({ success: true, prediction: result, latencyMs });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
