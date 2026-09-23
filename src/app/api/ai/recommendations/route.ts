import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { AiRecommendationEngine } from "@/lib/ai/recommendation-engine";
import { AiAuditService } from "@/lib/ai/audit-service";
import { PERMISSIONS } from "@/constants/roles";

export async function GET(req: NextRequest) {
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

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const [cattleRes, invRes, healthRes] = await Promise.all([
      (supabase as any).from("cattle").select("id, tag_id, tag_number, current_weight_kg, days_on_feed").eq("business_id", businessId),
      (supabase as any).from("inventory_items").select("id, name, current_stock, reorder_threshold, unit, unit_cost").eq("business_id", businessId),
      (supabase as any).from("health_events").select("id, title, scheduled_at, cattle_id, status").eq("business_id", businessId).eq("status", "pending"),
    ]);

    const cattle = cattleRes.data || [];
    const inventory = invRes.data || [];
    const pendingHealth = healthRes.data || [];

    const overdueVaccines = pendingHealth
      .filter((h: any) => new Date(h.scheduled_at) < new Date())
      .map((h: any) => ({ cattleId: h.cattle_id, tagNumber: h.cattle_id?.slice(0, 6) || "TAG-N/A", vaccineName: h.title, dueDate: h.scheduled_at }));

    const lowStockInventory = inventory
      .filter((i: any) => Number(i.current_stock) <= Number(i.reorder_threshold || 10))
      .map((i: any) => ({ id: i.id, name: i.name, currentStock: Number(i.current_stock), threshold: Number(i.reorder_threshold || 10), unit: i.unit || "kg", unitCost: Number(i.unit_cost || 50) }));

    const plateauCattle = cattle
      .filter((c: any) => Number(c.current_weight_kg) >= 500).slice(0, 5)
      .map((c: any) => ({ id: c.id, tagNumber: c.tag_id || c.tag_number || "TAG", weightKg: Number(c.current_weight_kg), daysOnFeed: Number(c.days_on_feed || 120) }));

    const recommendations = AiRecommendationEngine.generateOperationalRecommendations({ businessId, overdueVaccines, lowStockInventory, plateauCattle });

    const latencyMs = Date.now() - startTime;
    AiAuditService.logInference({
      businessId, userId: user.id, task: "treatment_recommendation",
      provider: "local_rules", model: "OperationalAdvisor-v1",
      latencyMs, prompt: "Generate operational recommendations from farm signals",
      outputSummary: `Generated ${recommendations.length} recommendations`, confidenceScore: 0.94,
    });

    return NextResponse.json({ success: true, recommendations, latencyMs });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
