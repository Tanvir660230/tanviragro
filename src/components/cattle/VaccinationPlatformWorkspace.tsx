"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Syringe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Calendar,
  Layers,
  ThermometerSnowflake,
  AlertOctagon,
  Search,
  Plus,
  ArrowRight,
  Filter,
  Users,
  CheckCheck,
  Building2,
  Trash2,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  VaccinationEngine,
  STANDARD_VACCINE_PROGRAMS,
  type AdministrationRoute,
  type ReactionSeverity,
  type ReactionType,
  type VaccineCode,
  type VaccineProgramRule,
} from "@/lib/livestock/vaccination-engine";
import {
  administerVaccinationAction,
  executeBatchVaccinationCampaignAction,
  recordVaccineAdverseEventAction,
} from "@/app/dashboard/(app)/cattle/vaccination-actions";
import { completeHealthEventHub, deleteHealthEventHub } from "@/app/dashboard/(app)/cattle/health/actions";

export interface CattleLite {
  id: string;
  tag_id: string;
  breed?: string | null;
  gender?: string | null;
  status?: string | null;
  initial_weight_kg?: number | null;
}

export interface VaccineInventoryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  unit_cost?: number | null;
  min_threshold?: number | null;
}

export interface HubEventItem {
  id: string;
  cattle_id: string;
  title: string;
  event_type: "vaccine" | "checkup" | "deworming" | "treatment" | "other";
  scheduled_at: string;
  notes: string | null;
  cattle: { tag_id: string; breed: string | null } | null;
}

export type WorkspaceTab = "queue" | "campaigns" | "protocols" | "inventory" | "adverse";

interface Props {
  events: HubEventItem[];
  allCattle: CattleLite[];
  inventoryItems: VaccineInventoryItem[];
  todayISO: string;
  in7ISO: string;
  stats: {
    overdue: number;
    thisWeek: number;
    completedThisMonth: number;
  };
}

export function VaccinationPlatformWorkspace({
  events,
  allCattle,
  inventoryItems,
  todayISO,
  in7ISO,
  stats,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("queue");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Dialog States
  const [administerOpen, setAdministerOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [adverseOpen, setAdverseOpen] = useState(false);
  const [selectedEventToAdminister, setSelectedEventToAdminister] = useState<HubEventItem | null>(null);

  const [isPending, startTransition] = useTransition();

  const visibleEvents = useMemo(() => {
    return events.filter((e) => !removedIds.has(e.id));
  }, [events, removedIds]);

  const overdueList = useMemo(() => visibleEvents.filter((e) => e.scheduled_at < todayISO), [visibleEvents, todayISO]);
  const todayList = useMemo(() => visibleEvents.filter((e) => e.scheduled_at === todayISO), [visibleEvents, todayISO]);
  const upcomingList = useMemo(() => visibleEvents.filter((e) => e.scheduled_at > todayISO && e.scheduled_at <= in7ISO), [visibleEvents, todayISO, in7ISO]);

  const vaccineInventory = useMemo(() => {
    return inventoryItems.filter(
      (item) =>
        item.name.toLowerCase().includes("vaccin") ||
        item.name.toLowerCase().includes("fmd") ||
        item.name.toLowerCase().includes("anthrax") ||
        item.name.toLowerCase().includes("hs") ||
        item.name.toLowerCase().includes("bq") ||
        item.name.toLowerCase().includes("vial") ||
        item.name.toLowerCase().includes("dose")
    );
  }, [inventoryItems]);

  const lowStockCount = useMemo(() => {
    return vaccineInventory.filter((i) => i.qty <= (i.min_threshold ?? 5)).length;
  }, [vaccineInventory]);

  const filteredQueue = useMemo(() => {
    let list = visibleEvents;
    if (selectedFilter === "overdue") list = overdueList;
    if (selectedFilter === "today") list = todayList;
    if (selectedFilter === "upcoming") list = upcomingList;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.cattle?.tag_id && e.cattle.tag_id.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
    );
  }, [visibleEvents, selectedFilter, overdueList, todayList, upcomingList, searchQuery]);

  function handleQuickComplete(eventId: string) {
    setRemovedIds((prev) => new Set([...prev, eventId]));
    startTransition(async () => {
      const res = await completeHealthEventHub(eventId);
      if (res?.error) {
        toast.error(res.error);
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      } else {
        toast.success("Vaccination marked as completed");
      }
    });
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setRemovedIds((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const res = await deleteHealthEventHub(id);
      if (res?.error) {
        toast.error(res.error);
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.success("Event deleted");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <Clock className="h-4 w-4 text-blue-500" />
            Due Today
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{todayList.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Scheduled for today</p>
        </div>

        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400 uppercase">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Overdue
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-red-700 dark:text-red-400">{overdueList.length}</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">Immediate attention</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <Calendar className="h-4 w-4 text-emerald-500" />
            Next 7 Days
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{upcomingList.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Upcoming protocol window</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <ThermometerSnowflake className="h-4 w-4 text-cyan-500" />
            Vaccine Stock
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {lowStockCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">{lowStockCount} Low</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">Optimal</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{vaccineInventory.length} vaccine SKUs</p>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <CheckCheck className="h-4 w-4 text-primary" />
            Completed (MTD)
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.completedThisMonth}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Recorded this month</p>
        </div>
      </div>
      {/* Workspace Action & Filter Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/80 pb-4">
        {/* Workspace Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              activeTab === "queue"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Syringe className="h-3.5 w-3.5" />
            Vaccine Queue
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary">
              {visibleEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              activeTab === "campaigns"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Herd Campaigns
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("protocols")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              activeTab === "protocols"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Protocols &amp; Schedules
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              activeTab === "inventory"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ThermometerSnowflake className="h-3.5 w-3.5" />
            Vaccine Stock
            {lowStockCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-600 font-bold">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("adverse")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              activeTab === "adverse"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Adverse Safety
          </button>
        </div>

        {/* Global Action CTAs */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdverseOpen(true)}
            className="text-xs gap-1.5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Report Reaction
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setBatchOpen(true)}
            className="text-xs gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            Batch Campaign
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSelectedEventToAdminister(null);
              setAdministerOpen(true);
            }}
            className="text-xs gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Administer Vaccine
          </Button>
        </div>
      </div>


      {/* TAB 1: WORK QUEUE & SCHEDULED DOSES */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: "All Active", count: visibleEvents.length },
                  { id: "overdue", label: "Overdue", count: overdueList.length },
                  { id: "today", label: "Due Today", count: todayList.length },
                  { id: "upcoming", label: "Upcoming (7d)", count: upcomingList.length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFilter(tab.id)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-lg border transition-colors",
                    selectedFilter === tab.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tag, vaccine, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-semibold text-foreground">No vaccination events in queue</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All scheduled immunizations are up to date or match your filter.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
              <div className="divide-y divide-border/60">
                {filteredQueue.map((item) => {
                  const isOverdue = item.scheduled_at < todayISO;
                  const isToday = item.scheduled_at === todayISO;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 transition-colors hover:bg-muted/30",
                        isOverdue && "bg-red-50/30 dark:bg-red-950/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "rounded-xl p-2.5 shrink-0 mt-0.5",
                            isOverdue
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : isToday
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Syringe className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/dashboard/cattle/${item.cattle_id}`}
                              className="font-bold text-sm text-foreground hover:underline"
                            >
                              #{item.cattle?.tag_id ?? "Unknown"}
                            </Link>
                            {item.cattle?.breed && (
                              <span className="text-xs text-muted-foreground">({item.cattle.breed})</span>
                            )}
                            <Badge
                              variant={isOverdue ? "destructive" : isToday ? "default" : "secondary"}
                              className="text-[10px] px-2 py-0.5"
                            >
                              {isOverdue ? "Overdue" : isToday ? "Due Today" : "Scheduled"}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          {item.notes && <p className="text-xs text-muted-foreground line-clamp-1">{item.notes}</p>}
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Scheduled: {item.scheduled_at}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEventToAdminister(item);
                            setAdministerOpen(true);
                          }}
                          className="text-xs h-8 gap-1.5"
                        >
                          <Syringe className="h-3.5 w-3.5 text-blue-600" />
                          Administer (Full)
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleQuickComplete(item.id)}
                          disabled={isPending}
                          className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Done
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDeleteId(item.id)}
                          className="text-xs h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* TAB 2: HERD CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Active Herd Immunization Campaigns</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Coordinate mass vaccinations across pens and lots with batch tracking.
                </p>
              </div>
              <Button size="sm" onClick={() => setBatchOpen(true)} className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Launch Campaign
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">FMD Bi-Annual Herd Protection</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    In Progress
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Target: All fattening &amp; breeding stock</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span>
                    <span>{Math.round(((stats.completedThisMonth || 1) / Math.max(1, allCattle.length)) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(((stats.completedThisMonth || 1) / Math.max(1, allCattle.length)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">Anthrax Spore Prophylaxis</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                    Scheduled
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Target: 24+ weeks mature bulls</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Readiness</span>
                    <span>100% Stock Ready</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STANDARD PROTOCOLS & SCHEDULES */}
      {activeTab === "protocols" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="font-bold text-sm text-foreground">Standard DLS &amp; Veterinary Vaccine Protocols</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official Department of Livestock Services (Bangladesh) and international livestock immunization guidelines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {STANDARD_VACCINE_PROGRAMS.map((prog) => (
                <div
                  key={prog.id}
                  className="rounded-xl border border-border/80 bg-background p-4 space-y-2 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-foreground">{prog.vaccineName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {prog.route} · {prog.defaultDoseMl}ml
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{prog.description}</p>
                  <div className="pt-2 border-t border-border/60 text-[11px] space-y-1 text-muted-foreground font-mono">
                    <div>Repeat: Every {prog.repeatIntervalDays} days</div>
                    {prog.boosterIntervalDays && <div>Booster: {prog.boosterIntervalDays} days post 1st dose</div>}
                    <div>Cold Chain: {prog.coldChainTempC ?? "2°C – 8°C"}</div>
                    <div>Withdrawal: {prog.withdrawalDays > 0 ? `${prog.withdrawalDays} days` : "0 days"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VACCINE INVENTORY & COLD CHAIN */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Vaccine Inventory &amp; Cold Chain Storage</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time stock depletion and automatic FIFO consumption ledger.
                </p>
              </div>
              <Link href="/dashboard/inventory" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs gap-1.5")}>
                <Building2 className="h-3.5 w-3.5" />
                Manage Inventory
              </Link>
            </div>

            {vaccineInventory.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                No vaccine items identified in inventory catalog. Add vaccine items in the Inventory section.
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/70 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-3">Vaccine Item</th>
                      <th className="p-3">Current Stock</th>
                      <th className="p-3">Unit Cost</th>
                      <th className="p-3">Safety Reserve</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {vaccineInventory.map((item) => {
                      const isDepleted = item.qty <= 0;
                      const isLow = item.qty <= (item.min_threshold ?? 5);

                      return (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="p-3 font-semibold text-foreground">{item.name}</td>
                          <td className="p-3 font-mono font-bold">
                            {item.qty} {item.unit}
                          </td>
                          <td className="p-3 font-mono">
                            {item.unit_cost ? `BDT ${item.unit_cost}` : "—"}
                          </td>
                          <td className="p-3 text-muted-foreground">{item.min_threshold ?? 5} {item.unit}</td>
                          <td className="p-3">
                            {isDepleted ? (
                              <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                            ) : isLow ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                In Stock
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ADVERSE REACTION REGISTER */}
      {activeTab === "adverse" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Adverse Event Clinical Safety Register</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Post-vaccination surveillance, anaphylaxis response, and veterinary follow-ups.
                </p>
              </div>
              <Button size="sm" onClick={() => setAdverseOpen(true)} className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                <AlertOctagon className="h-3.5 w-3.5" />
                Report Incident
              </Button>
            </div>

            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Emergency Clinical Protocol for Anaphylaxis
              </div>
              <p>
                In the event of acute anaphylactic shock post-vaccination: Administer Epinephrine (1:1000) 1ml per 100kg SC/IM immediately, followed by Dexamethasone or Antihistamine (Pheniramine maleate). Isolate animal in quarantine pen and monitor heart rate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ADMINISTER VACCINE DIALOG */}
      <AdministerVaccineDialog
        open={administerOpen}
        onOpenChange={setAdministerOpen}
        allCattle={allCattle}
        inventoryItems={vaccineInventory}
        initialEvent={selectedEventToAdminister}
        todayISO={todayISO}
        onSuccess={() => {
          setAdministerOpen(false);
          router.refresh();
        }}
      />

      {/* BATCH CAMPAIGN DIALOG */}
      <BatchCampaignDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        allCattle={allCattle}
        inventoryItems={vaccineInventory}
        todayISO={todayISO}
        onSuccess={() => {
          setBatchOpen(false);
          router.refresh();
        }}
      />

      {/* RECORD ADVERSE EVENT DIALOG */}
      <RecordAdverseEventDialog
        open={adverseOpen}
        onOpenChange={setAdverseOpen}
        allCattle={allCattle}
        todayISO={todayISO}
        onSuccess={() => {
          setAdverseOpen(false);
          router.refresh();
        }}
      />

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        onCancel={() => setPendingDeleteId(null)}
        title="Delete Vaccination Event"
        description="Are you sure you want to delete this scheduled vaccination event? This action will remove it from the health calendar."
        confirmLabel="Delete Event"
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}


function AdministerVaccineDialog({
  open,
  onOpenChange,
  allCattle,
  inventoryItems,
  initialEvent,
  todayISO,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCattle: CattleLite[];
  inventoryItems: VaccineInventoryItem[];
  initialEvent: HubEventItem | null;
  todayISO: string;
  onSuccess: () => void;
}) {
  const [cattleId, setCattleId] = useState(initialEvent?.cattle_id || allCattle[0]?.id || "");
  const [vaccineItemId, setVaccineItemId] = useState(inventoryItems[0]?.id || "");
  const [vaccineName, setVaccineName] = useState(initialEvent?.title || "Foot & Mouth Disease (FMD)");
  const [batchNumber, setBatchNumber] = useState("");
  const [doseAdministeredMl, setDoseAdministeredMl] = useState(2.0);
  const [route, setRoute] = useState<AdministrationRoute>("SC");
  const [administeredBy, setAdministeredBy] = useState("Veterinary Health Officer");
  const [administeredAt, setAdministeredAt] = useState(todayISO);
  const [scheduleBooster, setScheduleBooster] = useState(true);
  const [boosterDays, setBoosterDays] = useState(28);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCattle = allCattle.find((c) => c.id === cattleId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cattleId) {
      toast.error("Please select an animal");
      return;
    }
    if (!vaccineName.trim()) {
      toast.error("Please specify a vaccine name");
      return;
    }

    setLoading(true);
    try {
      const res = await administerVaccinationAction({
        cattleId,
        cattleTag: selectedCattle?.tag_id || "Unknown",
        vaccineItemId: vaccineItemId || null,
        vaccineName,
        batchNumber: batchNumber.trim() || undefined,
        doseAdministeredMl: Number(doseAdministeredMl) || 2.0,
        route,
        administeredBy,
        administeredAt,
        scheduleBooster,
        boosterDays: Number(boosterDays) || 28,
        notes: notes.trim() || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Vaccination administered and logged successfully!");
        onSuccess();
      }
    } catch {
      toast.error("Failed to administer vaccine");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Syringe className="h-5 w-5 text-blue-600" />
              Administer Vaccine
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record clinical administration, deduct cold-chain inventory stock, and auto-schedule secondary boosters.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Select Livestock (Tag ID)</label>
              <select
                value={cattleId}
                onChange={(e) => setCattleId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                {allCattle.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.tag_id} {c.breed ? `(${c.breed})` : ""} {c.status ? `· ${c.status}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Vaccine / Protocol</label>
                <Input
                  value={vaccineName}
                  onChange={(e) => setVaccineName(e.target.value)}
                  placeholder="e.g. FMD trivalent"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Inventory Link (FIFO Depletion)</label>
                <select
                  value={vaccineItemId}
                  onChange={(e) => setVaccineItemId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No inventory linkage</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.qty} {item.unit} available)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Batch # / Lot</label>
                <Input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. B-9021"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Dose (ml)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={doseAdministeredMl}
                  onChange={(e) => setDoseAdministeredMl(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Route</label>
                <select
                  value={route}
                  onChange={(e) => setRoute(e.target.value as AdministrationRoute)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="SC">Subcutaneous (SC)</option>
                  <option value="IM">Intramuscular (IM)</option>
                  <option value="Oral">Oral</option>
                  <option value="IV">Intravenous (IV)</option>
                  <option value="Intranasal">Intranasal</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Administered By (Vet/Staff)</label>
                <Input
                  value={administeredBy}
                  onChange={(e) => setAdministeredBy(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Date Administered</label>
                <Input
                  type="date"
                  value={administeredAt}
                  onChange={(e) => setAdministeredAt(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleBooster}
                    onChange={(e) => setScheduleBooster(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  Auto-schedule Secondary Booster Dose
                </label>
                {scheduleBooster && (
                  <Badge variant="outline" className="text-[10px] text-blue-600">
                    +{boosterDays} Days
                  </Badge>
                )}
              </div>

              {scheduleBooster && (
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="text-muted-foreground">Booster interval:</span>
                  <Input
                    type="number"
                    value={boosterDays}
                    onChange={(e) => setBoosterDays(parseInt(e.target.value) || 28)}
                    className="h-7 w-20 text-xs"
                  />
                  <span className="text-muted-foreground">days</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Clinical Observation Notes</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional veterinary observations, site reactions, etc."
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <Syringe className="h-3.5 w-3.5" />
              {loading ? "Recording..." : "Record Administration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BatchCampaignDialog({
  open,
  onOpenChange,
  allCattle,
  inventoryItems,
  todayISO,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCattle: CattleLite[];
  inventoryItems: VaccineInventoryItem[];
  todayISO: string;
  onSuccess: () => void;
}) {
  const [campaignName, setCampaignName] = useState("Herd Wide FMD Mass Campaign");
  const [vaccineItemId, setVaccineItemId] = useState(inventoryItems[0]?.id || "");
  const [vaccineName, setVaccineName] = useState("Foot & Mouth Disease (FMD)");
  const [batchNumber, setBatchNumber] = useState("");
  const [dosePerAnimalMl, setDosePerAnimalMl] = useState(2.0);
  const [route, setRoute] = useState<AdministrationRoute>("SC");
  const [selectedCattleIds, setSelectedCattleIds] = useState<string[]>(allCattle.map((c) => c.id));
  const [loading, setLoading] = useState(false);

  const toggleCattle = (id: string) => {
    setSelectedCattleIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedCattleIds(allCattle.map((c) => c.id));
  const deselectAll = () => setSelectedCattleIds([]);

  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedCattleIds.length === 0) {
      toast.error("Please select at least one animal for this campaign");
      return;
    }
    if (!vaccineName.trim()) {
      toast.error("Please specify a vaccine name");
      return;
    }

    setLoading(true);
    try {
      const res = await executeBatchVaccinationCampaignAction({
        cattleIds: selectedCattleIds,
        vaccineItemId: vaccineItemId || null,
        vaccineName,
        batchNumber: batchNumber.trim() || undefined,
        doseAdministeredMl: Number(dosePerAnimalMl) || 2.0,
        route,
        administeredBy: "Mass Herd Vaccination Team",
        administeredAt: todayISO,
        scheduleBooster: false,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Successfully vaccinated ${res.affectedCattleCount} head of cattle!`);
        onSuccess();
      }
    } catch {
      toast.error("Failed to execute batch campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleBatchSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Launch Mass Herd Vaccination Campaign
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Campaign Title</label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Vaccine Protocol</label>
                <Input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Inventory</label>
                <select
                  value={vaccineItemId}
                  onChange={(e) => setVaccineItemId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">No deduction</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.qty} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Dose (ml)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={dosePerAnimalMl}
                  onChange={(e) => setDosePerAnimalMl(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Route</label>
                <select
                  value={route}
                  onChange={(e) => setRoute(e.target.value as AdministrationRoute)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="SC">Subcutaneous (SC)</option>
                  <option value="IM">Intramuscular (IM)</option>
                  <option value="Oral">Oral</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold">Target Animals ({selectedCattleIds.length} Selected)</label>
                <div className="flex gap-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-6 text-[11px]">
                    All ({allCattle.length})
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={deselectAll} className="h-6 text-[11px] text-muted-foreground">
                    Clear
                  </Button>
                </div>
              </div>

              <div className="max-h-36 overflow-y-auto rounded-lg border p-2 grid grid-cols-3 gap-1.5 bg-muted/20">
                {allCattle.map((c) => {
                  const isChecked = selectedCattleIds.includes(c.id);
                  return (
                    <label key={c.id} className={cn("flex items-center gap-1.5 p-1.5 rounded border text-xs cursor-pointer", isChecked ? "bg-primary/10 border-primary/40 font-semibold" : "bg-background")}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleCattle(c.id)} className="rounded" />
                      <span className="truncate">#{c.tag_id}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading || selectedCattleIds.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? "Executing..." : `Execute for ${selectedCattleIds.length} Animals`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordAdverseEventDialog({
  open,
  onOpenChange,
  allCattle,
  todayISO,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCattle: CattleLite[];
  todayISO: string;
  onSuccess: () => void;
}) {
  const [cattleId, setCattleId] = useState(allCattle[0]?.id || "");
  const [vaccineName, setVaccineName] = useState("FMD Trivalent");
  const [reactionType, setReactionType] = useState<ReactionType>("local_swelling");
  const [severity, setSeverity] = useState<ReactionSeverity>("moderate");
  const [symptoms, setSymptoms] = useState("");
  const [treatmentAdministered, setTreatmentAdministered] = useState("Administered Antihistamine and isolated.");
  const [requiresQuarantine, setRequiresQuarantine] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCattle = allCattle.find((c) => c.id === cattleId);

  async function handleAdverseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cattleId || !symptoms.trim()) {
      toast.error("Please enter cattle and symptoms description");
      return;
    }

    setLoading(true);
    try {
      const res = await recordVaccineAdverseEventAction({
        cattleId,
        cattleTag: selectedCattle?.tag_id || "Unknown",
        vaccineName,
        reactionType,
        severity,
        symptoms: symptoms.trim(),
        treatmentAdministered: treatmentAdministered.trim() || undefined,
        requiresQuarantine,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Adverse clinical event recorded to cattle timeline");
        onSuccess();
      }
    } catch {
      toast.error("Failed to record adverse event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleAdverseSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertOctagon className="h-5 w-5 text-amber-600" />
              Report Adverse Post-Vaccination Event
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Livestock Tag</label>
              <select
                value={cattleId}
                onChange={(e) => setCattleId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                required
              >
                {allCattle.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.tag_id} {c.breed ? `(${c.breed})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Vaccine Administered</label>
                <Input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as ReactionSeverity)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="mild">Mild (Local swelling)</option>
                  <option value="moderate">Moderate (Fever / Lethargy)</option>
                  <option value="severe">Severe (Anaphylaxis / Tremor)</option>
                  <option value="critical">Critical / Shock</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Symptoms &amp; Observations</label>
              <Input
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Swelling at injection site, elevated rectal temperature"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Emergency Treatment Administered</label>
              <Input
                value={treatmentAdministered}
                onChange={(e) => setTreatmentAdministered(e.target.value)}
                placeholder="e.g. Epinephrine 1ml SC, Dexamethasone"
              />
            </div>

            <label className="font-semibold flex items-center gap-1.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={requiresQuarantine}
                onChange={(e) => setRequiresQuarantine(e.target.checked)}
                className="rounded"
              />
              Flag Livestock for Immediate Quarantine Pen Isolation
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {loading ? "Recording..." : "Record Safety Incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


