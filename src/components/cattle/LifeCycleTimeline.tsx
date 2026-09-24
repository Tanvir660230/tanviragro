"use client";

import { useState, useMemo } from "react";
import { Scale, HeartPulse, Stethoscope, ShoppingBag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeightLog, HealthEvent } from "@/types/database";
import type { CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtBDT } from "@/lib/format";

type TimelineType = "purchase" | "weight" | "health" | "treatment" | "status";

type TimelineEvent = {
  id: string;
  date: string;
  type: TimelineType;
  title: string;
  description?: string;
  value?: string;
};

interface Props {
  purchaseDate: string;
  purchasePrice: number;
  initialWeight: number;
  /** measured | estimated | unknown */
  initialWeightType?: string | null;
  weights: Pick<WeightLog, "id" | "recorded_at" | "weight_kg" | "notes" | "weight_type">[];
  healthEvents: HealthEvent[];
  treatments: CattleTreatment[];
  status?: string;
  updatedAt?: string | null;
}

export function LifeCycleTimeline({
  purchaseDate,
  purchasePrice,
  initialWeight,
  initialWeightType,
  weights,
  healthEvents,
  treatments,
  status,
  updatedAt,
}: Props) {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<TimelineType | "all">("all");

  const events: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = [];

    // Purchase event
    list.push({
      id: "purchase",
      date: purchaseDate,
      type: "purchase",
      title: t.cattle_details.timeline.purchased,
      description: t.cattle_details.timeline.started_at.replace("{{weight}}", String(initialWeight))
        + (initialWeightType === "estimated" ? " (estimated — not weighed)" : ""),
      value: fmtBDT(purchasePrice),
    });

    // Weight logs
    weights.forEach((w) => {
      // skip the initial weight if it matches purchase date to avoid duplicate clutter
      if (w.recorded_at.startsWith(purchaseDate) && w.weight_kg === initialWeight) return;
      list.push({
        id: `w-${w.id}`,
        date: w.recorded_at.split("T")[0],
        type: "weight",
        title: t.cattle_details.timeline.weight_recorded,
        description: w.notes || undefined,
        value: `${w.weight_kg} kg${w.weight_type === "estimated" ? " (estimated)" : ""}`,
      });
    });

    // Health events
    healthEvents.forEach((h) => {
      if (h.completed_at !== null && h.completed_at !== undefined) {
        list.push({
          id: `h-${h.id}`,
          date: h.scheduled_at,
          type: "health",
          title: h.title,
          description: h.notes || undefined,
        });
      }
    });

    // Treatments
    treatments.forEach((tr) => {
      const totalCost = (tr.vet_fee || 0) + (tr.additional_medical_cost || 0);
      list.push({
        id: `t-${tr.id}`,
        date: tr.treated_at.split("T")[0],
        type: "treatment",
        title: t.cattle_details.timeline.medical_treatment,
        description: `Dose: ${tr.dose_administered ?? 0} ${tr.dose_unit ?? "unit"}. ${tr.notes || ""}`,
        value: totalCost > 0 ? `Cost: ${fmtBDT(totalCost)}` : undefined,
      });
    });

    // Status event (if not active)
    if (status && status !== "active" && updatedAt) {
      let title = t.cattle_details.timeline.status_changed;
      let desc = "";
      if (status === "sold") { title = t.cattle_details.timeline.sold; desc = t.cattle_details.timeline.cattle_sold; }
      else if (status === "dead") { title = t.cattle_details.timeline.deceased; desc = t.cattle_details.timeline.cattle_died; }
      else if (status === "stolen") { title = t.cattle_details.timeline.stolen; desc = t.cattle_details.timeline.cattle_stolen; }

      list.push({
        id: "status-change",
        date: updatedAt.split("T")[0],
        type: "status",
        title,
        description: desc,
      });
    }

    // Sort by date ascending (oldest first, like a real timeline)
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return list;
  }, [purchaseDate, purchasePrice, initialWeight, initialWeightType, weights, healthEvents, treatments, status, updatedAt, t]);

  const filteredEvents = useMemo(() => {
    if (filterType === "all") return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  const ICONS: Record<TimelineEvent["type"], React.ReactNode> = {
    purchase: <ShoppingBag className="h-4 w-4 text-white" />,
    weight: <Scale className="h-4 w-4 text-white" />,
    health: <HeartPulse className="h-4 w-4 text-white" />,
    treatment: <Stethoscope className="h-4 w-4 text-white" />,
    status: <ArrowRight className="h-4 w-4 text-white" />,
  };

  const COLORS: Record<TimelineEvent["type"], string> = {
    purchase: "bg-indigo-500 shadow-indigo-500/30",
    weight: "bg-emerald-500 shadow-emerald-500/30",
    health: "bg-amber-500 shadow-amber-500/30",
    treatment: "bg-red-500 shadow-red-500/30",
    status: "bg-foreground/70 shadow-foreground/20",
  };

  return (
    <div className="rounded-2xl bg-card border border-border/80 shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border/60 bg-muted/20 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
            <ArrowRight className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{t.cattle_details.timeline.title}</h2>
            <p className="text-[11px] text-muted-foreground">{events.length} lifecycle events</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
          {(["all", "purchase", "weight", "health", "treatment"] as const).map((ft) => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap",
                filterType === ft
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {ft}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-5 py-6">
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t.cattle_details.timeline.no_events}
          </div>
        ) : (
          <div className="relative pl-3 sm:pl-0">
            {/* Vertical connecting line */}
            <div className="absolute left-[19px] sm:left-1/2 top-3 bottom-3 w-0.5 bg-border/80 -translate-x-1/2" />

            <div className="space-y-6 sm:space-y-8">
              {filteredEvents.map((event, index) => {
                const isEven = index % 2 === 0;

                return (
                  <div key={event.id} className="relative flex items-center sm:justify-center">
                    {/* Desktop Content Left / Mobile Right */}
                    <div
                      className={cn(
                        "w-[calc(100%-2.5rem)] sm:w-[calc(50%-2rem)] ml-10 sm:ml-0",
                        isEven ? "sm:text-right sm:pr-6" : "sm:pl-6 sm:order-last"
                      )}
                    >
                      <div className="bg-card hover:bg-muted/40 transition-colors border border-border/70 rounded-xl p-3.5 shadow-xs inline-block w-full sm:w-auto sm:max-w-sm text-left">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {event.type}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-foreground">{event.title}</h4>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.description}</p>
                        )}
                        {event.value && (
                          <div className="mt-2.5 inline-flex items-center rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                            {event.value}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Icon Center */}
                    <div
                      className={cn(
                        "absolute left-0 sm:left-1/2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-card shadow-md -translate-x-1/2 shrink-0 z-10",
                        COLORS[event.type]
                      )}
                    >
                      {ICONS[event.type]}
                    </div>

                    {/* Desktop Empty Spacer */}
                    <div className={cn("hidden sm:block sm:w-[calc(50%-2rem)]", isEven && "sm:order-last")} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
