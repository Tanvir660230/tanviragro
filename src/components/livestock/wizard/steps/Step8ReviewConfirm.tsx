"use client";

import type { AnimalWizardState } from "@/lib/validation/cattle-wizard";
import { calculateAnimalAge } from "@/lib/validation/cattle-wizard";
import { CheckCircle2, AlertTriangle, ShieldCheck, DollarSign, Beef, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  state: AnimalWizardState;
  errors: Record<string, string>;
}

export function Step8ReviewConfirm({ state, errors }: Props) {
  const age = calculateAnimalAge(state.identification.dob);
  const totalFinancial =
    (state.origin.purchasePrice || 0) +
    (state.financial.transportCost || 0) +
    (state.financial.haatHasil || 0);

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="space-y-4">
      {hasErrors ? (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Please correct the required fields in previous steps before saving.</span>
        </div>
      ) : (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>All required livestock specifications and financial details are validated.</span>
        </div>
      )}

      {/* Visual Dossier Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Identification Summary */}
        <div className="p-3 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-center justify-between border-b pb-1.5 font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Beef className="h-3.5 w-3.5 text-primary" />
              Identification
            </span>
            <Badge variant="outline" className="text-[10px]">
              {state.identification.species.toUpperCase()}
            </Badge>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <p><strong className="text-foreground">Tag ID:</strong> {state.identification.tagId || "—"}</p>
            <p><strong className="text-foreground">Name:</strong> {state.identification.name || "—"}</p>
            <p><strong className="text-foreground">Breed:</strong> {state.identification.breed}</p>
            <p><strong className="text-foreground">Gender:</strong> {state.identification.gender}</p>
            <p><strong className="text-foreground">Age:</strong> {age.display}</p>
          </div>
        </div>

        {/* Farm & Category Summary */}
        <div className="p-3 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-center justify-between border-b pb-1.5 font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
              Location & Purpose
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {state.categoryStage.category}
            </Badge>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <p><strong className="text-foreground">Farm:</strong> {state.farmLocation.farmId || "Default Farm"}</p>
            <p><strong className="text-foreground">Pen / Shed:</strong> {state.farmLocation.penId || "Unassigned"}</p>
            <p><strong className="text-foreground">Target Weight:</strong> {state.categoryStage.targetWeightKg ? `${state.categoryStage.targetWeightKg} kg` : "—"}</p>
            <p><strong className="text-foreground">Expected ADG:</strong> {state.categoryStage.expectedDailyGainKg ? `${state.categoryStage.expectedDailyGainKg} kg/d` : "—"}</p>
            <p><strong className="text-foreground">Health Status:</strong> {state.health.status} {state.health.isQuarantined ? "(Quarantined)" : ""}</p>
          </div>
        </div>

        {/* Acquisition & Financial Summary */}
        <div className="p-3 rounded-lg border border-border bg-card space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between border-b pb-1.5 font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              Acquisition & Financial Footprint
            </span>
            <span className="font-bold text-foreground text-sm">৳ {totalFinancial.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-muted-foreground">
            <div>
              <span className="block text-[10px] uppercase font-semibold">Origin</span>
              <span className="text-foreground font-medium">{state.origin.originType}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold">Base Price</span>
              <span className="text-foreground font-medium">৳ {state.origin.purchasePrice.toLocaleString()}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold">Live Weight</span>
              <span className="text-foreground font-medium">{state.origin.initialWeightKg} kg</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold">Incidental Fees</span>
              <span className="text-foreground font-medium">৳ {((state.financial.transportCost || 0) + (state.financial.haatHasil || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
