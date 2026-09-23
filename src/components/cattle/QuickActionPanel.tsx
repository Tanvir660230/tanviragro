"use client";

import React, { useState } from "react";
import {
  Scale,
  HeartPulse,
  Syringe,
  Pill,
  Utensils,
  Receipt,
  ShoppingCart,
  QrCode,
  Printer,
  FileSpreadsheet,
  AlertOctagon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickWeightDialog } from "@/components/cattle/QuickWeightDialog";
import { RecordSaleDialog } from "@/components/cattle/RecordSaleDialog";
import { BulkCostDialog } from "@/components/cattle/BulkCostDialog";
import { BulkHealthEventDialog } from "@/components/cattle/BulkHealthEventDialog";
import type { Cattle } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";

interface QuickActionPanelProps {
  cattle: Cattle;
  latestWeight: number;
}

export function QuickActionPanel({ cattle: c, latestWeight }: QuickActionPanelProps) {
  const { t } = useTranslation();
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);

  const activeOption = [{ id: c.id, tag_id: c.tag_id }];

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none py-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Quick Actions:
        </span>

        {/* Quick Log Weight */}
        <QuickWeightDialog cattleId={c.id} tagId={c.tag_id} />

        {/* Quick Health / Vaccination Entry */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHealthDialogOpen(true)}
          className="h-8 text-xs font-semibold shrink-0 gap-1.5 rounded-lg border-border bg-background/80 shadow-2xs"
        >
          <HeartPulse className="h-3.5 w-3.5 text-blue-500" />
          Log Health / Vaccine
        </Button>

        {/* Quick Cost / Expense Entry */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCostDialogOpen(true)}
          className="h-8 text-xs font-semibold shrink-0 gap-1.5 rounded-lg border-border bg-background/80 shadow-2xs"
        >
          <Receipt className="h-3.5 w-3.5 text-amber-500" />
          Log Direct Expense
        </Button>

        {/* Record Sale (if active) */}
        {c.status === "active" && (
          <RecordSaleDialog cattleId={c.id} currentWeight={latestWeight} />
        )}
      </div>

      {/* Embedded Single-Target Bulk Dialogs */}
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