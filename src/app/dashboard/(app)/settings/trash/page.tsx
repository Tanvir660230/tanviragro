import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle, Package, DollarSign, Scale, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrashRestoreButton } from "@/components/settings/TrashRestoreButton";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Soft-Deleted Trash Bin" };

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title={t.trash.title}
        subtitle={t.trash.subtitle}
        icon={Trash2}
        back="/dashboard/settings?tab=preferences"
      />

      {/* Summary notice banner */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5 flex items-start gap-3.5">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground text-sm">Archival Retention Policy</p>
          <p className="mt-0.5">
            Records deleted across expense logs, feed supplies, and weight checkups are preserved safely here. Restoring an item immediately brings it back to financial ledgers and dashboard metrics.
          </p>
        </div>
      </div>

      {!hasAny && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card py-20 border border-dashed border-border/80 shadow-xs text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Trash2 className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-foreground">{t.trash.empty}</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            No soft-deleted records exist in this workspace. When items are deleted, they will be kept here for safe recovery.
          </p>
        </div>
      )}

      {/* Deleted Cost Entries */}
      {hasCosts && (
        <Section title={`${t.trash.cost_entries} (${deletedCosts?.length})`} icon={DollarSign}>
          {(deletedCosts as { id: string; type: string; category: string; amount: number; recorded_at: string; deleted_at: string }[]).map((e) => (
            <TrashRow
              key={e.id}
              label={e.category}
              detail={`${e.type} · ৳${e.amount.toLocaleString("en-IN")} · Recorded ${new Date(e.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
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
        <Section title={`${t.trash.inventory_items} (${deletedItems?.length})`} icon={Package}>
          {(deletedItems as { id: string; name: string; unit: string; category: string; deleted_at: string }[]).map((i) => (
            <TrashRow
              key={i.id}
              label={i.name}
              detail={`Category: ${i.category} · Unit: ${i.unit}`}
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
        <Section title={`${t.trash.weight_logs} (${deletedLogs?.length})`} icon={Scale}>
          {(deletedLogs as { id: string; weight_kg: number; recorded_at: string; cattle_id: string; deleted_at: string }[]).map((l) => (
            <TrashRow
              key={l.id}
              label={`${l.weight_kg} kg Scale Reading`}
              detail={`Recorded on ${new Date(l.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
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

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border/70 shadow-sm overflow-hidden">
      <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {detail} · <span className="text-muted-foreground/80 font-mono text-[11px]">Deleted {deletedDate}</span>
        </p>
      </div>
      <TrashRestoreButton id={id} restoreAction={restoreAction} table={table} />
    </div>
  );
}
