"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnimalWizardFinancial } from "@/lib/validation/cattle-wizard";
import { DollarSign, Truck, Receipt, Shield } from "lucide-react";
import { useL } from "@/i18n/text";

interface Props {
  data: AnimalWizardFinancial;
  onChange: (data: Partial<AnimalWizardFinancial>) => void;
  errors: Record<string, string>;
}

export function Step6Financial({ data, onChange, errors }: Props) {
  const L = useL();
  const totalIncidental = (data.transportCost || 0) + (data.haatHasil || 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="transportCost" className="text-xs font-semibold flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-blue-500" />
            {L("পরিবহন খরচ (৳)", "Transport / Freight Expense (৳)")}
          </Label>
          <Input
            id="transportCost"
            type="number"
            value={data.transportCost || ""}
            onChange={(e) => onChange({ transportCost: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 2500"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="haatHasil" className="text-xs font-semibold flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-amber-500" />
            {L("হাটের হাসিল (৳)", "Haat Tax / Hasil Fee (৳)")}
          </Label>
          <Input
            id="haatHasil"
            type="number"
            value={data.haatHasil || ""}
            onChange={(e) => onChange({ haatHasil: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 1500"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="insuranceProvider" className="text-xs font-semibold flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            {L("বীমা কোম্পানি (ঐচ্ছিক)", "Insurance Provider (Optional)")}
          </Label>
          <Input
            id="insuranceProvider"
            value={data.insuranceProvider}
            onChange={(e) => onChange({ insuranceProvider: e.target.value })}
            placeholder="e.g. Green Delta Livestock Takaful"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="insuranceAmount" className="text-xs font-semibold flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            {L("বীমার পরিমাণ (৳)", "Insured Coverage Value (৳)")}
          </Label>
          <Input
            id="insuranceAmount"
            type="number"
            value={data.insuranceAmount ?? ""}
            onChange={(e) => onChange({ insuranceAmount: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="e.g. 150000"
          />
        </div>
      </div>

      <div className="p-3 bg-muted/40 rounded-lg border border-border/60 flex justify-between items-center text-xs">
        <span className="text-muted-foreground">{L("কেনার সাথে বাড়তি খরচ:", "Total Initial Acquisition Overheads:")}</span>
        <span className="font-semibold text-foreground">৳ {totalIncidental.toLocaleString()}</span>
      </div>
    </div>
  );
}
