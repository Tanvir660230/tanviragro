import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Vercel Cron: schedule defined in vercel.json — runs every Monday 08:00 UTC
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_EMAIL, RESEND_API_KEY, CRON_SECRET

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  // UTF-8 BOM so Excel/LibreOffice auto-detects encoding instead of defaulting to Windows-1252
  return "﻿" + [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

async function sendBackupEmail(
  to: string,
  subject: string,
  text: string,
  attachments: { filename: string; content: string }[]
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Chowdhury Agro Backup <backup@chowdhury-agro.com>",
      to: [to],
      subject,
      text,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
      })),
    }),
  });

  return res.ok;
}

const BACKUP_BUCKET = "backups";

 
async function uploadToStorage(
   
  supabase: SupabaseClient<any>,
  path: string,
  content: string
): Promise<boolean> {
  // Ensure bucket exists (no-op if already there)
  await supabase.storage.createBucket(BACKUP_BUCKET, { public: false }).catch((err: { status?: number; statusCode?: number }) => {
    const status = err?.status ?? err?.statusCode;
    if (status !== 409 && status !== 400) {
      // 409 = bucket already exists (expected), 400 = duplicate (Supabase variant)
      // Any other error should be logged
      console.error("[Backup] Failed to create bucket:", err);
    }
  });

  const { error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .upload(path, Buffer.from(content, "utf-8"), {
      contentType: "text/csv; charset=utf-8",
      upsert: true,
    });

  if (error) {
    console.error("[Backup] Storage upload failed:", path, error.message);
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const isCron = secret && token === secret;

  // Allow authenticated users to download their own data (no CRON_SECRET needed)
  if (!isCron) {
    const userSupabase = await createServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: biz } = await userSupabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const bizId = biz.id;
    const [
      { data: cattle },
      { data: sales },
      { data: costs },
      { data: weightLogs },
      { data: inventory },
      { data: transactions },
    ] = await Promise.all([
      userSupabase.from("cattle").select("*").eq("business_id", bizId).order("created_at", { ascending: false }),
      userSupabase.from("sales").select("*").eq("cattle.business_id", bizId).order("sold_at", { ascending: false }),
      userSupabase.from("cost_entries").select("*").eq("business_id", bizId).order("recorded_at", { ascending: false }),
      userSupabase.from("weight_logs").select("*").in("cattle_id", (await userSupabase.from("cattle").select("id").eq("business_id", bizId)).data?.map(c => c.id) ?? []).order("recorded_at", { ascending: false }),
      userSupabase.from("inventory_items").select("*").eq("business_id", bizId),
      userSupabase.from("inventory_transactions").select("*").in("item_id", (await userSupabase.from("inventory_items").select("id").eq("business_id", bizId)).data?.map(i => i.id) ?? []).order("recorded_at", { ascending: false }),
    ]);

    const dateStr = new Date().toISOString().split("T")[0];
    const payload = JSON.stringify({ cattle, sales, costs, weight_logs: weightLogs, inventory, transactions, exported_at: new Date().toISOString() }, null, 2);
    return new NextResponse(payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${biz.name.replace(/[^a-z0-9]/gi, "_")}_backup_${dateStr}.json"`,
      },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const [
    { data: cattle },
    { data: sales },
    { data: costs },
    { data: weightLogs },
    { data: inventory },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("cattle").select("*").order("created_at", { ascending: false }),
    supabase.from("sales").select("*, cattle(tag_id)").order("sold_at", { ascending: false }),
    supabase.from("cost_entries").select("*").order("recorded_at", { ascending: false }),
    supabase.from("weight_logs").select("*").order("recorded_at", { ascending: false }),
    supabase.from("inventory_items").select("*"),
    supabase
      .from("inventory_transactions")
      .select("*")
      .order("recorded_at", { ascending: false }),
  ]);

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const weekNum = Math.ceil(now.getDate() / 7);

  const csvFiles = [
    { filename: `cattle_${dateStr}.csv`, content: toCsv((cattle ?? []) as Record<string, unknown>[]) },
    { filename: `sales_${dateStr}.csv`, content: toCsv((sales ?? []) as Record<string, unknown>[]) },
    { filename: `costs_${dateStr}.csv`, content: toCsv((costs ?? []) as Record<string, unknown>[]) },
    { filename: `weight_logs_${dateStr}.csv`, content: toCsv((weightLogs ?? []) as Record<string, unknown>[]) },
    { filename: `inventory_${dateStr}.csv`, content: toCsv((inventory ?? []) as Record<string, unknown>[]) },
    { filename: `inventory_transactions_${dateStr}.csv`, content: toCsv((transactions ?? []) as Record<string, unknown>[]) },
  ];

  // Upload to Supabase Storage (versioned by date, keeps last 12 weeks)
  const storageResults = await Promise.all(
    csvFiles.map((f) =>
      uploadToStorage(supabase, `weekly/${dateStr}/${f.filename}`, f.content)
    )
  );
  const storedCount = storageResults.filter(Boolean).length;

  // Delete backups older than 12 weeks
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 84);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const { data: oldFolders } = await supabase.storage
    .from(BACKUP_BUCKET)
    .list("weekly", { limit: 100 });
  const foldersToDelete = (oldFolders ?? [])
    .filter((f) => f.name < cutoffStr)
    .map((f) => `weekly/${f.name}`);
  if (foldersToDelete.length > 0) {
    // List and delete files inside each old folder
    for (const folder of foldersToDelete) {
      const { data: files } = await supabase.storage.from(BACKUP_BUCKET).list(folder);
      const paths = (files ?? []).map((f) => `${folder}/${f.name}`);
      if (paths.length > 0) {
        await supabase.storage.from(BACKUP_BUCKET).remove(paths);
      }
    }
  }

  // Send email (best-effort; storage is the reliable copy)
  const backupEmail = process.env.BACKUP_EMAIL;
  let emailSent = false;

  if (backupEmail) {
    emailSent = await sendBackupEmail(
      backupEmail,
      `Chowdhury Agro — Weekly Backup (Week ${weekNum}, ${dateStr})`,
      `Weekly data backup from Chowdhury Agro ERP.\n\nGenerated: ${now.toUTCString()}\n\nStorage: ${storedCount}/${csvFiles.length} files saved to Supabase.\n\nAttached files:\n${csvFiles.map((f) => `• ${f.filename}`).join("\n")}`,
      csvFiles
    );
  }

  // If both methods failed, log loudly
  if (!emailSent && storedCount === 0) {
    console.error("[Backup] CRITICAL: Both email and storage backup failed on", dateStr);
  }

  const summary = {
    generated_at: now.toISOString(),
    rows: {
      cattle: cattle?.length ?? 0,
      sales: sales?.length ?? 0,
      costs: costs?.length ?? 0,
      weight_logs: weightLogs?.length ?? 0,
      inventory: inventory?.length ?? 0,
      transactions: transactions?.length ?? 0,
    },
    storage: { uploaded: storedCount, total: csvFiles.length },
    email_sent: emailSent,
    email_to: backupEmail ?? null,
  };

  return NextResponse.json(summary);
}
