import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import { runCronBackup } from "./backup-helpers";

// Vercel Cron / Scheduled Function — runs every Monday 08:00 UTC or on-demand by authorized user
// Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_EMAIL, RESEND_API_KEY, CRON_SECRET

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiRoute(req, {
    allowCron: true,
    requiredPermission: PERMISSIONS.BACKUP_MANAGE,
    rateLimitConfig: { maxRequests: 10, windowMs: 60_000 },
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  const { auth } = authResult;

  // 1. User on-demand business data backup
  if (auth.type === "user") {
    const ctx = auth.context;
    const bizId = ctx.businessId;
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const userSupabase = await createServerClient();

    const [
      { data: cattle },
      { data: sales },
      { data: costs },
      { data: weightLogs },
      { data: inventory },
      { data: transactions },
    ] = await Promise.all([
      userSupabase.from("cattle").select("*").eq("business_id", bizId).order("created_at", { ascending: false }),
      userSupabase.from("sales").select("*, cattle!inner(business_id)").eq("cattle.business_id", bizId).order("sold_at", { ascending: false }),
      userSupabase.from("cost_entries").select("*").eq("business_id", bizId).order("recorded_at", { ascending: false }),
      userSupabase.from("weight_logs").select("*").in("cattle_id", (await userSupabase.from("cattle").select("id").eq("business_id", bizId)).data?.map(c => c.id) ?? []).order("recorded_at", { ascending: false }),
      userSupabase.from("inventory_items").select("*").eq("business_id", bizId),
      userSupabase.from("inventory_transactions").select("*").in("item_id", (await userSupabase.from("inventory_items").select("id").eq("business_id", bizId)).data?.map(i => i.id) ?? []).order("recorded_at", { ascending: false }),
    ]);

    return NextResponse.json({
      ok: true,
      business_id: bizId,
      cattle: cattle ?? [],
      sales: sales ?? [],
      costs: costs ?? [],
      weightLogs: weightLogs ?? [],
      inventory: inventory ?? [],
      transactions: transactions ?? [],
    });
  }

  // 2. Cron scheduled backup
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const summary = await runCronBackup(supabaseUrl, serviceKey, process.env.BACKUP_EMAIL);
  return NextResponse.json(summary);
}