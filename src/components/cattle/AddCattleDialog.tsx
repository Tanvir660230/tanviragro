"use client";

import { useState } from "react";
import { ChevronDown, Plus, Beef, Layers } from "lucide-react";
import { EnterpriseAnimalWizard } from "@/components/livestock/wizard/EnterpriseAnimalWizard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n/I18nProvider";
import { GroupPurchaseDialog } from "./GroupPurchaseDialog";
import { CATTLE_TEXT } from "./cattle-view-text";

interface Props {
  existingTagIds: string[];
  existingBreeds: string[];
  /** open on load (deep link /dashboard/cattle?open=add) */
  defaultOpen?: boolean;
}

/**
 * "Add cattle": one animal (the step-by-step form) or several bought together at one price.
 * The dialogs sit beside the menu, never inside it (a menu closes what it contains).
 */
export function AddCattleDialog({ existingTagIds, existingBreeds, defaultOpen = false }: Props) {
  const { locale } = useTranslation();
  const lang = locale === "bn" ? "bn" : "en";
  const t = CATTLE_TEXT[lang];
  const [open, setOpen] = useState<"one" | "many" | null>(defaultOpen ? "one" : null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="h-4 w-4" aria-hidden />{t.add}<ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem className="min-h-11 gap-2.5" onClick={() => setOpen("one")}><Beef className="h-4 w-4" aria-hidden />{t.add_one}</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 gap-2.5" onClick={() => setOpen("many")}><Layers className="h-4 w-4" aria-hidden />{t.add_many}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EnterpriseAnimalWizard open={open === "one"} onOpenChange={(o) => setOpen(o ? "one" : null)} existingTagIds={existingTagIds} />
      <GroupPurchaseDialog open={open === "many"} onOpenChange={(o) => setOpen(o ? "many" : null)} existingTagIds={existingTagIds} breeds={existingBreeds} lang={lang} />
    </>
  );
}
