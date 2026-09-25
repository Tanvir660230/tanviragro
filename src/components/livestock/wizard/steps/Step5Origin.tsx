"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnimalWizardOrigin } from "@/lib/validation/cattle-wizard";
import { ShoppingCart, Baby } from "lucide-react";
import { useL } from "@/i18n/text";

interface Props {
  data: AnimalWizardOrigin;
  onChange: (data: Partial<AnimalWizardOrigin>) => void;
  errors: Record<string, string>;
}

export function Step5Origin({ data, onChange, errors }: Props) {
  const L = useL();
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
          <ShoppingCart className="h-4 w-4" /> {L("কেনা", "Purchased")}
        </button>
        <button
          type="button"
          onClick={() => onChange({ originType: "birth" })}
          className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 ${
            !isPurchase ? "bg-primary text-primary-foreground border-primary" : "bg-background"
          }`}
        >
          <Baby className="h-4 w-4" /> {L("খামারে জন্ম", "Farm Born")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isPurchase ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{L("কেনার তারিখ *", "Purchase Date *")}</Label>
              <Input
                type="date"
                value={data.purchaseDate}
                onChange={(e) => onChange({ purchaseDate: e.target.value })}
                className={errors.purchaseDate ? "border-rose-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{L("কেনা দাম (৳) *", "Purchase Price (৳) *")}</Label>
              <Input
                type="number"
                value={data.purchasePrice || ""}
                onChange={(e) => onChange({ purchasePrice: parseFloat(e.target.value) || 0 })}
                placeholder="120000"
                className={errors.purchasePrice ? "border-rose-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{L("কেনার সময় ওজন (কেজি) *", "Initial Weight (kg) *")}</Label>
              <Input
                type="number"
                value={data.initialWeightKg || ""}
                onChange={(e) => onChange({ initialWeightKg: parseFloat(e.target.value) || 0 })}
                placeholder="320"
                className={errors.initialWeightKg ? "border-rose-500" : ""}
              />
              <select
                name="initial_weight_type"
                aria-label={L("ওজন কীভাবে পাওয়া", "How the weight was taken")}
                value={data.initialWeightType ?? "measured"}
                onChange={(e) => onChange({ initialWeightType: e.target.value as "measured" | "estimated" | "unknown" })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="measured">{L("মাপা (স্কেল বা ফিতা)", "Measured (scale or tape)")}</option>
                <option value="estimated">{L("আন্দাজ (মাপা হয়নি)", "Estimated (not weighed)")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{L("হাট / বিক্রেতা", "Haat / Vendor")}</Label>
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
              <Label className="text-xs font-semibold">{L("জন্মের ওজন (কেজি) *", "Birth Weight (kg) *")}</Label>
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
              <Label className="text-xs font-semibold">{L("মায়ের ট্যাগ", "Dam (Mother) Tag")}</Label>
              <Input
                value={data.damTag}
                onChange={(e) => onChange({ damTag: e.target.value.toUpperCase() })}
                placeholder="TA-042"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{L("বাবার ট্যাগ", "Sire (Father) Tag")}</Label>
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
