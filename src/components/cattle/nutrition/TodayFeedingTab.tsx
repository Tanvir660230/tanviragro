"use client";

import Link from "next/link";
import {
  Wheat,
  Clock,
  CheckCircle2,
  ChevronRight,
  Search,
  Flame,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  type FeedingSlot,
  type CattleNutritionState,
} from "@/lib/nutrition/nutrition-engine";

interface TodayFeedingTabProps {
  selectedSlot: FeedingSlot;
  onSelectSlot: (slot: FeedingSlot) => void;
  filteredCattle: (CattleNutritionState & { penName?: string })[];
  animalRequirements: Map<string, any>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function TodayFeedingTab({
  selectedSlot,
  onSelectSlot,
  filteredCattle,
  animalRequirements,
  searchQuery,
  onSearchChange,
}: TodayFeedingTabProps) {
  const slots = [
    { slot: "morning" as const, label: "Morning Ration", time: "07:00 AM", share: "40% Concentrate", icon: Flame, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
    { slot: "noon" as const, label: "Noon Roughage", time: "12:30 PM", share: "50% Straw/Hay", icon: Wheat, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { slot: "evening" as const, label: "Evening Ration", time: "05:30 PM", share: "40% Concentrate", icon: Utensils, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
    { slot: "night" as const, label: "Night Top-Up", time: "09:00 PM", share: "20% Roughage + Buffer", icon: Clock, color: "text-indigo-500", bg: "bg-indigo-500/10 border-indigo-500/20" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {slots.map((s) => {
          const Icon = s.icon;
          const isSelected = selectedSlot === s.slot;
          return (
            <div
              key={s.slot}
              onClick={() => onSelectSlot(s.slot)}
              className={cn(
                "p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden",
                isSelected
                  ? "ring-2 ring-emerald-500 bg-card shadow-md"
                  : "bg-card/60 hover:bg-card/90"
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-lg border", s.bg)}>
                  <Icon className={cn("h-4 w-4", s.color)} />
                </div>
                <Badge variant={isSelected ? "default" : "outline"} className="text-[10px] uppercase">
                  {s.slot}
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm text-foreground">{s.label}</h3>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground">Herd Feeding Matrix ({filteredCattle.length} Head)</h3>
            <p className="text-xs text-muted-foreground">
              Individual targets computed based on ADG target, weight tier, and acclimatization.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Tag, Breed, Pen..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Cattle Tag</th>
                <th className="py-3 px-3 font-semibold">Weight & ADG</th>
                <th className="py-3 px-3 font-semibold text-right">Target DMI</th>
                <th className="py-3 px-3 font-semibold text-right text-amber-600 dark:text-amber-400">Concentrate</th>
                <th className="py-3 px-3 font-semibold text-right text-emerald-600 dark:text-emerald-400">Roughage</th>
                <th className="py-3 px-3 font-semibold text-right">Est. Cost</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredCattle.map((c) => {
                const req = animalRequirements.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      <Link href={`/dashboard/cattle/${c.id}`} className="hover:underline flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span>#{c.tagId}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                      <span className="block text-[10px] font-sans font-normal text-muted-foreground">
                        {c.breed || "Standard"} · {c.gender}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium">
                      <span>{c.currentWeightKg} kg</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Target ADG: +{c.expectedDailyGainKg} kg/d
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {req?.dailyDmiKg} kg
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {req?.targetConcentrateKg} kg
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {req?.targetRoughageKg} kg
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      ৳{req?.estimatedDailyCostBdt}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {req?.isAcclimatizing ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/40">
                          Acclimatizing ({(req.acclimatizationFactor * 100).toFixed(0)}%)
                        </Badge>
                      ) : c.isQuarantined ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Quarantined
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Standard Diet
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> {s.time} · {s.share}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs pt-2 border-t border-border/40">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
