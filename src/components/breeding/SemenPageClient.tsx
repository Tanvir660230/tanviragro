"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FlaskConical } from "lucide-react";
import { SemenInventoryTab } from "@/components/cattle/breeding/SemenInventoryTab";
import { SemenInventoryModal } from "@/components/cattle/breeding/SemenInventoryModal";
import type { SemenInventoryItem } from "@/lib/reproduction";

export function SemenPageClient({ inventory }: { inventory: SemenInventoryItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const refresh = () => router.refresh();

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <FlaskConical className="h-3.5 w-3.5" />Add Semen Stock
        </Button>
      </div>
      <SemenInventoryTab semenList={inventory} onOpenAddStock={() => setOpen(true)} />
      <SemenInventoryModal open={open} onOpenChange={setOpen} onSuccess={refresh} />
    </>
  );
}
