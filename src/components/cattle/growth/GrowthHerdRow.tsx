"use client";

import React from "react";
import Link from "next/link";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { type AnimalGrowthProfile } from "@/lib/growth/types";
import { cn } from "@/lib/utils";

interface Props {
  profile: AnimalGrowthProfile;
  onOpenWeighModal: (cattleId: string) => void;
  onOpenTargetModal: (cattleId: string) => void;
}

export function GrowthHerdRow({
  profile: p,
  onOpenWeighModal,
  onOpenTargetModal,
}: Props) {
  const adg = p.recent30dAdgKg || p.overallAdgKg;
  const isOverdue = p.daysSinceLastWeighed > 30;

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell>
        <div className="flex items-center gap-2">
          <div>
            <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <span>#{p.tagId}</span>
              {p.name && <span className="text-muted-foreground font-normal">({p.name})</span>}
              {p.alerts.length > 0 && (
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{p.breed}</span>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={cn(
              "w-fit text-[10px] px-1.5 py-0 capitalize",
              p.growthStage === "finisher" && "border-amber-500 text-amber-600 dark:text-amber-400",
              p.growthStage === "grower" && "border-blue-500 text-blue-600 dark:text-blue-400",
              p.growthStage === "weaner" && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
              p.growthStage === "calf" && "border-purple-500 text-purple-600 dark:text-purple-400"
            )}
          >
            {p.growthStage}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{p.penName}</span>
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="font-bold text-xs text-foreground">
          {p.currentWeightKg} <span className="text-[10px] font-normal text-muted-foreground">kg</span>
        </div>
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          +{p.totalWeightGainKg} kg gain
        </span>
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1 font-semibold text-xs">
          {adg > 0.8 ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
          ) : adg > 0.4 ? (
            <Minus className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
          )}
          <span>+{adg.toFixed(2)} kg/d</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Life: +{p.overallAdgKg.toFixed(2)} kg/d
        </span>
      </TableCell>

      <TableCell>
        {p.activeTarget ? (
          <div className="w-28 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Goal: {p.activeTarget.target_weight_kg}kg</span>
              <span className="font-medium text-foreground">{p.targetAchievementPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${p.targetAchievementPct}%` }}
              />
            </div>
            {p.daysToTarget !== undefined && (
              <div className="text-[10px] text-muted-foreground">
                ~{p.daysToTarget} days left
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onOpenTargetModal(p.cattleId)}
            className="text-[11px] text-muted-foreground hover:text-foreground h-6 px-1.5"
          >
            <Target className="h-3 w-3 mr-1" /> Set Goal
          </Button>
        )}
      </TableCell>

      <TableCell className="text-center">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
          {p.currentBcs.toFixed(1)} / 9
        </Badge>
      </TableCell>

      <TableCell className="text-right">
        <div className={cn("text-xs font-medium", isOverdue ? "text-rose-500" : "text-foreground")}>
          {p.lastWeighedAt}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {p.daysSinceLastWeighed === 0 ? "Today" : `${p.daysSinceLastWeighed}d ago`}
        </span>
      </TableCell>

      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => onOpenWeighModal(p.cattleId)}
            className="h-7 px-2 text-xs"
          >
            <Scale className="h-3 w-3 mr-1" /> Weigh
          </Button>
          <Link href={`/dashboard/cattle/${p.cattleId}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}
