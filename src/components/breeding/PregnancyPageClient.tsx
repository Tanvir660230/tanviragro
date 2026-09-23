"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PregnancyGestationTab } from "@/components/cattle/breeding/PregnancyGestationTab";
import { PregnancyCheckModal } from "@/components/cattle/breeding/PregnancyCheckModal";
import { RegisterBirthModal } from "@/components/cattle/breeding/RegisterBirthModal";
import type { BreedingAttempt } from "@/lib/reproduction";

interface PregnancyPageClientProps {
  breedingAttempts: BreedingAttempt[];
  cattleList: any[];
}

export function PregnancyPageClient({ breedingAttempts, cattleList }: PregnancyPageClientProps) {
  const router = useRouter();
  const [openPDModal, setOpenPDModal] = useState(false);
  const [openCalvingModal, setOpenCalvingModal] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<BreedingAttempt | null>(null);

  const refresh = () => router.refresh();

  return (
    <>
      <PregnancyGestationTab
        breedingAttempts={breedingAttempts}
        onOpenPDModal={(a) => { setActiveAttempt(a); setOpenPDModal(true); }}
        onOpenCalvingModal={(a) => { setActiveAttempt(a); setOpenCalvingModal(true); }}
      />
      <PregnancyCheckModal
        open={openPDModal}
        onOpenChange={setOpenPDModal}
        attempt={activeAttempt}
        onSuccess={refresh}
      />
      <RegisterBirthModal
        open={openCalvingModal}
        onOpenChange={setOpenCalvingModal}
        cattleList={cattleList}
        preselectedAttempt={activeAttempt}
        onSuccess={refresh}
      />
    </>
  );
}
