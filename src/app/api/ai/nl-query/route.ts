import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { AiNaturalLanguageEngine } from "@/lib/ai/nl-engine";
import { AiAuditService } from "@/lib/ai/audit-service";
import { PERMISSIONS } from "@/constants/roles";
import { addDays, todayDhaka } from "@/lib/dates";
import { loadInventoryStats } from "@/lib/inventory/consumption-stats";

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

    // Load real tables/columns and map them to the field names the NL engine reads.
    // (Previously this queried a non-existent table and columns, so every answer
    // was computed from empty data.)
    const [cattleRes, weightRes, expenseRes, invRes, stockRes, healthRes] = await Promise.all([
      supabase
        .from("cattle")
        .select("id, tag_id, breed, status, initial_weight_kg")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null),
      supabase
        .from("weight_logs")
        .select("cattle_id, weight_kg, recorded_at, cattle!inner(business_id)")
        .eq("cattle.business_id", businessId)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("cost_entries")
        .select("id, amount, type, category, recorded_at")
        .eq("business_id", businessId)
        .is("deleted_at", null),
      supabase
        .from("inventory_items")
        .select("id, name, unit, low_stock_threshold")
        .eq("business_id", businessId)
        .is("deleted_at", null),
      loadInventoryStats(supabase, businessId, addDays(todayDhaka(), -30)).then((data) => ({ data })),
      supabase
        .from("health_events")
        .select("id, title, scheduled_at, completed_at, cattle_id")
        .eq("business_id", businessId)
        .is("deleted_at", null),
    ]);

    const latestWeight = new Map<string, number>();
    for (const w of (weightRes.data ?? []) as { cattle_id: string; weight_kg: number }[]) {
      if (!latestWeight.has(w.cattle_id)) latestWeight.set(w.cattle_id, Number(w.weight_kg));
    }
    const cattle = ((cattleRes.data ?? []) as { id: string; tag_id: string; breed: string | null; status: string; initial_weight_kg: number | null }[])
      .map((c) => ({
        id: c.id,
        tag_id: c.tag_id,
        breed: c.breed,
        status: c.status,
        purchase_weight_kg: Number(c.initial_weight_kg ?? 0),
        current_weight_kg: latestWeight.get(c.id) ?? Number(c.initial_weight_kg ?? 0),
      }));

    const stockByItem = new Map(
      ((stockRes.data ?? []) as { item_id: string; total_stock: number }[]).map((s) => [s.item_id, Number(s.total_stock ?? 0)])
    );
    const inventory = ((invRes.data ?? []) as { id: string; name: string; unit: string; low_stock_threshold: number | null }[])
      .map((i) => ({
        name: i.name,
        unit: i.unit,
        current_stock: stockByItem.get(i.id) ?? 0,
        reorder_threshold: i.low_stock_threshold ?? 10,
      }));

    const healthEvents = ((healthRes.data ?? []) as { id: string; title: string; scheduled_at: string; completed_at: string | null; cattle_id: string }[])
      .map((e) => ({ ...e, status: e.completed_at ? "completed" : "pending" }));

    const result = await AiNaturalLanguageEngine.processNaturalLanguageQuery(
      { query, locale: locale || "en", userId: user.id, businessId },
      { cattle, expenses: expenseRes.data ?? [], inventory, healthEvents }
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
