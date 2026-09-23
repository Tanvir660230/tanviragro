"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnimalWizardCategoryStage } from "@/lib/validation/cattle-wizard";
import { Sparkles, Target, TrendingUp } from "lucide-react";

interface Props {
  data: AnimalWizardCategoryStage;
  onChange: (data: Partial<AnimalWizardCategoryStage>) => void;
  errors: Record<string, string>;
}

export function Step3CategoryStage({ data, onChange, errors }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-xs font-semibold">
            Livestock Stage / Purpose
          </Label>
          <select
            id="category"
            value={data.category}
            onChange={(e) => onChange({ category: e.target.value as any })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="fattening">Beef Fattening</option>
            <option value="qurbani">Qurbani Target Segment</option>
            <option value="dairy">Dairy / Milking</option>
            <option value="breeder">Breeder / Bull</option>
            <option value="calf">Calf Rearing</option>
            <option value="general">General Herd</option>
          </select>
        </div>

        {/* Qurbani Target Toggle */}
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent/20 cursor-pointer">
            <input
              type="checkbox"
              checked={data.isQurbaniTarget}
              onChange={(e) => onChange({ isQurbaniTarget: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Flag as Premium Qurbani Market Target</span>
            </div>
          </label>
        </div>

        {/* Target Weight */}
        <div className="space-y-1.5">
          <Label htmlFor="targetWeightKg" className="text-xs font-semibold flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            Target Final Weight (kg)
          </Label>
          <Input
            id="targetWeightKg"
            type="number"
            step="0.1"
            value={data.targetWeightKg ?? ""}
            onChange={(e) => onChange({ targetWeightKg: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="e.g. 480"
          />
        </div>

        {/* Target ADG */}
        <div className="space-y-1.5">
          <Label htmlFor="expectedDailyGainKg" className="text-xs font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            Expected ADG (kg/day)
          </Label>
          <Input
            id="expectedDailyGainKg"
            type="number"
            step="0.05"
            value={data.expectedDailyGainKg ?? ""}
            onChange={(e) => onChange({ expectedDailyGainKg: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="e.g. 0.85"
          />
        </div>
      </div>
    </div>
  );
}
