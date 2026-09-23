"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { type AnimalGrowthProfile } from "@/lib/growth/types";
import { GrowthHerdRow } from "./GrowthHerdRow";

interface Props {
  profiles: AnimalGrowthProfile[];
  onOpenWeighModal: (cattleId: string) => void;
  onOpenTargetModal: (cattleId: string) => void;
}

export function GrowthHerdTab({
  profiles,
  onOpenWeighModal,
  onOpenTargetModal,
}: Props) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (p.status !== "active") return false;
      const matchSearch =
        p.tagId.toLowerCase().includes(search.toLowerCase()) ||
        (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
        p.breed.toLowerCase().includes(search.toLowerCase()) ||
        p.penName?.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;
      if (stageFilter !== "all" && p.growthStage !== stageFilter) return false;
      if (tierFilter !== "all" && p.performanceTier !== tierFilter) return false;
      return true;
    });
  }, [profiles, search, stageFilter, tierFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag, name, pen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9 bg-card/60"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Stages</option>
            <option value="calf">Calf (&lt;150kg)</option>
            <option value="weaner">Weaner (150-260kg)</option>
            <option value="grower">Grower (260-420kg)</option>
            <option value="finisher">Finisher (&gt;420kg)</option>
            <option value="mature">Mature / Adult</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Performance Tiers</option>
            <option value="elite">Elite (ADG &gt; 1.15 kg/d)</option>
            <option value="above_average">Above Avg (0.85-1.15 kg/d)</option>
            <option value="standard">Standard (0.60-0.85 kg/d)</option>
            <option value="underperforming">Underperforming (0.30-0.60 kg/d)</option>
            <option value="critical">Critical (&lt; 0.30 kg/d)</option>
          </select>
        </div>
      </div>

      <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold">Animal</TableHead>
              <TableHead className="text-xs font-semibold">Stage & Pen</TableHead>
              <TableHead className="text-xs font-semibold text-right">Live Weight</TableHead>
              <TableHead className="text-xs font-semibold text-right">ADG (30d / Life)</TableHead>
              <TableHead className="text-xs font-semibold">Target & Finish</TableHead>
              <TableHead className="text-xs font-semibold text-center">BCS</TableHead>
              <TableHead className="text-xs font-semibold text-right">Last Weighed</TableHead>
              <TableHead className="text-xs font-semibold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                  No animals matching filter criteria
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((p) => (
                <GrowthHerdRow
                  key={p.cattleId}
                  profile={p}
                  onOpenWeighModal={onOpenWeighModal}
                  onOpenTargetModal={onOpenTargetModal}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
