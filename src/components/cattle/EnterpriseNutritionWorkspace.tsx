"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Layers,
  Trash2,
  Utensils,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  nutritionEngine,
  type CattleNutritionState,
  type FeedNutrientProfile,
  type FeedSession,
  type FeedConsumptionRecord,
  type FeedingSlot,
} from "@/lib/nutrition/nutrition-engine";
import {
  executeFeedingSessionAction,
  quickDispenseFeedAction,
  recordFeedWasteAction,
  type FeedSessionExecutionPayload,
} from "@/app/dashboard/(app)/cattle/feed-actions";
import { Button } from "@/components/ui/button";
import { WorkspaceKpis } from "./nutrition/WorkspaceKpis";
import { TodayFeedingTab } from "./nutrition/TodayFeedingTab";
import { PlansTab } from "./nutrition/PlansTab";
import { InventoryTab } from "./nutrition/InventoryTab";
import { AnalyticsTab } from "./nutrition/AnalyticsTab";
import { AlertsTab } from "./nutrition/AlertsTab";
import { ExecuteSessionDialog } from "./nutrition/ExecuteSessionDialog";
import { QuickDispenseDialog } from "./nutrition/QuickDispenseDialog";
import { WasteLogDialog } from "./nutrition/WasteLogDialog";
import { RationBalancerDialog } from "./nutrition/RationBalancerDialog";

export interface WorkspaceCattleItem extends CattleNutritionState {
  penName?: string;
  groupName?: string;
}

interface Props {
  cattle: WorkspaceCattleItem[];
  inventoryItems: FeedNutrientProfile[];
  initialSessions?: FeedSession[];
  initialConsumptionHistory?: FeedConsumptionRecord[];
  todayISO: string;
}

export function EnterpriseNutritionWorkspace({
  cattle,
  inventoryItems,
  initialSessions = [],
  initialConsumptionHistory = [],
  todayISO,
}: Props) {
  const [activeTab, setActiveTab] = useState<"today" | "plans" | "inventory" | "analytics" | "alerts">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<FeedingSlot>("morning");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [quickDispenseOpen, setQuickDispenseOpen] = useState(false);
  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [rationModalOpen, setRationModalOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [selectedFeedItemId, setSelectedFeedItemId] = useState<string>(
    inventoryItems[0]?.id || ""
  );
  const [feederOperator, setFeederOperator] = useState("Lead Feeder");
  const [dispenseOverrides, setDispenseOverrides] = useState<Record<string, { dispensed: number; waste: number }>>({});

  const [qdFeedId, setQdFeedId] = useState<string>(inventoryItems[0]?.id || "");
  const [qdKgPerHead, setQdKgPerHead] = useState<number>(2.5);
  const [qdSlot, setQdSlot] = useState<FeedingSlot>("morning");

  const [wasteItemId, setWasteItemId] = useState<string>(inventoryItems[0]?.id || "");
  const [wasteKg, setWasteKg] = useState<number>(5);
  const [wasteReason, setWasteReason] = useState<"orts_refusal" | "trough_spillage" | "spoilage" | "weather_damage">("orts_refusal");
  const [wasteCattleId, setWasteCattleId] = useState<string>("");
  const [wasteNotes, setWasteNotes] = useState<string>("");

  const herdSummary = useMemo(() => {
    return nutritionEngine.calculateHerdSummary(cattle, 42.0, 8.5);
  }, [cattle]);

  const animalRequirements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof nutritionEngine.calculateAnimalRequirement>>();
    for (const c of cattle) {
      map.set(c.id, nutritionEngine.calculateAnimalRequirement(c, 42.0, 8.5));
    }
    return map;
  }, [cattle]);

  const alerts = useMemo(() => {
    return nutritionEngine.evaluateAlerts(inventoryItems, initialSessions, initialConsumptionHistory, todayISO);
  }, [inventoryItems, initialSessions, initialConsumptionHistory, todayISO]);

  const aiRecs = useMemo(() => {
    return nutritionEngine.generateAiRecommendations(herdSummary, inventoryItems);
  }, [herdSummary, inventoryItems]);

  const filteredCattle = useMemo(() => {
    if (!searchQuery.trim()) return cattle;
    const q = searchQuery.toLowerCase();
    return cattle.filter(
      (c) =>
        c.tagId.toLowerCase().includes(q) ||
        (c.breed && c.breed.toLowerCase().includes(q)) ||
        (c.penName && c.penName.toLowerCase().includes(q))
    );
  }, [cattle, searchQuery]);

  async function handleExecuteSession() {
    try {
      setExecuting(true);
      setStatusMsg(null);

      const chosenFeed = inventoryItems.find((i) => i.id === selectedFeedItemId);
      if (!chosenFeed) {
        setStatusMsg({ text: "Please select a valid feed item", error: true });
        setExecuting(false);
        return;
      }

      const cattleAllocations = cattle.map((c) => {
        const req = animalRequirements.get(c.id);
        const targetKg = req?.targetConcentrateKg || 2.0;
        const override = dispenseOverrides[c.id];
        const actualKg = override?.dispensed !== undefined ? override.dispensed : targetKg;
        const wasteKgVal = override?.waste !== undefined ? override.waste : 0;
        return {
          cattleId: c.id,
          tagId: c.tagId,
          targetAsFedKg: targetKg,
          actualDispensedKg: actualKg,
          wasteKg: wasteKgVal,
        };
      });

      const payload: FeedSessionExecutionPayload = {
        dateISO: todayISO,
        slot: selectedSlot,
        scheduledTime: selectedSlot === "morning" ? "07:00" : selectedSlot === "noon" ? "12:30" : selectedSlot === "evening" ? "17:30" : "21:00",
        targetGroupOrPen: "Entire Herd",
        feederOperator,
        feedItemId: chosenFeed.id,
        feedItemName: chosenFeed.name,
        unitCostBdt: chosenFeed.costPerKgAsFed,
        cattleAllocations,
      };

      const res = await executeFeedingSessionAction(payload);
      if (res.error) {
        setStatusMsg({ text: res.error, error: true });
      } else {
        setStatusMsg({
          text: `Feeding session recorded successfully! Dispensed ${res.totalKgDispensed} kg (Total: ৳${res.totalCostBdt})`,
        });
        setSessionModalOpen(false);
      }
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Failed to record feeding session",
        error: true,
      });
    } finally {
      setExecuting(false);
    }
  }

  async function handleQuickDispense() {
    try {
      setExecuting(true);
      setStatusMsg(null);
      const activeIds = cattle.map((c) => c.id);
      const res = await quickDispenseFeedAction(
        activeIds,
        qdFeedId,
        qdKgPerHead,
        qdSlot,
        todayISO,
        feederOperator
      );
      if (res.error) {
        setStatusMsg({ text: res.error, error: true });
      } else {
        setStatusMsg({
          text: `Quick feed logged! Dispensed ${res.totalKgDispensed} kg across ${res.recordsCount} head.`,
        });
        setQuickDispenseOpen(false);
      }
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Quick dispense failed",
        error: true,
      });
    } finally {
      setExecuting(false);
    }
  }

  async function handleRecordWaste() {
    try {
      setExecuting(true);
      setStatusMsg(null);
      const res = await recordFeedWasteAction(
        wasteCattleId || null,
        wasteItemId,
        wasteKg,
        wasteReason,
        todayISO,
        wasteNotes
      );
      if (res.error) {
        setStatusMsg({ text: res.error, error: true });
      } else {
        setStatusMsg({
          text: `Recorded ${res.totalWasteKg} kg of feed refusal/waste for inventory adjustment.`,
        });
        setWasteModalOpen(false);
      }
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Waste recording failed",
        error: true,
      });
    } finally {
      setExecuting(false);
    }
  }
  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={cn(
            "p-4 rounded-xl flex items-center justify-between text-sm font-medium animate-fade-in",
            statusMsg.error
              ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
          )}
        >
          <div className="flex items-center gap-2">
            {statusMsg.error ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      <WorkspaceKpis
        herdSummary={herdSummary}
        inventoryItems={inventoryItems}
        alerts={alerts}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/60 overflow-x-auto max-w-full">
          {[
            { id: "today", label: "Today's Feeding", icon: Utensils },
            { id: "plans", label: "Nutrition Plans & Balancer", icon: Sparkles },
            { id: "inventory", label: "Feed Stock & Batches", icon: Layers },
            { id: "analytics", label: "FCR & Analytics", icon: BarChart3 },
            { id: "alerts", label: `Alerts (${alerts.length})`, icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9 gap-1.5 border-dashed"
            onClick={() => setWasteModalOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            <span>Log Waste / Orts</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9 gap-1.5"
            onClick={() => setQuickDispenseOpen(true)}
          >
            <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
            <span>Quick Dispense</span>
          </Button>

          <Button
            size="sm"
            className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={() => setSessionModalOpen(true)}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Feeding Session</span>
          </Button>
        </div>
      </div>

      {activeTab === "today" && (
        <TodayFeedingTab
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          filteredCattle={filteredCattle}
          animalRequirements={animalRequirements}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {activeTab === "plans" && (
        <PlansTab
          aiRecs={aiRecs}
          onOpenBalancer={() => setRationModalOpen(true)}
        />
      )}

      {activeTab === "inventory" && (
        <InventoryTab inventoryItems={inventoryItems} />
      )}

      {activeTab === "analytics" && (
        <AnalyticsTab herdSummary={herdSummary} />
      )}

      <ExecuteSessionDialog
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        selectedSlot={selectedSlot}
        inventoryItems={inventoryItems}
        selectedFeedItemId={selectedFeedItemId}
        onSelectFeedItem={setSelectedFeedItemId}
        feederOperator={feederOperator}
        onFeederOperatorChange={setFeederOperator}
        cattle={cattle}
        animalRequirements={animalRequirements}
        dispenseOverrides={dispenseOverrides}
        onOverrideChange={(cid, val) =>
          setDispenseOverrides((prev) => ({
            ...prev,
            [cid]: { dispensed: val, waste: prev[cid]?.waste || 0 },
          }))
        }
        onExecute={handleExecuteSession}
        executing={executing}
      />

      <QuickDispenseDialog
        open={quickDispenseOpen}
        onOpenChange={setQuickDispenseOpen}
        inventoryItems={inventoryItems}
        qdFeedId={qdFeedId}
        onQdFeedChange={setQdFeedId}
        qdKgPerHead={qdKgPerHead}
        onQdKgChange={setQdKgPerHead}
        qdSlot={qdSlot}
        onQdSlotChange={setQdSlot}
        onDispense={handleQuickDispense}
        executing={executing}
      />

      <WasteLogDialog
        open={wasteModalOpen}
        onOpenChange={setWasteModalOpen}
        inventoryItems={inventoryItems}
        wasteItemId={wasteItemId}
        onWasteItemChange={setWasteItemId}
        wasteKg={wasteKg}
        onWasteKgChange={setWasteKg}
        wasteReason={wasteReason}
        onWasteReasonChange={setWasteReason}
        wasteNotes={wasteNotes}
        onWasteNotesChange={setWasteNotes}
        onRecord={handleRecordWaste}
        executing={executing}
      />

      <RationBalancerDialog
        open={rationModalOpen}
        onOpenChange={setRationModalOpen}
      />
    </div>
  );
}

