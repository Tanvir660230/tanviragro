"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Baby } from "lucide-react";
import { CalvingOffspringTab } from "@/components/cattle/breeding/CalvingOffspringTab";
import { RegisterBirthModal } from "@/components/cattle/breeding/RegisterBirthModal";
import { PregnancyCheckModal } from "@/components/cattle/breeding/PregnancyCheckModal";
import type { CalvingRecord, BreedingAttempt } from "@/lib/reproduction";

interface CalvingPageClientProps {
  calvingRecords: CalvingRecord[];
  breedingAttempts: any[];
  cattleList: any[];
}

export function CalvingPageClient({ calvingRecords, breedingAttempts, cattleList }: CalvingPageClientProps) {
  const router = useRouter();
  const [openCalvingModal, setOpenCalvingModal] = useState(false);
  const [openPDModal, setOpenPDModal] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<BreedingAttempt | null>(null);
  const refresh = () => router.refresh();

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => { setActiveAttempt(null); setOpenCalvingModal(true); }}>
          <Baby className="h-3.5 w-3.5" />Register Birth
        </Button>
      </div>
      <CalvingOffspringTab calvingRecords={calvingRecords} onOpenNewCalving={() => { setActiveAttempt(null); setOpenCalvingModal(true); }} />
      <RegisterBirthModal
        open={openCalvingModal}
        onOpenChange={setOpenCalvingModal}
        cattleList={cattleList}
        preselectedAttempt={activeAttempt}
        onSuccess={refresh}
      />
      <PregnancyCheckModal
        open={openPDModal}
        onOpenChange={setOpenPDModal}
        attempt={activeAttempt}
        onSuccess={refresh}
      />
    </>
  );
}
