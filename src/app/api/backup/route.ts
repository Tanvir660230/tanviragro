import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCronBackup } from "./backup-helpers";
import { readBackupTables } from "@/lib/backup/backup-tables";

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

    // every table of this farm, every row (see BACKUP_TABLES)
    const tables = await readBackupTables(userSupabase as unknown as SupabaseClient, bizId);

    return NextResponse.json({
      ok: true,
      business_id: bizId,
      generated_at: new Date().toISOString(),
      // the first backups' names, kept so older restores still read them
      cattle: tables.cattle,
      sales: tables.sales,
      costs: tables.cost_entries,
      weightLogs: tables.weight_logs,
      inventory: tables.inventory_items,
      transactions: tables.inventory_transactions,
      tables,
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