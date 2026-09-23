"use client";

import React, { useState } from "react";
import { FarmEntity, PenEntity, PenEngine } from "@/lib/livestock/pen-engine";
import { PenHeatmapGrid } from "@/components/livestock/PenHeatmapGrid";
import { CreateFarmDialog } from "@/components/livestock/CreateFarmDialog";
import { CreatePenDialog } from "@/components/livestock/CreatePenDialog";
import { MoveAnimalPenDialog } from "@/components/livestock/MoveAnimalPenDialog";
import { Building2, Layers, Users, AlertTriangle, ArrowRightLeft } from "lucide-react";

interface Props {
  farms: FarmEntity[];
  pens: PenEntity[];
  activeCattle: Array<{
    id: string;
    tag_id: string;
    pen_id: string | null;
    farm_id: string | null;
    breed: string;
    status: string;
    is_quarantined: boolean;
  }>;
}

export function PenManagementClient({ farms, pens, activeCattle }: Props) {
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farms[0]?.id || "");
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetMovePen, setTargetMovePen] = useState<PenEntity | null>(null);

  const currentFarmPens = pens.filter((p) => p.farmId === selectedFarmId);
  const metrics = PenEngine.calculateFarmCapacity(selectedFarmId, currentFarmPens);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span>Multi-Farm & Pen Management</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time occupancy, bio-security segregation, and herd movement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTargetMovePen(null); setMoveModalOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Move Cattle</span>
          </button>
          <CreateFarmDialog />
          {farms.length > 0 && <CreatePenDialog farms={farms} selectedFarmId={selectedFarmId} />}
        </div>
      </div>

      {farms.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
          {farms.map((farm) => (
            <button
              key={farm.id}
              onClick={() => setSelectedFarmId(farm.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                selectedFarmId === farm.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{farm.name}</span>
              <span className="font-mono text-[10px] opacity-80">({farm.code})</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Layers className="h-4 w-4 text-blue-500" /> Total Pens
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">{metrics.activePens}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active shedding bays</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users className="h-4 w-4 text-emerald-500" /> Farm Occupancy
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">
            {metrics.totalOccupancy} <span className="text-sm text-muted-foreground">/ {metrics.totalCapacity}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.overallOccupancyPct}% utilized</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users className="h-4 w-4 text-indigo-500" /> Available Capacity
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">{metrics.availableCapacity}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Open head slots</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Capacity Alerts
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">
            {metrics.pensNearCapacityCount + metrics.pensOverCapacityCount}
          </p>
          <p className="text-[11px] text-amber-600 mt-0.5">
            {metrics.pensOverCapacityCount} overcap, {metrics.pensNearCapacityCount} near full
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/80 bg-card/30 p-5 sm:p-6 backdrop-blur-xs">
        <PenHeatmapGrid
          pens={currentFarmPens}
          onMoveClick={(pen) => {
            setTargetMovePen(pen);
            setMoveModalOpen(true);
          }}
        />
      </div>

      <MoveAnimalPenDialog
        open={moveModalOpen}
        onOpenChange={setMoveModalOpen}
        pens={pens}
        activeCattle={activeCattle}
        preselectedPen={targetMovePen}
      />
    </div>
  );
}
