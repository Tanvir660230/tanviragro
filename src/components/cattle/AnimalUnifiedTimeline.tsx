"use client";

import { useState } from "react";
import {
  Scale,
  Syringe,
  HeartPulse,
  Sparkles,
  DollarSign,
  Skull,
  Search,
  History,
  Tag,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnifiedTimelineEvent, TimelineEventCategory } from "@/lib/livestock/types";
import { useL } from "@/i18n/text";

interface Props {
  events: UnifiedTimelineEvent[];
  cattleTag: string;
}

export function AnimalUnifiedTimeline({ events }: Props) {
  const L = useL();
  const [selectedCategory, setSelectedCategory] = useState<TimelineEventCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories: Array<{ key: TimelineEventCategory; label: string }> = [
    { key: "all", label: L("সব", "All events") },
    { key: "lifecycle", label: L("জীবনচক্র", "Lifecycle") },
    { key: "growth", label: L("বৃদ্ধি", "Growth") },
    { key: "health", label: L("স্বাস্থ্য", "Health") },
    { key: "breeding", label: L("প্রজনন", "Breeding") },
    { key: "financial", label: L("টাকা", "Financial") },
  ];

  const filteredEvents = events.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.eventType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "BIRTH":
      case "BREEDING":
      case "CALVING":
      case "PREGNANCY_CONFIRMED":
        return <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      case "PURCHASE":
      case "SALE":
        return <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "WEIGHT_ENTRY":
        return <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "VACCINATION":
        return <Syringe className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
      case "TREATMENT":
      case "DISEASE_DIAGNOSED":
        return <HeartPulse className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "DEATH":
        return <Skull className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />;
      case "STATUS_CHANGE":
        return <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Tag className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => {
            const count =
              c.key === "all"
                ? events.length
                : events.filter((e) => e.category === c.key).length;
            const isSelected = selectedCategory === c.key;

            return (
              <Button
                key={c.key}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(c.key)}
                className={cn(
                  "h-7 text-xs px-2.5 rounded-full font-medium transition-colors",
                  isSelected ? "shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label}
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.2 text-[10px]",
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={L("খুঁজুন…", "Search events...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Timeline List */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border bg-card/50 text-center">
          <History className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-semibold text-foreground">{L("কিছু পাওয়া যায়নি", "No timeline events found")}</p>
          <p className="text-[11px] text-muted-foreground">{L("এই ধরনে বা খোঁজায় কিছু নেই।", "No events match the selected category or search.")}</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="relative group">
              <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border shadow-2xs">
                {getEventIcon(evt.eventType)}
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{evt.title}</span>
                    <Badge variant="secondary" className={cn("text-[10px] font-semibold uppercase px-2 py-0", evt.badgeColor)}>
                      {evt.eventType.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                    <Clock className="h-3 w-3" />
                    <span>{evt.timestamp}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{evt.description}</p>
                {evt.actor && (
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{L("লিখেছেন", "Recorded by")}:</span>
                    <span>{evt.actor.role || L("ব্যবহারকারী", "User")}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}