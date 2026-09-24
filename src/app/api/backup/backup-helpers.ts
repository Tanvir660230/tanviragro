import type { SupabaseClient } from "@supabase/supabase-js";

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  return "\uFEFF" + [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export async function sendBackupEmail(
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
      from: process.env.EMAIL_FROM ?? "Tanvir Agro Backup <backup@chowdhury-agro.com>",
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

export const BACKUP_BUCKET = "backups";

export async function uploadToStorage(
  supabase: SupabaseClient,
  path: string,
  content: string
): Promise<boolean> {
  await supabase.storage.createBucket(BACKUP_BUCKET, { public: false }).catch((err: { status?: number; statusCode?: number }) => {
    const status = err?.status ?? err?.statusCode;
    if (status !== 409 && status !== 400) {
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

export async function runCronBackup(supabaseUrl: string, serviceKey: string, backupEmail?: string) {
  const { createClient } = await import("@supabase/supabase-js");
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
    supabase.from("sales").select("*").order("sold_at", { ascending: false }),
    supabase.from("cost_entries").select("*").order("recorded_at", { ascending: false }),
    supabase.from("weight_logs").select("*").order("recorded_at", { ascending: false }),
    supabase.from("inventory_items").select("*"),
    supabase.from("inventory_transactions").select("*").order("recorded_at", { ascending: false }),
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

  const storageResults = await Promise.all(
    csvFiles.map((f) =>
      uploadToStorage(supabase, `weekly/${dateStr}/${f.filename}`, f.content)
    )
  );
  const storedCount = storageResults.filter(Boolean).length;

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
    for (const folder of foldersToDelete) {
      const { data: files } = await supabase.storage.from(BACKUP_BUCKET).list(folder);
      const paths = (files ?? []).map((f) => `${folder}/${f.name}`);
      if (paths.length > 0) {
        await supabase.storage.from(BACKUP_BUCKET).remove(paths);
      }
    }
  }

  let emailSent = false;
  if (backupEmail) {
    emailSent = await sendBackupEmail(
      backupEmail,
      `Tanvir Agro — Weekly Backup (Week ${weekNum}, ${dateStr})`,
      `Weekly data backup from Tanvir Agro ERP.\n\nGenerated: ${now.toUTCString()}\n\nStorage: ${storedCount}/${csvFiles.length} files saved to Supabase.\n\nAttached files:\n${csvFiles.map((f) => "• " + f.filename).join("\n")}`,
      csvFiles
    );
  }

  return {
    ok: true,
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
}