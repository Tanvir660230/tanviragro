"use client";

import { Scale, HeartPulse, Stethoscope, ShoppingBag, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeightLog, HealthEvent } from "@/types/database";
import type { CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import { useTranslation } from "@/i18n/I18nProvider";

type TimelineEvent = {
  id: string;
  date: string;
  type: "purchase" | "weight" | "health" | "treatment" | "status";
  title: string;
  description?: string;
  value?: string;
};

interface Props {
  purchaseDate: string;
  purchasePrice: number;
  initialWeight: number;
  weights: Pick<WeightLog, "id" | "recorded_at" | "weight_kg" | "notes">[];
  healthEvents: HealthEvent[];
  treatments: CattleTreatment[];
  status?: string;
  updatedAt?: string | null;
}

export function LifeCycleTimeline({
  purchaseDate,
  purchasePrice,
  initialWeight,
  weights,
  healthEvents,
  treatments,
  status,
  updatedAt,
}: Props) {
  const { t } = useTranslation();
  const events: TimelineEvent[] = [];

  // Purchase event
  events.push({
    id: "purchase",
    date: purchaseDate,
    type: "purchase",
    title: t.cattle_details.timeline.purchased,
    description: t.cattle_details.timeline.started_at.replace("{{weight}}", String(initialWeight)),
    value: `?${purchasePrice.toLocaleString("en-IN")}`,
  });

  // Weight logs
  weights.forEach((w) => {
    // skip the initial weight if it matches purchase date to avoid duplicate clutter
    if (w.recorded_at.startsWith(purchaseDate) && w.weight_kg === initialWeight) return;
    events.push({
      id: `w-${w.id}`,
      date: w.recorded_at.split("T")[0],
      type: "weight",
      title: t.cattle_details.timeline.weight_recorded,
      description: w.notes || undefined,
      value: `${w.weight_kg} kg`,
    });
  });

  // Health events
  healthEvents.forEach((h) => {
    if (h.completed_at !== null && h.completed_at !== undefined) {
      events.push({
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
    events.push({
      id: `t-${tr.id}`,
      date: tr.treated_at.split("T")[0],
      type: "treatment",
      title: t.cattle_details.timeline.medical_treatment,
      description: `Dose: ${tr.dose_administered ?? 0} ${tr.dose_unit ?? "unit"}. ${tr.notes || ""}`,
      value: totalCost > 0 ? `Cost: ?${totalCost}` : undefined,
    });
  });

  // Status event (if not active)
  if (status && status !== "active" && updatedAt) {
    let title = t.cattle_details.timeline.status_changed;
    let desc = "";
    if (status === "sold") { title = t.cattle_details.timeline.sold; desc = t.cattle_details.timeline.cattle_sold; }
    else if (status === "dead") { title = t.cattle_details.timeline.deceased; desc = t.cattle_details.timeline.cattle_died; }
    else if (status === "stolen") { title = t.cattle_details.timeline.stolen; desc = t.cattle_details.timeline.cattle_stolen; }

    events.push({
      id: "status-change",
      date: updatedAt.split("T")[0],
      type: "status",
      title,
      description: desc,
    });
  }

  // Sort by date ascending (oldest first, like a real timeline)
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
          <ArrowRight className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-sm font-semibold">{t.cattle_details.timeline.title}</h2>
      </div>

      <div className="px-4 sm:px-5 py-4">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.cattle_details.timeline.no_events}</p>
      ) : (
        <div className="relative pl-3 sm:pl-0">
          {/* Vertical connecting line */}
          <div className="absolute left-[19px] sm:left-1/2 top-2 bottom-2 w-px bg-border -translate-x-1/2" />

          <div className="space-y-6 sm:space-y-8">
            {events.map((event, index) => {
              const isEven = index % 2 === 0;

              return (
                <div key={event.id} className="relative flex items-center sm:justify-center">
                  {/* Desktop Content Left / Mobile Right */}
                  <div
                    className={cn(
                      "w-[calc(100%-2.5rem)] sm:w-[calc(50%-2rem)] ml-10 sm:ml-0",
                      isEven ? "sm:text-right sm:pr-4" : "sm:pl-4 sm:order-last"
                    )}
                  >
                    <div className="bg-muted/30 hover:bg-muted/50 transition-colors border border-border rounded-lg p-3 shadow-card inline-block w-full sm:w-auto sm:max-w-xs text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span className="text-xs font-semibold capitalize text-foreground/80">{event.type}</span>
                      </div>
                      <h4 className="font-semibold text-sm">{event.title}</h4>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                      )}
                      {event.value && (
                        <div className="mt-2 inline-flex items-center rounded-md bg-background px-2 py-1 text-xs font-medium ring-1 ring-inset ring-border">
                          {event.value}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Icon Center */}
                  <div
                    className={cn("absolute left-0 sm:left-1/2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-card shadow-lg -translate-x-1/2", COLORS[event.type])}
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
