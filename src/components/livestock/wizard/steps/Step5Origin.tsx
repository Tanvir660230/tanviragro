"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnimalWizardOrigin } from "@/lib/validation/cattle-wizard";
import { ShoppingCart, Baby, DollarSign, Weight } from "lucide-react";

interface Props {
  data: AnimalWizardOrigin;
  onChange: (data: Partial<AnimalWizardOrigin>) => void;
  errors: Record<string, string>;
}

export function Step5Origin({ data, onChange, errors }: Props) {
  const isPurchase = data.originType === "purchase";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ originType: "purchase" })}
          className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 ${
            isPurchase ? "bg-primary text-primary-foreground border-primary" : "bg-background"
          }`}
        >
          <ShoppingCart className="h-4 w-4" /> Purchased
        </button>
        <button
          type="button"
          onClick={() => onChange({ originType: "birth" })}
          className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 ${
            !isPurchase ? "bg-primary text-primary-foreground border-primary" : "bg-background"
          }`}
        >
          <Baby className="h-4 w-4" /> Farm Born
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isPurchase ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Purchase Date *</Label>
              <Input
                type="date"
                value={data.purchaseDate}
                onChange={(e) => onChange({ purchaseDate: e.target.value })}
                className={errors.purchaseDate ? "border-rose-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Purchase Price (৳) *</Label>
              <Input
                type="number"
                value={data.purchasePrice || ""}
                onChange={(e) => onChange({ purchasePrice: parseFloat(e.target.value) || 0 })}
                placeholder="120000"
                className={errors.purchasePrice ? "border-rose-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Initial Weight (kg) *</Label>
              <Input
                type="number"
                value={data.initialWeightKg || ""}
                onChange={(e) => onChange({ initialWeightKg: parseFloat(e.target.value) || 0 })}
                placeholder="320"
                className={errors.initialWeightKg ? "border-rose-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Haat / Vendor</Label>
              <Input
                value={data.vendorName}
                onChange={(e) => onChange({ vendorName: e.target.value })}
                placeholder="e.g. Gabtoli"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Birth Weight (kg) *</Label>
              <Input
                type="number"
                value={data.birthWeightKg || data.initialWeightKg || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onChange({ birthWeightKg: val, initialWeightKg: val });
                }}
                placeholder="28"
                className={errors.initialWeightKg ? "border-rose-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dam (Mother) Tag</Label>
              <Input
                value={data.damTag}
                onChange={(e) => onChange({ damTag: e.target.value.toUpperCase() })}
                placeholder="TA-042"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Sire (Father) Tag</Label>
              <Input
                value={data.sireTag}
                onChange={(e) => onChange({ sireTag: e.target.value.toUpperCase() })}
                placeholder="SIRE-01"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
