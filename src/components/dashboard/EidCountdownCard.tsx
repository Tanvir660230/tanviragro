import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { cn } from "@/lib/utils";
import { Moon } from "lucide-react";
import { EidCattleList } from "@/components/dashboard/EidCattleList";

// Approximate Eid-ul-Adha dates (Bangladesh moon sighting)
const EID_DATES = [
  new Date("2025-06-06"),
  new Date("2026-05-27"),
  new Date("2027-05-16"),
  new Date("2028-05-05"),
  new Date("2029-04-24"),
  new Date("2030-04-13"),
  new Date("2031-04-03"),
  new Date("2032-03-22"),
];

function getNextEid(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const next = EID_DATES.find((d) => d > now);
  if (next) return next;
  // Fallback: shift last known date by ~354 days (Islamic year)
  const last = EID_DATES[EID_DATES.length - 1];
  const est = new Date(last);
  est.setDate(est.getDate() + 354);
  return est;
}

function linearADG(
  logs: { cattle_id: string; weight_kg: number; recorded_at: string }[],
  initialWeight: number,
  purchaseDate: string
): number {
  const base = new Date(purchaseDate + "T00:00:00").getTime();
  const points = [
    { x: 0, y: initialWeight },
    ...logs.map((l) => ({
      x: Math.max(0, Math.floor((new Date(l.recorded_at).getTime() - base) / 86400000)),
      y: l.weight_kg,
    })),
  ];
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return 0;
  const slope = (n * sumXY - sumX * sumY) / denom;
  return Math.min(Math.max(slope, -5), 5);
}

export async function EidCountdownCard() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  // If no business, silently hide
  if (!businessId) return null;

  const t = await getDictionary();
  const eid = t.eid;

  const eidDate = getNextEid();
  // Use Bangladesh timezone (UTC+6) for today's date so countdown is accurate
  const todayBDStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // "YYYY-MM-DD"
  const today = new Date(todayBDStr + "T00:00:00");
  const daysToEid = Math.ceil((eidDate.getTime() - today.getTime()) / 86400000);

  // If Eid is more than 90 days away, silently hide the card to declutter the dashboard
  if (daysToEid > 90) return null;

  // Step 1: get active cattle (IDs needed to scope weight_logs without unsafe join)
  const { data: activeCattle } = await supabase
    .from("cattle")
    .select("id, tag_id, breed, gender, purchase_date, initial_weight_kg, purchase_price")
    .eq("business_id", businessId)
    .eq("status", "active");

  const activeIds = (activeCattle ?? []).map((c) => c.id);

  // Step 2: weight_logs scoped via .in("cattle_id") â€" no join needed
  const { data: weightLogs } = activeIds.length > 0
    ? await supabase
        .from("weight_logs")
        .select("cattle_id, weight_kg, recorded_at")
        .in("cattle_id", activeIds)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: true })
    : { data: [] as { cattle_id: string; weight_kg: number; recorded_at: string }[] };

  type CattleRow = {
    id: string;
    tag_id: string;
    breed: string | null;
    gender: string;
    purchase_date: string;
    initial_weight_kg: number;
    purchase_price: number;
  };
  type LogRow = { cattle_id: string; weight_kg: number; recorded_at: string };

  const cattle = (activeCattle ?? []) as CattleRow[];
  const logs = (weightLogs ?? []) as LogRow[];

  // Group logs by cattle
  const logsByCattle: Record<string, LogRow[]> = {};
  for (const l of logs) {
    if (!logsByCattle[l.cattle_id]) logsByCattle[l.cattle_id] = [];
    logsByCattle[l.cattle_id].push(l);
  }

  // Compute projected weight at Eid for each cattle
  const projections = cattle.map((c) => {
    const cattleLogs = logsByCattle[c.id] ?? [];
    const latestWt = cattleLogs.at(-1)?.weight_kg ?? c.initial_weight_kg;
    const daysInPen = Math.floor(
      (today.getTime() - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000
    );
    const adg = linearADG(cattleLogs, c.initial_weight_kg, c.purchase_date);
    const projectedWt = Math.min(650, Math.max(0, latestWt + adg * daysToEid));
    const isReady = projectedWt >= 250 && daysInPen + daysToEid >= 90;
    return { id: c.id, tag: c.tag_id, currentWt: latestWt, projectedWt, adg, daysInPen, isReady };
  });

  const readyCount = projections.filter((p) => p.isReady).length;
  const eidYear = eidDate.getFullYear();
  const eidLabel = eidDate.toLocaleDateString("en-US", {
    timeZone: "Asia/Dhaka",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const urgency = daysToEid <= 30 ? "critical" : daysToEid <= 90 ? "warning" : "info";

  return (
    <div className={cn(
      "rounded-xl border shadow-card overflow-hidden",
      urgency === "critical" ? "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20"
        : urgency === "warning" ? "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
        : "border-border bg-card"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-inherit">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          urgency === "critical" ? "bg-red-500/10" : urgency === "warning" ? "bg-amber-500/10" : "bg-emerald-500/10"
        )}>
          <Moon className={cn(
            "h-4 w-4",
            urgency === "critical" ? "text-red-600 dark:text-red-400"
              : urgency === "warning" ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          )} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {eid.title} {eidYear}
          </p>
          <p className="text-xs text-muted-foreground">{eidLabel}</p>
        </div>
        <div className="text-right">
          <p className={cn(
            "text-2xl font-bold tabular-nums",
            urgency === "critical" ? "text-red-600 dark:text-red-400"
              : urgency === "warning" ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}>
            {daysToEid}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {eid.days_left}
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="px-3 py-3 text-center">
          <p className="text-xl font-bold tabular-nums">{cattle.length}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
            {eid.active}
          </p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {readyCount}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
            {eid.ready}
          </p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {cattle.length - readyCount}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
            {eid.attention}
          </p>
        </div>
      </div>

      {/* Per-cattle list â€" only shown within 90 days of Eid */}
      {projections.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{eid.no_cattle}</p>
      ) : daysToEid <= 90 ? (
        <EidCattleList
          projections={projections}
          labels={{
            more_cattle: eid.more_cattle,
            no_weight_data: eid.no_weight_data,
            status_ready: eid.status_ready,
            status_developing: eid.status_developing,
            status_at_risk: eid.status_at_risk,
          }}
        />
      ) : (
        <p className="px-5 py-3 text-xs text-muted-foreground italic">{eid.list_available_soon}</p>
      )}

      {/* Note */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground">{eid.note}</p>
      </div>
    </div>
  );
}
