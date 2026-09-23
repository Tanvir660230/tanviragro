"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Beef,
  Scale,
  HeartPulse,
  AlertTriangle,
  Eye,
  Trash2,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnterpriseDataGrid } from "@/components/data-grid/EnterpriseDataGrid";
import type { GridColumn, RowAction, BulkAction } from "@/components/data-grid/types";
import { Badge } from "@/components/ui/badge";
import { BulkWeightDialog } from "./BulkWeightDialog";
import { AddCattleDialog } from "./AddCattleDialog";
import { CattleActionsMenu } from "./CattleActionsMenu";
import { BulkLivestockImportDialog } from "@/components/livestock/bulk/BulkLivestockImportDialog";
import { BatchOperationsDialog } from "@/components/livestock/bulk/BatchOperationsDialog";

import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";
import { markAsDeceased } from "@/app/dashboard/(app)/cattle/actions";
import { toggleQuarantine } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { toast } from "sonner";
import { fmtBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  cattle: CattleRowEnriched[];
  allBreeds: string[];
  existingTagIds: string[];
  alerts: {
    unweighedCount: number;
    overdueHealthCount: number;
    highFcrCount: number;
  };
}

export function LivestockWorkspace({ cattle, allBreeds, existingTagIds, alerts }: Props) {
  const router = useRouter();

  const [selectedCattleForDeath, setSelectedCattleForDeath] = useState<CattleRowEnriched | null>(null);
  const [selectedCattleForQuarantine, setSelectedCattleForQuarantine] = useState<CattleRowEnriched | null>(null);
  const [bulkWeighOpen, setBulkWeighOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [batchOpsOpen, setBatchOpsOpen] = useState(false);
  const [activeSelectedIds, setActiveSelectedIds] = useState<string[]>([]);

  const [activeQuickFilter, setActiveQuickFilter] = useState<
    "all" | "active" | "sick" | "unweighed" | "high_gain" | "qurbani" | "sold"
  >("all");

  const metrics = useMemo(() => {
    const total = cattle.length;
    const active = cattle.filter((c) => c.status === "active");
    const activeCount = active.length;
    const soldCount = cattle.filter((c) => c.status === "sold").length;
    const quarantinedCount = cattle.filter((c) => c.is_quarantined).length;
    const qurbaniCount = cattle.filter((c) => c.is_qurbani_marked).length;

    const unweighedCount = alerts.unweighedCount;
    const overdueHealthCount = alerts.overdueHealthCount;

    const adgList = active.map((c) => c.adg).filter((a): a is number => a !== null && a > 0);
    const avgAdg = adgList.length > 0 ? adgList.reduce((s, a) => s + a, 0) / adgList.length : 0;

    const totalBiomassKg = active.reduce(
      (sum, c) => sum + (c.latestWeight ?? c.initial_weight_kg ?? 0),
      0
    );

    return {
      total,
      activeCount,
      soldCount,
      quarantinedCount,
      qurbaniCount,
      unweighedCount,
      overdueHealthCount,
      avgAdg,
      totalBiomassKg,
    };
  }, [cattle, alerts]);



  const displayedData = useMemo(() => {
    switch (activeQuickFilter) {
      case "active":
        return cattle.filter((c) => c.status === "active");
      case "sick":
        return cattle.filter((c) => c.is_quarantined || c.status === "quarantined");
      case "unweighed": {
        const sevenDaysAgo = Date.now() - 7 * 86400000;
        return cattle.filter(
          (c) => c.status === "active" && (!c.lastWeighedAt || new Date(c.lastWeighedAt).getTime() < sevenDaysAgo)
        );
      }
      case "high_gain":
        return cattle.filter((c) => c.status === "active" && c.adg !== null && c.adg >= 0.8);
      case "qurbani":
        return cattle.filter((c) => c.is_qurbani_marked);
      case "sold":
        return cattle.filter((c) => c.status === "sold");
      default:
        return cattle;
    }
  }, [cattle, activeQuickFilter]);

  const selectedCattleList = useMemo(() => {
    const set = new Set(activeSelectedIds);
    return cattle.filter((c) => set.has(c.id)).map((c) => ({ id: c.id, tag_id: c.tag_id }));
  }, [cattle, activeSelectedIds]);

  const columnsConfig: GridColumn<CattleRowEnriched>[] = useMemo(
    () => [
      {
        id: "tag_id",
        header: "Tag & Identifier",
        accessorKey: "tag_id",
        sortable: true,
        filterable: true,
        pinned: "left",
        minWidth: 160,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-mono font-bold text-xs shrink-0">
              #{row.tag_id.slice(-4)}
            </div>
            <div>
              <Link
                href={`/dashboard/cattle/${row.id}`}
                className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span>{row.tag_id}</span>
                {row.is_qurbani_marked && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10">
                    Qurbani
                  </Badge>
                )}
              </Link>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span>{row.breed || "Standard"}</span>
                <span>•</span>
                <span className="capitalize">{row.gender}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Lifecycle Status",
        accessorKey: "status",
        sortable: true,
        filterable: true,
        width: 140,
        cell: ({ row }) => {
          if (row.is_quarantined) {
            return (
              <Badge variant="destructive" className="text-[11px] gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" /> Quarantined
              </Badge>
            );
          }
          switch (row.status) {
            case "active":
              return (
                <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-semibold gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
              );
            case "sold":
              return <Badge variant="secondary" className="text-[11px] font-semibold">Sold</Badge>;
            case "dead":
              return <Badge variant="destructive" className="text-[11px] font-semibold">Deceased</Badge>;
            default:
              return <Badge variant="outline">{row.status}</Badge>;
          }
        },
      },
      {
        id: "current_weight",
        header: "Live Weight",
        accessorFn: (row) => row.latestWeight ?? row.initial_weight_kg ?? 0,
        sortable: true,
        align: "right",
        width: 130,
        cell: ({ row }) => {
          const current = row.latestWeight ?? row.initial_weight_kg;
          const gain = row.latestWeight !== null ? row.latestWeight - (row.initial_weight_kg ?? 0) : null;
          return (
            <div className="text-right">
              <div className="font-mono font-bold text-foreground">
                {current ? `${current.toFixed(1)} kg` : "—"}
              </div>
              {gain !== null && gain !== 0 && (
                <div className={cn("text-[10px] font-mono", gain > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                  {gain > 0 ? `+${gain.toFixed(1)} kg` : `${gain.toFixed(1)} kg`}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "adg",
        header: "Daily Gain (ADG)",
        accessorFn: (row) => row.adg ?? -1,
        sortable: true,
        align: "right",
        width: 130,
        cell: ({ row }) => (
          <div className="text-right">
            {row.adg !== null ? (
              <span
                className={cn(
                  "font-mono font-bold text-xs px-2 py-0.5 rounded-full inline-block",
                  row.adg >= 0.8
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : row.adg >= 0.4
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                )}
              >
                {row.adg.toFixed(2)} kg/d
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">—</span>
            )}
          </div>
        ),
      },
      {
        id: "days_in_pen",
        header: "Days on Feed",
        accessorKey: "daysInPen",
        sortable: true,
        align: "center",
        width: 110,
        cell: ({ row }) => (
          <div className="text-center font-mono text-xs text-muted-foreground">
            {row.daysInPen !== null ? `${row.daysInPen} days` : "—"}
          </div>
        ),
      },
      {
        id: "total_cost",
        header: "Total Invested",
        accessorFn: (row) => Number(row.purchase_price || 0) + (row.totalFeedCost || 0),
        sortable: true,
        align: "right",
        width: 140,
        cell: ({ row }) => {
          const total = Number(row.purchase_price || 0) + (row.totalFeedCost || 0);
          return (
            <div className="text-right">
              <div className="font-mono font-semibold text-foreground text-xs">{fmtBDT(total)}</div>
              <div className="text-[10px] text-muted-foreground">Feed: {fmtBDT(row.totalFeedCost || 0)}</div>
            </div>
          );
        },
      },
    ],
    []
  );

  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const rowActionsList: RowAction<CattleRowEnriched>[] = useMemo(
    () => [
      {
        id: "dossier",
        label: "View Dossier",
        icon: <Eye className="h-4 w-4" />,
        action: (row: CattleRowEnriched) => {
          router.push(`/dashboard/cattle/${row.id}`);
        },
      },
      {
        id: "weight",
        label: "Record Weight",
        icon: <Scale className="h-4 w-4" />,
        action: (row: CattleRowEnriched) => {
          router.push(`/dashboard/cattle/${row.id}?tab=weights`);
        },
      },
      {
        id: "health",
        label: "Health Protocol",
        icon: <HeartPulse className="h-4 w-4" />,
        action: (row: CattleRowEnriched) => {
          router.push(`/dashboard/cattle/${row.id}?tab=health`);
        },
      },
      {
        id: "quarantine",
        label: "Toggle Quarantine",
        icon: <AlertTriangle className="h-4 w-4" />,
        action: async (row: CattleRowEnriched) => {
          try {
            setPendingAction(row.id);
            const res = await toggleQuarantine(row.id, !row.is_quarantined);
            if (res?.error) {
              toast.error(res.error);
            } else {
              toast.success(row.is_quarantined ? `Cattle #${row.tag_id} released from quarantine` : `Cattle #${row.tag_id} moved to quarantine`);
              router.refresh();
            }
          } catch {
            toast.error("Failed to toggle quarantine");
          } finally {
            setPendingAction(null);
          }
        },
      },
      {
        id: "deceased",
        label: "Record Deceased",
        icon: <Trash2 className="h-4 w-4 text-destructive" />,
        danger: true,
        action: async (row: CattleRowEnriched) => {
          if (!window.confirm(`Are you sure you want to record cattle #${row.tag_id} as deceased?`)) return;
          try {
            setPendingAction(row.id);
            const res = await markAsDeceased(row.id);
            if (res?.error) {
              toast.error(res.error);
            } else {
              toast.success(`Cattle #${row.tag_id} marked as deceased`);
              router.refresh();
            }
          } catch {
            toast.error("Failed to record death");
          } finally {
            setPendingAction(null);
          }
        },
      },
    ],
    [router]
  );

  const bulkActionsList: BulkAction<CattleRowEnriched>[] = useMemo(
    () => [
      {
        id: "bulk_weigh",
        label: "Bulk Weigh",
        icon: <Scale className="h-4 w-4" />,
        action: (_rows: CattleRowEnriched[], selectedIds: string[]) => {
          setActiveSelectedIds(selectedIds);
          setBulkWeighOpen(true);
        },
      },
      {
        id: "batch_ops",
        label: "Batch Operations",
        icon: <Layers className="h-4 w-4" />,
        action: (_rows: CattleRowEnriched[], selectedIds: string[]) => {
          setActiveSelectedIds(selectedIds);
          setBatchOpsOpen(true);
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      {/* ── 1. Page Header & Quick Controls ────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <Beef className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Livestock Workspace
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {metrics.activeCount} Active
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Multi-farm herd operations, biological tracking & daily tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkImportOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            Bulk Import
          </Button>
          <CattleActionsMenu
            activeCattle={cattle.filter((c) => c.status === "active").map((c) => ({ id: c.id, tag_id: c.tag_id }))}
          />
          <AddCattleDialog existingTagIds={existingTagIds} existingBreeds={allBreeds} />
        </div>
      </div>

      {/* ── 2. Real-Time Operational KPI Dashboard ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setActiveQuickFilter("all")}
          className={cn(
            "flex flex-col p-3 rounded-2xl border text-left transition-all",
            activeQuickFilter === "all"
              ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
              : "bg-card border-border/80 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Herd</span>
            <Beef className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{metrics.total}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{metrics.activeCount} active in pens</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickFilter("active")}
          className={cn(
            "flex flex-col p-3 rounded-2xl border text-left transition-all",
            activeQuickFilter === "active"
              ? "bg-blue-500/10 border-blue-500 shadow-xs ring-1 ring-blue-500"
              : "bg-card border-border/80 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Live Biomass</span>
            <Scale className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {(metrics.totalBiomassKg / 1000).toFixed(1)} <span className="text-sm font-normal">tons</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Avg ADG: {metrics.avgAdg.toFixed(2)} kg/d</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickFilter("unweighed")}
          className={cn(
            "flex flex-col p-3 rounded-2xl border text-left transition-all",
            activeQuickFilter === "unweighed"
              ? "bg-amber-500/10 border-amber-500 shadow-xs ring-1 ring-amber-500"
              : "bg-card border-border/80 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Due Weighing</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{metrics.unweighedCount}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
            {metrics.unweighedCount > 0 ? "Action required" : "All up to date"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickFilter("sick")}
          className={cn(
            "flex flex-col p-3 rounded-2xl border text-left transition-all",
            activeQuickFilter === "sick"
              ? "bg-red-500/10 border-red-500 shadow-xs ring-1 ring-red-500"
              : "bg-card border-border/80 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Health Alerts</span>
            <HeartPulse className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{metrics.overdueHealthCount}</div>
          <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-1">
            {metrics.quarantinedCount} in quarantine
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickFilter("high_gain")}
          className={cn(
            "flex flex-col p-3 rounded-2xl border text-left transition-all",
            activeQuickFilter === "high_gain"
              ? "bg-emerald-500/10 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
              : "bg-card border-border/80 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">High Gain</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {cattle.filter((c) => c.status === "active" && c.adg !== null && c.adg >= 0.8).length}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Top gainers</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickFilter("qurbani")}
          className={cn(
            "flex flex-col p-3 rounded-2xl border text-left transition-all",
            activeQuickFilter === "qurbani"
              ? "bg-purple-500/10 border-purple-500 shadow-xs ring-1 ring-purple-500"
              : "bg-card border-border/80 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Qurbani</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{metrics.qurbaniCount}</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1">Premium stock</div>
        </button>
      </div>

      {/* ── 3. Enterprise Data Grid Workspace ───────────────────────────── */}
      <EnterpriseDataGrid
        data={displayedData}
        columns={columnsConfig}
        rowKey="id"
        title="Livestock Inventory Ledger"
        subtitle={`Showing ${displayedData.length} records matching current criteria`}
        enableGlobalSearch={true}
        searchPlaceholder="Search by ear tag, breed, status, RFID..."
        enableSelection={true}
        enableExport={true}
        enableDensitySelector={true}
        enableColumnVisibility={true}
        enableColumnPinning={true}
        enableSavedViews={true}
        savedViewsKey="livestock_grid_views_v1"
        rowActions={rowActionsList}
        bulkActions={bulkActionsList}
        onRowClick={(row) => router.push(`/dashboard/cattle/${row.id}`)}
        pageSize={25}
        pageSizeOptions={[15, 25, 50, 100]}
      />

      {/* ── 4. Dialogs for Row & Bulk Operations ────────────────────────── */}
      {bulkWeighOpen && (
        <BulkWeightDialog
          cattle={selectedCattleList.length > 0 ? selectedCattleList : cattle.filter((c) => c.status === "active").map((c) => ({ id: c.id, tag_id: c.tag_id }))}
          triggerLabel=""
          triggerVariant="outline"
        />
      )}

      <BulkLivestockImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        existingTagIds={existingTagIds}
      />

      <BatchOperationsDialog
        open={batchOpsOpen}
        onOpenChange={setBatchOpsOpen}
        selectedCattle={selectedCattleList}
      />
    </div>
  );
}
