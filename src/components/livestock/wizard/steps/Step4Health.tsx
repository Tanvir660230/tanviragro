"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AnimalWizardHealth } from "@/lib/validation/cattle-wizard";
import { ShieldAlert, Activity, Syringe, Pill } from "lucide-react";

interface Props {
  data: AnimalWizardHealth;
  onChange: (data: Partial<AnimalWizardHealth>) => void;
  errors: Record<string, string>;
}

export function Step4Health({ data, onChange, errors }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Health Status */}
        <div className="space-y-1.5">
          <Label htmlFor="healthStatus" className="text-xs font-semibold flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            Current Health Status
          </Label>
          <select
            id="healthStatus"
            value={data.status}
            onChange={(e) => onChange({ status: e.target.value as any })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="active">Active & Healthy</option>
            <option value="quarantined">Quarantined / Incoming Protocol</option>
            <option value="treatment">In Treatment</option>
            <option value="observation">Observation / Recovery</option>
          </select>
        </div>

        {/* Quarantine Flag */}
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent/20 cursor-pointer">
            <input
              type="checkbox"
              checked={data.isQuarantined || data.status === "quarantined"}
              onChange={(e) =>
                onChange({
                  isQuarantined: e.target.checked,
                  status: e.target.checked ? "quarantined" : "active",
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-amber-500"
            />
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>Enforce Biosecurity Quarantine (14 Days)</span>
            </div>
          </label>
        </div>

        {/* Last Vaccination Date */}
        <div className="space-y-1.5">
          <Label htmlFor="lastVaccinationDate" className="text-xs font-semibold flex items-center gap-1.5">
            <Syringe className="h-3.5 w-3.5 text-muted-foreground" />
            Last Vaccination Date (Optional)
          </Label>
          <Input
            id="lastVaccinationDate"
            type="date"
            value={data.lastVaccinationDate || ""}
            onChange={(e) => onChange({ lastVaccinationDate: e.target.value || null })}
          />
        </div>

        {/* Deworming Date */}
        <div className="space-y-1.5">
          <Label htmlFor="dewormingDate" className="text-xs font-semibold flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5 text-muted-foreground" />
            Last Deworming Date (Optional)
          </Label>
          <Input
            id="dewormingDate"
            type="date"
            value={data.dewormingDate || ""}
            onChange={(e) => onChange({ dewormingDate: e.target.value || null })}
          />
        </div>

        {/* Health Notes */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="healthNotes" className="text-xs font-semibold">
            Health Observation & Medical History Notes
          </Label>
          <Textarea
            id="healthNotes"
            rows={2}
            value={data.healthNotes}
            onChange={(e) => onChange({ healthNotes: e.target.value })}
            placeholder="e.g. Received FMD vaccine, dewormed upon entry, no visible signs of lameness..."
          />
        </div>
      </div>
    </div>
  );
}
