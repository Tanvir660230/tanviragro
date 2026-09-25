"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EnterpriseAnimalWizard } from "@/components/livestock/wizard/EnterpriseAnimalWizard";
import { useL } from "@/i18n/text";

interface Props {
  existingTagIds: string[];
  existingBreeds: string[];
  /** open on load (deep link /dashboard/cattle?open=add) */
  defaultOpen?: boolean;
}

/** "Add cattle" button: opens the step-by-step animal form. */
export function AddCattleDialog({ existingTagIds, defaultOpen = false }: Props) {
  const L = useL();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} aria-label={L("গরু যোগ", "Add cattle")}>
        <Plus className="mr-1.5 h-4 w-4" />
        {L("গরু যোগ", "Add cattle")}
      </Button>

      <EnterpriseAnimalWizard open={open} onOpenChange={setOpen} existingTagIds={existingTagIds} />
    </>
  );
}
