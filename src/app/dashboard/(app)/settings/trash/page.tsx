import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrashRestoreButton } from "@/components/settings/TrashRestoreButton";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Trash Bin" };

export default async function TrashBinPage() {
   
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");

  const [{ data: deletedCosts }, { data: deletedItems }, { data: deletedLogs }] =
    await Promise.all([
      supabase
        .from("cost_entries")
        .select("id, type, category, amount, recorded_at, description, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(100),
      supabase
        .from("inventory_items")
        .select("id, name, unit, category, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(100),
      supabase
        .from("weight_logs")
        .select("id, weight_kg, recorded_at, cattle_id, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(100),
    ]);

  const hasCosts = (deletedCosts ?? []).length > 0;
  const hasItems = (deletedItems ?? []).length > 0;
  const hasLogs  = (deletedLogs  ?? []).length > 0;
  const hasAny   = hasCosts || hasItems || hasLogs;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.trash.title}
        subtitle={t.trash.subtitle}
        icon={Trash2}
        back="/dashboard/settings"
      />

      {!hasAny && (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card py-16 border border-border/60 shadow-card text-center">
          <Trash2 className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t.trash.empty}</p>
        </div>
      )}

      {/* Deleted Cost Entries */}
      {hasCosts && (
        <Section title={t.trash.cost_entries}>
          {(deletedCosts as { id: string; type: string; category: string; amount: number; recorded_at: string; deleted_at: string }[]).map((e) => (
            <TrashRow
              key={e.id}
              label={e.category}
              detail={`${e.type} · ৳${e.amount.toLocaleString("en-IN")} · ${new Date(e.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              deletedAt={e.deleted_at}
              restoreAction="cost_entry"
              id={e.id}
              table="cost_entries"
            />
          ))}
        </Section>
      )}

      {/* Deleted Inventory Items */}
      {hasItems && (
        <Section title={t.trash.inventory_items}>
          {(deletedItems as { id: string; name: string; unit: string; category: string; deleted_at: string }[]).map((i) => (
            <TrashRow
              key={i.id}
              label={i.name}
              detail={`${i.category} · ${i.unit}`}
              deletedAt={i.deleted_at}
              restoreAction="inventory_item"
              id={i.id}
              table="inventory_items"
            />
          ))}
        </Section>
      )}

      {/* Deleted Weight Logs */}
      {hasLogs && (
        <Section title={t.trash.weight_logs}>
          {(deletedLogs as { id: string; weight_kg: number; recorded_at: string; cattle_id: string; deleted_at: string }[]).map((l) => (
            <TrashRow
              key={l.id}
              label={`${l.weight_kg} kg`}
              detail={new Date(l.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              deletedAt={l.deleted_at}
              restoreAction="weight_log"
              id={l.id}
              table="weight_logs"
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function TrashRow({
  label,
  detail,
  deletedAt,
  restoreAction,
  id,
  table,
}: {
  label: string;
  detail: string;
  deletedAt: string;
  restoreAction: "cost_entry" | "inventory_item" | "weight_log";
  id: string;
  table: "cost_entries" | "inventory_items" | "weight_logs";
}) {
  const deletedDate = new Date(deletedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail} · {new Date(deletedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      </div>
      <TrashRestoreButton id={id} restoreAction={restoreAction} table={table} />
    </div>
  );
}
