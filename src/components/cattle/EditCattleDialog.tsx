"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useL } from "@/i18n/text";
import { EnterpriseAnimalWizard } from "@/components/livestock/wizard/EnterpriseAnimalWizard";





interface CattleInfo {
  id: string;
  tag_id: string;
  gender: "male" | "female";
  breed: string | null;
  dob: string | null;
  purchase_date: string;
  purchase_price: number;
  initial_weight_kg: number;
  /** measured | estimated | unknown — an estimate is kept on record but never used for growth */
  initial_weight_type?: string | null;
  target_weight_kg: number | null;
  expected_daily_gain_kg: number | null;
  notes: string | null;
  existingTagIds: string[];
  existingBreeds: string[];
}


export function EditCattleDialog({ cattle }: { cattle: CattleInfo }) {
  const L = useL();
  const [open, setOpen] = useState(false);

  const initialData = useMemo(() => ({
    identification: {
      name: "",
      tagId: cattle.tag_id,
      electronicId: "",
      species: "cattle" as const,
      breed: cattle.breed || "Indigenous (Deshi)",
      gender: cattle.gender,
      dob: cattle.dob || "",
      photoUrl: null,
    },
    categoryStage: {
      category: "fattening" as const,
      isQurbaniTarget: false,
      targetWeightKg: cattle.target_weight_kg ?? null,
      expectedDailyGainKg: cattle.expected_daily_gain_kg ?? null,
    },
    origin: {
      originType: "purchase" as const,
      purchaseDate: cattle.purchase_date,
      purchasePrice: cattle.purchase_price,
      initialWeightKg: cattle.initial_weight_kg,
      initialWeightType: (cattle.initial_weight_type ?? "unknown") as "measured" | "estimated" | "unknown",
      vendorId: null,
      vendorName: "",
      birthWeightKg: null,
      damTag: "",
      sireTag: "",
    },
    notes: cattle.notes || "",
  }), [cattle]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={L("গরুর তথ্য বদলান", "Edit cattle")}
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        {L("বদলান", "Edit")}
      </Button>

      <EnterpriseAnimalWizard
        open={open}
        onOpenChange={setOpen}
        existingTagIds={cattle.existingTagIds}
        initialData={initialData}
        editAnimalId={cattle.id}
      />
    </>
  );
}
