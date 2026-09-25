"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateAnimalAge, type AnimalWizardIdentification } from "@/lib/validation/cattle-wizard";
import { MASTER_BREEDS } from "@/constants/master-data";
import { Sparkles, QrCode, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useL } from "@/i18n/text";

interface Props {
  data: AnimalWizardIdentification;
  onChange: (data: Partial<AnimalWizardIdentification>) => void;
  errors: Record<string, string>;
  suggestedTag?: string;
}

export function Step1Identification({ data, onChange, errors, suggestedTag }: Props) {
  const L = useL();
  const age = calculateAnimalAge(data.dob);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="tagId" className="text-xs font-semibold">
              {L("কানের ট্যাগ / নম্বর", "Ear tag / ID")} <span className="text-rose-500">*</span>
            </Label>
            {suggestedTag && !data.tagId && (
              <button
                type="button"
                onClick={() => onChange({ tagId: suggestedTag })}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
              >
                <Sparkles className="h-3 w-3" /> {suggestedTag}
              </button>
            )}
          </div>
          <Input
            id="tagId"
            value={data.tagId}
            onChange={(e) => onChange({ tagId: e.target.value.toUpperCase() })}
            placeholder="e.g. TA-001"
            className={errors.tagId ? "border-rose-500" : ""}
          />
          {errors.tagId && <p className="text-[11px] text-rose-500">{errors.tagId}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold">{L("নাম (ঐচ্ছিক)", "Animal Name / Nickname")}</Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Sultan, Manik"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="electronicId" className="text-xs font-semibold flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5 text-muted-foreground" /> {L("RFID / চিপ নম্বর", "RFID / Microchip ID")}
          </Label>
          <Input
            id="electronicId"
            value={data.electronicId}
            onChange={(e) => onChange({ electronicId: e.target.value })}
            placeholder="e.g. 982000412345678"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="species" className="text-xs font-semibold">{L("প্রাণী", "Species")}</Label>
          <select
            id="species"
            value={data.species}
            onChange={(e) => onChange({ species: e.target.value as any })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="cattle">{L("গরু", "Cattle")}</option>
            <option value="goat">{L("ছাগল", "Goat")}</option>
            <option value="sheep">{L("ভেড়া", "Sheep")}</option>
            <option value="buffalo">{L("মহিষ", "Buffalo")}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breed" className="text-xs font-semibold">{L("জাত", "Breed")}</Label>
          <input
            list="breed-options"
            id="breed"
            value={data.breed}
            onChange={(e) => onChange({ breed: e.target.value })}
            placeholder={L("জাত বাছুন বা লিখুন…", "Select or enter breed...")}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          />
          <datalist id="breed-options">
            {MASTER_BREEDS.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{L("লিঙ্গ", "Gender")} <span className="text-rose-500">*</span></Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ gender: "male" })}
              className={`flex items-center justify-center h-9 rounded-md border text-xs font-medium transition-colors ${
                data.gender === "male" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-accent/40"
              }`}
            >
              {L("ষাঁড়", "Male (Bull)")}
            </button>
            <button
              type="button"
              onClick={() => onChange({ gender: "female" })}
              className={`flex items-center justify-center h-9 rounded-md border text-xs font-medium transition-colors ${
                data.gender === "female" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-accent/40"
              }`}
            >
              {L("গাভী", "Female (Cow)")}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="dob" className="text-xs font-semibold">{L("জন্ম তারিখ", "Date of Birth")}</Label>
            {data.dob && <Badge variant="secondary" className="text-[10px]">{age.display}</Badge>}
          </div>
          <Input id="dob" type="date" value={data.dob} onChange={(e) => onChange({ dob: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="photoUrl" className="text-xs font-semibold flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-muted-foreground" /> {L("ছবির লিংক", "Photo URL")}
          </Label>
          <Input
            id="photoUrl"
            value={data.photoUrl || ""}
            onChange={(e) => onChange({ photoUrl: e.target.value || null })}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}
