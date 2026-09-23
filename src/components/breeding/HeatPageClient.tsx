"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";
import { RecordHeatModal } from "@/components/cattle/breeding/RecordHeatModal";
import { RecordBreedingModal } from "@/components/cattle/breeding/RecordBreedingModal";
import { HeatMonitorTab } from "@/components/cattle/breeding/HeatMonitorTab";
import type { HeatRecord, SemenInventoryItem } from "@/lib/reproduction";

interface HeatPageClientProps {
  heatRecords: HeatRecord[];
  cattleList: any[];
  semenInventory: SemenInventoryItem[];
}

export function HeatPageClient({ heatRecords, cattleList, semenInventory }: HeatPageClientProps) {
  const router = useRouter();
  const [openHeatModal, setOpenHeatModal] = useState(false);
  const [openBreedingModal, setOpenBreedingModal] = useState(false);
  const [activeHeat, setActiveHeat] = useState<HeatRecord | null>(null);

  const refresh = () => router.refresh();

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setOpenHeatModal(true)}>
          <Flame className="h-3.5 w-3.5" />Record Heat
        </Button>
      </div>

      <HeatMonitorTab
        heatRecords={heatRecords}
        onOpenRecordHeat={() => setOpenHeatModal(true)}
        onOpenInseminate={(h) => { setActiveHeat(h); setOpenBreedingModal(true); }}
      />

      <RecordHeatModal open={openHeatModal} onOpenChange={setOpenHeatModal} cattleList={cattleList} onSuccess={refresh} />
      <RecordBreedingModal
        open={openBreedingModal}
        onOpenChange={setOpenBreedingModal}
        cattleList={cattleList}
        semenList={semenInventory}
        preselectedCowId={activeHeat?.cattleId}
        preselectedHeatId={activeHeat?.id}
        onSuccess={refresh}
      />
    </>
  );
}
