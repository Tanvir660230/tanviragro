"use client";

import React, { useState } from "react";
import { PenEntity, PenEngine, PenType } from "@/lib/livestock/pen-engine";
import { PenOccupancyCard } from "./PenOccupancyCard";
import { Filter, Layers, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pens: PenEntity[];
  onMoveClick?: (pen: PenEntity) => void;
}

export function PenHeatmapGrid({ pens, onMoveClick }: Props) {
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredPens = pens.filter((p) => {
    if (selectedType === "all") return true;
    return p.type === selectedType;
  });

  const TYPES: { id: string; label: string }[] = [
    { id: "all", label: "All Pens" },
    { id: "fattening", label: "Fattening" },
    { id: "quarantine", label: "Quarantine" },
    { id: "isolation", label: "Isolation" },
    { id: "nursery", label: "Nursery" },
    { id: "maternity", label: "Maternity" },
  ];

  return (
    <div className="space-y-4">
      {/* Type Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
              selectedType === t.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pens Grid */}
      {filteredPens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/30">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
          <p className="text-sm font-semibold text-foreground">No pens found in this category</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add pens or switch filter to view current farm layout.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPens.map((pen) => (
            <PenOccupancyCard
              key={pen.id}
              pen={pen}
              onMoveClick={onMoveClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
