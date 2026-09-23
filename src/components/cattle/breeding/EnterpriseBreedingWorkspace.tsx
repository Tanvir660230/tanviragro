"use client";

import React, { useState } from "react";
import {
  Heart,
  Flame,
  Sparkles,
  Baby,
  Dna,
  BarChart3,
  Plus,
  Search,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BreedingKpiCards } from "./BreedingKpiCards";
import { HeatMonitorTab } from "./HeatMonitorTab";
import { PregnancyGestationTab } from "./PregnancyGestationTab";
import { CalvingOffspringTab } from "./CalvingOffspringTab";
import { SemenInventoryTab } from "./SemenInventoryTab";
import { FertilityAnalyticsTab } from "./FertilityAnalyticsTab";
import { PedigreeTreeViewer } from "./PedigreeTreeViewer";
import { RecordHeatModal } from "./RecordHeatModal";
import { RecordBreedingModal } from "./RecordBreedingModal";
import { PregnancyCheckModal } from "./PregnancyCheckModal";
import { RegisterBirthModal } from "./RegisterBirthModal";
import { SemenInventoryModal } from "./SemenInventoryModal";
import {
  type HeatRecord,
  type BreedingAttempt,
  type CalvingRecord,
  type SemenInventoryItem,
  type FertilityMetrics,
  type PedigreeNode,
} from "@/lib/reproduction";
import { useRouter } from "next/navigation";

interface EnterpriseBreedingWorkspaceProps {
  initialHeatRecords: HeatRecord[];
  initialBreedingAttempts: BreedingAttempt[];
  initialCalvingRecords: CalvingRecord[];
  initialSemenInventory: SemenInventoryItem[];
  cattleList: any[];
  pedigreeNodes: Record<string, PedigreeNode>;
  metrics: FertilityMetrics;
}

export function EnterpriseBreedingWorkspace({
  initialHeatRecords,
  initialBreedingAttempts,
  initialCalvingRecords,
  initialSemenInventory,
  cattleList,
  pedigreeNodes,
  metrics,
}: EnterpriseBreedingWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("pregnancies");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPedigreeId, setSelectedPedigreeId] = useState<string>(
    cattleList[0]?.id || ""
  );

  // Modal States
  const [openHeatModal, setOpenHeatModal] = useState(false);
  const [openBreedingModal, setOpenBreedingModal] = useState(false);
  const [openPDModal, setOpenPDModal] = useState(false);
  const [openCalvingModal, setOpenCalvingModal] = useState(false);
  const [openSemenModal, setOpenSemenModal] = useState(false);

  // Selected Target Object for modals
  const [activeBreedingAttempt, setActiveBreedingAttempt] = useState<BreedingAttempt | null>(null);
  const [activeHeatForBreeding, setActiveHeatForBreeding] = useState<HeatRecord | null>(null);

  const handleOpenInseminateFromHeat = (record: HeatRecord) => {
    setActiveHeatForBreeding(record);
    setOpenBreedingModal(true);
  };

  const handleOpenPDFromAttempt = (attempt: BreedingAttempt) => {
    setActiveBreedingAttempt(attempt);
    setOpenPDModal(true);
  };

  const handleOpenCalvingFromAttempt = (attempt: BreedingAttempt) => {
    setActiveBreedingAttempt(attempt);
    setOpenCalvingModal(true);
  };

  const refreshData = () => {
    router.refresh();
  };

  const totalStraws = initialSemenInventory.reduce((acc, s) => acc + (s.strawsInStock || 0), 0);
  const activeHeatsCount = initialHeatRecords.filter((h) => h.status === "active").length;
  const activePregnanciesCount = initialBreedingAttempts.filter(
    (a) => a.status === "pregnancy_confirmed" || (a.status === "inseminated" && a.pdResult === "pregnant")
  ).length;

  const currentPedigreeRoot = selectedPedigreeId ? pedigreeNodes[selectedPedigreeId] || null : null;

  return (
    <div className="space-y-6 pb-12">
      <BreedingKpiCards
        activePregnancies={activePregnanciesCount}
        upcomingCalvings30d={metrics.upcomingCalvingsIn30Days}
        activeHeatAlerts={activeHeatsCount}
        conceptionRatePercent={metrics.conceptionRatePercent}
        totalStrawsInStock={totalStraws}
        pendingPDChecks={metrics.pendingPDChecksCount}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-x-auto">
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="pregnancies" className="gap-1.5 text-xs rounded-lg py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Pregnancies &amp; Gestation
            </TabsTrigger>
            <TabsTrigger value="heat" className="gap-1.5 text-xs rounded-lg py-1.5">
              <Flame className="h-3.5 w-3.5 text-rose-500" /> Heat &amp; Estrus
            </TabsTrigger>
            <TabsTrigger value="calving" className="gap-1.5 text-xs rounded-lg py-1.5">
              <Baby className="h-3.5 w-3.5 text-purple-500" /> Calving &amp; Offspring
            </TabsTrigger>
            <TabsTrigger value="pedigree" className="gap-1.5 text-xs rounded-lg py-1.5">
              <Dna className="h-3.5 w-3.5 text-blue-500" /> Pedigree &amp; Lineage
            </TabsTrigger>
            <TabsTrigger value="semen" className="gap-1.5 text-xs rounded-lg py-1.5">
              <Dna className="h-3.5 w-3.5 text-cyan-500" /> Semen Inventory
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs rounded-lg py-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Fertility Analytics
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setActiveHeatForBreeding(null);
                setOpenBreedingModal(true);
              }}
              className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Inseminate / Breed
            </Button>
          </div>
        </div>

        <TabsContent value="pregnancies" className="m-0 focus-visible:outline-none">
          <PregnancyGestationTab
            breedingAttempts={initialBreedingAttempts}
            onOpenPDModal={handleOpenPDFromAttempt}
            onOpenCalvingModal={handleOpenCalvingFromAttempt}
          />
        </TabsContent>

        <TabsContent value="heat" className="m-0 focus-visible:outline-none">
          <HeatMonitorTab
            heatRecords={initialHeatRecords}
            onOpenRecordHeat={() => setOpenHeatModal(true)}
            onOpenInseminate={handleOpenInseminateFromHeat}
          />
        </TabsContent>

        <TabsContent value="calving" className="m-0 focus-visible:outline-none">
          <CalvingOffspringTab
            calvingRecords={initialCalvingRecords}
            onOpenNewCalving={() => {
              setActiveBreedingAttempt(null);
              setOpenCalvingModal(true);
            }}
          />
        </TabsContent>

        <TabsContent value="pedigree" className="m-0 focus-visible:outline-none">
          <div className="space-y-4 bg-card border rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Dna className="h-4 w-4 text-blue-500" />
                  Lineage, Pedigree &amp; Inbreeding Engine
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-generation ancestral tree tracking and Wright&apos;s Inbreeding Coefficient verification.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <select
                  value={selectedPedigreeId}
                  onChange={(e) => setSelectedPedigreeId(e.target.value)}
                  className="w-full text-xs h-9 rounded-xl border bg-background px-3"
                >
                  {cattleList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tag_number} ({c.name || c.breed || "Cattle"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <PedigreeTreeViewer rootNode={currentPedigreeRoot} />
          </div>
        </TabsContent>

        <TabsContent value="semen" className="m-0 focus-visible:outline-none">
          <SemenInventoryTab
            semenList={initialSemenInventory}
            onOpenAddStock={() => setOpenSemenModal(true)}
          />
        </TabsContent>

        <TabsContent value="analytics" className="m-0 focus-visible:outline-none">
          <FertilityAnalyticsTab metrics={metrics} />
        </TabsContent>
      </Tabs>

      <RecordHeatModal
        open={openHeatModal}
        onOpenChange={setOpenHeatModal}
        cattleList={cattleList}
        onSuccess={refreshData}
      />

      <RecordBreedingModal
        open={openBreedingModal}
        onOpenChange={setOpenBreedingModal}
        cattleList={cattleList}
        semenList={initialSemenInventory}
        preselectedCowId={activeHeatForBreeding?.cattleId}
        preselectedHeatId={activeHeatForBreeding?.id}
        onSuccess={refreshData}
      />

      <PregnancyCheckModal
        open={openPDModal}
        onOpenChange={setOpenPDModal}
        attempt={activeBreedingAttempt}
        onSuccess={refreshData}
      />

      <RegisterBirthModal
        open={openCalvingModal}
        onOpenChange={setOpenCalvingModal}
        cattleList={cattleList}
        preselectedAttempt={activeBreedingAttempt}
        onSuccess={refreshData}
      />

      <SemenInventoryModal
        open={openSemenModal}
        onOpenChange={setOpenSemenModal}
        onSuccess={refreshData}
      />
    </div>
  );
}
