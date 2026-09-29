"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GroupSaleDialog } from "@/components/cattle/GroupSaleDialog";
import type { GroupLang } from "./group-text";

/**
 * "Sell" on an animal's page: the same sale form as the cattle list (one transaction,
 * sell_cattle_group), so a sale recorded from either place is the same kind of record.
 */
export function SellAnimalButton({ id, tag, lastKg, costSoFar, lang, label }: {
  id: string; tag: string; lastKg: number | null; costSoFar: number; lang: GroupLang; label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ size: "sm", variant: "outline" })}>
        <HandCoins className="mr-1.5 h-4 w-4" aria-hidden />{label}
      </button>
      {open && <GroupSaleDialog lang={lang} onClose={() => setOpen(false)} animals={[{ id, tag, lastKg, costSoFar }]} />}
    </>
  );
}
