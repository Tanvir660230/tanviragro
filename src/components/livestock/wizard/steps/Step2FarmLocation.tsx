"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnimalWizardFarmLocation } from "@/lib/validation/cattle-wizard";
import { Building2, Home, UserCheck, ShieldCheck } from "lucide-react";
import { useL } from "@/i18n/text";

interface Props {
  data: AnimalWizardFarmLocation;
  onChange: (data: Partial<AnimalWizardFarmLocation>) => void;
  errors: Record<string, string>;
}

export function Step2FarmLocation({ data, onChange, errors }: Props) {
  const L = useL();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="farmId" className="text-xs font-semibold flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            {L("খামার", "Farm Facility / Site")}
          </Label>
          <Input
            id="farmId"
            value={data.farmId}
            onChange={(e) => onChange({ farmId: e.target.value })}
            placeholder="e.g. Main Farm - Savar Facility"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="penId" className="text-xs font-semibold flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            {L("শেড / ঘর", "Pen / Shed Assignment")}
          </Label>
          <Input
            id="penId"
            value={data.penId}
            onChange={(e) => onChange({ penId: e.target.value })}
            placeholder="e.g. Pen A1 (Fattening)"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caretaker" className="text-xs font-semibold flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
            {L("দেখাশোনাকারী", "Primary Caretaker / Attendant")}
          </Label>
          <Input
            id="caretaker"
            value={data.caretaker}
            onChange={(e) => onChange({ caretaker: e.target.value })}
            placeholder="e.g. Rafiqul Islam"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ownerPartnerId" className="text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            {L("মালিক / অংশীদার", "Owner / Investor Stakeholder")}
          </Label>
          <Input
            id="ownerPartnerId"
            value={data.ownerPartnerId}
            onChange={(e) => onChange({ ownerPartnerId: e.target.value })}
            placeholder="e.g. Direct Farm Owned / Investor Name"
          />
        </div>
      </div>
    </div>
  );
}
