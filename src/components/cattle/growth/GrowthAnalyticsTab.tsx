"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type AnimalGrowthProfile, type PenGrowthBenchmark, type BreedGrowthBenchmark } from "@/lib/growth/types";
import { BrainCircuit, TrendingUp } from "lucide-react";

interface Props {
  profiles: AnimalGrowthProfile[];
  penBenchmarks: PenGrowthBenchmark[];
  breedBenchmarks: BreedGrowthBenchmark[];
}

export function GrowthAnalyticsTab({ profiles, penBenchmarks, breedBenchmarks }: Props) {
  const active = profiles.filter((p) => p.status === "active");
  const top = [...active].sort((a, b) => (b.recent30dAdgKg || b.overallAdgKg) - (a.recent30dAdgKg || a.overallAdgKg)).slice(0, 5);
  const bottom = [...active].sort((a, b) => (a.recent30dAdgKg || a.overallAdgKg) - (b.recent30dAdgKg || b.overallAdgKg)).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/60 bg-card/60">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Pen Rankings</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Pen</TableHead>
                  <TableHead className="text-xs text-center">Head</TableHead>
                  <TableHead className="text-xs text-right">Avg Wt</TableHead>
                  <TableHead className="text-xs text-right">Avg ADG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {penBenchmarks.map((pen) => (
                  <TableRow key={pen.penName}>
                    <TableCell className="font-semibold text-xs">{pen.penName}</TableCell>
                    <TableCell className="text-center text-xs">{pen.animalCount}</TableCell>
                    <TableCell className="text-right text-xs">{pen.avgWeightKg} kg</TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-600">+{pen.avgAdgKg.toFixed(2)} kg/d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/60">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Breed Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Breed</TableHead>
                  <TableHead className="text-xs text-center">Count</TableHead>
                  <TableHead className="text-xs text-right">Avg Wt</TableHead>
                  <TableHead className="text-xs text-right">ADG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breedBenchmarks.map((b) => (
                  <TableRow key={b.breed}>
                    <TableCell className="font-semibold text-xs">{b.breed}</TableCell>
                    <TableCell className="text-center text-xs">{b.animalCount}</TableCell>
                    <TableCell className="text-right text-xs">{b.avgWeightKg} kg</TableCell>
                    <TableCell className="text-right text-xs font-bold">+{b.avgAdgKg.toFixed(2)} kg/d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="p-3 pb-1 flex flex-row items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-xs font-bold uppercase text-emerald-700">Top 5 Gainers</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {top.map((p, idx) => (
              <div key={p.cattleId} className="flex justify-between p-1.5 rounded-lg bg-card/70 text-xs">
                <span>#{idx + 1} Tag #{p.tagId} ({p.breed})</span>
                <span className="font-bold text-emerald-600">+{(p.recent30dAdgKg || p.overallAdgKg).toFixed(2)} kg/d</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-rose-500/30 bg-rose-500/5">
          <CardHeader className="p-3 pb-1 flex flex-row items-center gap-1.5">
            <BrainCircuit className="h-4 w-4 text-rose-500" />
            <CardTitle className="text-xs font-bold uppercase text-rose-700">Lowest Gainers</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {bottom.map((p, idx) => (
              <div key={p.cattleId} className="flex justify-between p-1.5 rounded-lg bg-card/70 text-xs">
                <span>#{idx + 1} Tag #{p.tagId} ({p.penName})</span>
                <span className="font-bold text-rose-600">+{(p.recent30dAdgKg || p.overallAdgKg).toFixed(2)} kg/d</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
