"use client";

import { useState } from "react";
import { Receipt, ShoppingCart, Stethoscope, Tag } from "lucide-react";
import type { ConsumptionRow } from "@/app/dashboard/(app)/cattle/[id]/page";
import { useTranslation } from "@/i18n/I18nProvider";

interface TreatmentRow {
  vet_fee: number | null;
  additional_medical_cost: number | null;
  treated_at: string;
  diagnosis: string | null;
}

interface IndividualCostRow {
  amount: number;
  category: string;
  description: string | null;
  recorded_at: string;
}

interface Props {
  purchaseDate: string;
  purchasePrice: number;
  consumptions: ConsumptionRow[];
  treatments?: TreatmentRow[];
  individualCosts?: IndividualCostRow[];
  overheadCost?: number;
  allocatedFeedCost?: number;
  allocatedConcentrateKg?: number;
  allocatedRoughageKg?: number;
  activeRoughage?: { id: string; name: string; unit: string } | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateRange(from: string, to: string) {
  if (from === to) return fmtDate(from);
  const f = new Date(from);
  const t = new Date(to);
  if (f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth()) {
    return `${f.getDate()}–${t.getDate()} ${t.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

export function CostTimelineCard({
  purchaseDate,
  purchasePrice,
  consumptions,
  treatments = [],
  individualCosts = [],
  overheadCost = 0,
  allocatedFeedCost = 0,
  allocatedConcentrateKg = 0,
  allocatedRoughageKg = 0,
  activeRoughage = null,
}: Props) {
  // Hooks must be before any early return
  const { t } = useTranslation();
  const [showAllCosts, setShowAllCosts] = useState(false);

  const costedConsumptions = consumptions.filter((c) => c.unit_cost != null && c.unit_cost > 0);

  if (costedConsumptions.length === 0 && purchasePrice === 0 && overheadCost === 0 && allocatedFeedCost === 0) return null;

  type TimelineEvent = {
    sortDate: string;          // for ordering
    displayDate: string;       // what the user sees (may be a range)
    label: string;
    sublabel?: string;
    amount: number;
    icon: "purchase" | "feed" | "medical" | "cost" | "overhead";
  };

  // ── Feed: aggregate by item name ──────────────────────────────────────────
  // Show one row per feed type (total qty + total cost) instead of one row per
  // transaction — otherwise a 90-day feeding history creates 90 identical rows.
  const feedMap = new Map<
    string,
    { name: string; unit: string; totalQty: number; totalAmount: number; firstDate: string; lastDate: string }
  >();
  for (const c of costedConsumptions) {
    const name = c.inventory_items?.name ?? "Feed";
    const unit = c.inventory_items?.unit ?? "kg";
    const date = c.recorded_at.slice(0, 10);
    const existing = feedMap.get(name);
    if (!existing) {
      feedMap.set(name, { name, unit, totalQty: c.qty, totalAmount: c.qty * c.unit_cost!, firstDate: date, lastDate: date });
    } else {
      existing.totalQty += c.qty;
      existing.totalAmount += c.qty * c.unit_cost!;
      if (date < existing.firstDate) existing.firstDate = date;
      if (date > existing.lastDate) existing.lastDate = date;
    }
  }

  const feedEvents: TimelineEvent[] = [...feedMap.values()].map((item) => ({
    sortDate: item.lastDate,
    displayDate: fmtDateRange(item.firstDate, item.lastDate),
    label: item.name,
    sublabel: `${item.totalQty % 1 === 0 ? item.totalQty.toFixed(0) : item.totalQty.toFixed(1)} ${item.unit} total`,
    amount: item.totalAmount,
    icon: "feed" as const,
  }));

  // Only show algorithmic estimate when there are no direct consumption logs.
  // If costed logs exist, the allocated cost would double-count the same feed.
  if (allocatedFeedCost > 0 && costedConsumptions.length === 0) {
    feedEvents.push({
      sortDate: new Date().toISOString().slice(0, 10),
      displayDate: t.cattle_details.smart.to_date_label,
      label: t.cattle_details.smart.auto_feed_label,
      sublabel: `${allocatedConcentrateKg.toFixed(1)} kg Dry, ${allocatedRoughageKg.toFixed(1)} ${activeRoughage?.unit || "kg"} ${t.cattle_details.feed_card.roughage}`,
      amount: allocatedFeedCost,
      icon: "feed" as const,
    });
  }

  // ── Treatments ────────────────────────────────────────────────────────────
  const treatmentEvents: TimelineEvent[] = treatments
    .filter((tr) => (tr.vet_fee ?? 0) + (tr.additional_medical_cost ?? 0) > 0)
    .map((tr) => ({
      sortDate: tr.treated_at.slice(0, 10),
      displayDate: fmtDate(tr.treated_at.slice(0, 10)),
      label: tr.diagnosis ? `Vet: ${tr.diagnosis}` : t.cattle_details.smart.veterinary,
      amount: (tr.vet_fee ?? 0) + (tr.additional_medical_cost ?? 0),
      icon: "medical" as const,
    }));

  // ── Individual costs ──────────────────────────────────────────────────────
  const individualCostEvents: TimelineEvent[] = individualCosts
    .filter((i) => i.amount > 0)
    .map((i) => ({
      sortDate: i.recorded_at.slice(0, 10),
      displayDate: fmtDate(i.recorded_at.slice(0, 10)),
      label: i.description ?? i.category,
      amount: i.amount,
      icon: "cost" as const,
    }));

  // ── Overhead: always last ─────────────────────────────────────────────────
  // Overhead is accumulated gradually, not a one-time payment — placing it at
  // the END of the timeline is more honest than showing it on the purchase date.
  const allSortDates = [
    purchaseDate,
    ...feedEvents.map((e) => e.sortDate),
    ...treatmentEvents.map((e) => e.sortDate),
    ...individualCostEvents.map((e) => e.sortDate),
  ];
  const lastDate = [...allSortDates].sort().at(-1) ?? purchaseDate;

  // ── Assemble and sort ─────────────────────────────────────────────────────
  const events: TimelineEvent[] = [
    {
      sortDate: purchaseDate,
      displayDate: fmtDate(purchaseDate),
      label: t.cattle_details.smart.purchase,
      amount: purchasePrice,
      icon: "purchase" as const,
    },
    ...feedEvents,
    ...treatmentEvents,
    ...individualCostEvents,
    ...(overheadCost > 0
      ? [{
          sortDate: lastDate + "Z",  // "Z" suffix pushes it after any real events on the same day
          displayDate: fmtDate(lastDate),
          label: t.cattle_details.smart.overhead_label,
          sublabel: t.cattle_details.smart.overhead_sub,
          amount: overheadCost,
          icon: "overhead" as const,
        }]
      : []),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  type RowType = TimelineEvent & { running: number };
  const rows = events.reduce<RowType[]>((acc, ev) => {
    const running = (acc.at(-1)?.running ?? 0) + ev.amount;
    return [...acc, { ...ev, running }];
  }, []);
  const grandTotal = rows.at(-1)?.running ?? 0;

  const COST_LIMIT = 5;
  const displayedRows = showAllCosts ? rows : rows.slice(0, COST_LIMIT);

  const iconStyle = (icon: TimelineEvent["icon"]) => {
    if (icon === "purchase")  return "bg-indigo-100 dark:bg-indigo-950 ring-indigo-200 dark:ring-indigo-800";
    if (icon === "feed")      return "bg-amber-100 dark:bg-amber-950 ring-amber-200 dark:ring-amber-800";
    if (icon === "medical")   return "bg-red-100 dark:bg-red-950 ring-red-200 dark:ring-red-800";
    if (icon === "overhead")  return "bg-violet-100 dark:bg-violet-950 ring-violet-200 dark:ring-violet-800";
    return "bg-slate-100 dark:bg-slate-900 ring-slate-200 dark:ring-slate-700";
  };

  const iconEl = (icon: TimelineEvent["icon"]) => {
    if (icon === "purchase") return <ShoppingCart className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />;
    if (icon === "feed")     return <Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
    if (icon === "medical")  return <Stethoscope className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    if (icon === "overhead") return <Tag className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />;
    return <Tag className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />;
  };

  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border bg-indigo-50/40 dark:bg-indigo-950/10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
          <Receipt className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-sm font-semibold flex-1">{t.cattle_details.smart.cost_timeline}</h2>
        <span className="text-sm font-bold tabular-nums text-foreground">
          ৳{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="px-3 sm:px-5 py-4 space-y-4">
      <div className="relative space-y-0">
        {displayedRows.map((row, i) => (
          <div key={i} className="flex gap-3">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-background ${iconStyle(row.icon)}`}>
                {iconEl(row.icon)}
              </div>
              {i < displayedRows.length - 1 && (
                <div className="w-px flex-1 bg-border my-1" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 ${i < displayedRows.length - 1 ? "pb-4" : "pb-0"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{row.label}</p>
                  {row.sublabel && (
                    <p className="text-xs text-muted-foreground">{row.sublabel}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{row.displayDate}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">
                    +৳{row.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    ৳{row.running.toLocaleString("en-IN", { maximumFractionDigits: 0 })} {t.cattle_details.smart.cost_total_suffix}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!showAllCosts && rows.length > COST_LIMIT && (
          <div className="pt-2 text-center">
            <button
              onClick={() => setShowAllCosts(true)}
              className="text-sm text-primary hover:underline font-medium"
            >
              {t.cattle_details.smart.show_more_events.replace("{{n}}", String(rows.length - COST_LIMIT))}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
