"use client";

import React, { useState } from "react";
import {
  Scale,
  HeartPulse,
  Syringe,
  Receipt,
  Utensils,
  Share2,
  Printer,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickWeightDialog } from "@/components/cattle/QuickWeightDialog";
import { RecordSaleDialog } from "@/components/cattle/RecordSaleDialog";
import { BulkCostDialog } from "@/components/cattle/BulkCostDialog";
import { BulkHealthEventDialog } from "@/components/cattle/BulkHealthEventDialog";
import type { Cattle } from "@/types/database";

interface StickyActionPanelProps {
  cattle: Cattle;
  latestWeight: number;
  onNavigateTab: (tabId: string) => void;
}

export function StickyActionPanel({
  cattle: c,
  latestWeight,
  onNavigateTab,
}: StickyActionPanelProps) {
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const activeOption = [{ id: c.id, tag_id: c.tag_id }];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/80 p-2 sm:p-3 shadow-lg flex items-center justify-between gap-3 px-4 max-w-7xl mx-auto rounded-t-2xl sm:bottom-3 sm:rounded-2xl sm:border sm:left-4 sm:right-4">
        {/* Left summary info */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono font-black text-sm sm:text-base truncate">
            #{c.tag_id}
          </span>
          <span className="hidden sm:inline-block text-xs text-muted-foreground">
            • {latestWeight.toFixed(1)} kg
          </span>
          <span className="hidden md:inline-block text-xs text-muted-foreground">
            • {c.breed ?? "Local"}
          </span>
        </div>

        {/* Right direct quick action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <QuickWeightDialog cattleId={c.id} tagId={c.tag_id} />

          <Button
            size="sm"
            variant="outline"
            onClick={() => setHealthDialogOpen(true)}
            className="h-8 text-xs font-semibold shrink-0 gap-1 rounded-lg"
          >
            <HeartPulse className="h-3.5 w-3.5 text-blue-500" />
            <span className="hidden sm:inline">Log</span> Health
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setCostDialogOpen(true)}
            className="h-8 text-xs font-semibold shrink-0 gap-1 rounded-lg"
          >
            <Receipt className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Log</span> Expense
          </Button>

          {c.status === "active" && (
            <RecordSaleDialog cattleId={c.id} currentWeight={latestWeight} />
          )}
        </div>
      </div>

      <BulkCostDialog
        activeCattle={activeOption}
        initialSelectedIds={[c.id]}
        open={costDialogOpen}
        onOpenChange={setCostDialogOpen}
      />

      <BulkHealthEventDialog
        activeCattle={activeOption}
        initialSelectedIds={[c.id]}
        open={healthDialogOpen}
        onOpenChange={setHealthDialogOpen}
      />
    </>
  );
}