import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { AiNaturalLanguageEngine } from "@/lib/ai/nl-engine";
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
    const { query, locale } = body;
    if (!query) return NextResponse.json({ error: "Query string is required" }, { status: 400 });

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const [cattleRes, expenseRes, invRes, healthRes] = await Promise.all([
      (supabase as any).from("cattle").select("id, tag_id, breed, current_weight_kg, purchase_weight_kg, status").eq("business_id", businessId),
      (supabase as any).from("financial_transactions").select("id, amount, type, category, recorded_at").eq("business_id", businessId),
      (supabase as any).from("inventory_items").select("id, name, current_stock, reorder_threshold, unit").eq("business_id", businessId),
      (supabase as any).from("health_events").select("id, title, scheduled_at, cattle_id, status").eq("business_id", businessId),
    ]);

    const result = await AiNaturalLanguageEngine.processNaturalLanguageQuery(
      { query, locale: locale || "en", userId: user.id, businessId },
      { cattle: cattleRes.data || [], expenses: expenseRes.data || [], inventory: invRes.data || [], healthEvents: healthRes.data || [] }
    );

    const latencyMs = Date.now() - startTime;
    AiAuditService.logInference({
      businessId, userId: user.id, task: "nl_query",
      provider: "local_rules", model: "FarmNL-SemanticRouter-v2",
      latencyMs, prompt: query, outputSummary: result.answerSummary,
      confidenceScore: result.explainability.confidenceScore,
    });

    return NextResponse.json({ success: true, response: result, latencyMs });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
