"use client";

import { useState } from "react";
import { Clock, Plus, ArrowRight, DollarSign, Package, Stethoscope, Syringe, Landmark, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  type: "cattle_add" | "cattle_sold" | "cost_add" | "inventory_purchase" | "medical_treatment" | "health_event" | "partner_txn" | "loan";
  title: string;
  description: string;
  date: string;
  color: string;
}

const ICON_MAP = {
  cattle_add: Plus,
  cattle_sold: ArrowRight,
  cost_add: DollarSign,
  inventory_purchase: Package,
  medical_treatment: Stethoscope,
  health_event: Syringe,
  partner_txn: Landmark,
  loan: CreditCard,
};

const SHOW_LIMIT = 20;

const dhakaDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });

function groupByDay(activities: ActivityItem[]) {
  const todayKey = dhakaDayFmt.format(new Date());
  const yesterdayKey = dhakaDayFmt.format(new Date(Date.now() - 86400000));

  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const act of activities) {
    const d = new Date(act.date);
    const key = dhakaDayFmt.format(d);
    const label =
      key === todayKey
        ? "Today"
        : key === yesterdayKey
          ? "Yesterday"
          : d.toLocaleDateString("en-US", { timeZone: "Asia/Dhaka", month: "long", day: "numeric", year: "numeric" });

    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(act);
    else groups.push({ key, label, items: [act] });
  }
  return groups;
}

export function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? activities : activities.slice(0, SHOW_LIMIT);

  if (activities.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No recent activity found.
      </div>
    );
  }

  const groups = groupByDay(displayed);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h3>
          <div className="relative space-y-3 pl-9">
            <div className="absolute left-4 top-1 bottom-1 w-0.5 bg-border" />
            {group.items.map((act) => {
              const Icon = ICON_MAP[act.type];
              const dt = new Date(act.date);
              return (
                <div key={act.id} className="relative">
                  <div
                    className={cn(
                      "absolute -left-9 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-card",
                      act.color
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold leading-snug">{act.title}</h4>
                      <time className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {dt.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{act.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!showAll && activities.length > SHOW_LIMIT && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            Show {activities.length - SHOW_LIMIT} more activities
          </button>
        </div>
      )}
    </div>
  );
}
