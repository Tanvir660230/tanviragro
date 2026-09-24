/**
 * Homepage model (pure, no I/O): everything the home screen shows, computed from sources that
 * the numerical audit verified — the feed engine (actual feed per animal/day, stock, days left),
 * measured growth (estimates never produce official gain), direct costs, treatments, the latest
 * market price and the accounting engine (cash, month's operating expenses).
 * Every estimate is labelled as such; nothing is guessed when data is missing.
 */
import { feedCostBetween, type AnimalFeed, type FeedSnapshot } from "@/lib/feed/usage-engine";
import { measuredGrowth, measuredLogs } from "@/lib/growth/baseline";

export type WeightBasis = "measured" | "projected" | "estimated" | "none";

export type HomeCattleInput = {
  id: string;
  tag: string;
  purchaseDate: string;
  purchasePrice: number;
  initialWeightKg: number | null;
  initialWeightType: "measured" | "estimated" | "unknown" | null;
  targetWeightKg: number | null;
  logs: { date: string; kg: number; type: "measured" | "estimated" }[];
};

export type HomeFeedItem = {
  id: string; name: string; unit: string; stockQty: number; daysLeft: number | null; inUse: boolean;
};

export type HomeInput = {
  today: string;                 // YYYY-MM-DD (Asia/Dhaka)
  nextEid: string | null;        // YYYY-MM-DD
  cattle: HomeCattleInput[];
  feed: FeedSnapshot;
  feedItems: HomeFeedItem[];
  directCostByCattle: Record<string, number>;   // cost entries tied to the animal + vet treatments
  marketPricePerKg: number | null;               // live weight, latest entered
  cash: number | null;
  monthOperatingExpenses: number | null;
  healthDue: { cattleTag: string | null; title: string; date: string }[];
};

export type HomeCattle = {
  id: string; tag: string; daysOnFarm: number;
  weightKg: number | null; weightBasis: WeightBasis; lastWeighed: string | null; daysSinceWeighed: number | null;
  adgKg: number | null;                      // measured only
  costSoFar: number; feedCost: number;
  valueToday: number | null; profitToday: number | null;   // estimates (weight × today's price)
  readyToSell: boolean;
  eid: { weightKg: number; value: number | null; profit: number | null } | null;
};

export type AttentionKind = "feed_low" | "feed_not_started" | "feed_unreconciled" | "health_overdue" | "health_due" | "weigh" | "price";
export type Attention = { kind: AttentionKind; severity: "urgent" | "soon"; title: string; detail: string; href: string };

export type HomeModel = {
  today: string;
  attention: Attention[];
  money: {
    cash: number | null;
    monthOperatingExpenses: number | null;
    herdCost: number;
    herdValue: number | null;
    herdProfit: number | null;
  };
  cattle: HomeCattle[];
  feed: {
    items: HomeFeedItem[];
    monthActual: number;
    monthRunning: number;
    dailyPerHead: number | null;     // last 30 days of actual feed ÷ heads ÷ 30
  };
  eid: { date: string; daysLeft: number; tooFar: boolean; projectedValue: number | null; projectedProfit: number | null } | null;
};

const DAY = 86400000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export const WEIGH_EVERY_DAYS = 14;
export const FEED_LOW_DAYS = 7;
export const READY_ROI = 0.12;   // same rule as the herd valuation
/** Beyond this, a straight-line gain projection to Eid is too far out to be meaningful. */
export const EID_PROJECTION_DAYS = 120;

/** Recent actual daily feed cost of one animal (last 30 days, or since it arrived). */
function dailyFeedCost(f: AnimalFeed | undefined, today: string, arrived: string): number {
  const from = arrived > addDays(today, -29) ? arrived : addDays(today, -29);
  const n = days(from, today) + 1;
  return n > 0 ? feedCostBetween(f, from, today) / n : 0;
}

export function buildHomeModel(input: HomeInput): HomeModel {
  const { today, feed, marketPricePerKg: price } = input;
  const eidDays = input.nextEid ? days(today, input.nextEid) : null;

  const cattle: HomeCattle[] = input.cattle.map((c) => {
    const logs = c.logs.map((l) => ({ weight_kg: l.kg, recorded_at: l.date, weight_type: l.type }));
    const measured = measuredLogs(logs);
    const growth = measuredGrowth({ initial_weight_kg: c.initialWeightKg, initial_weight_type: c.initialWeightType, purchase_date: c.purchaseDate }, logs);
    const adg = growth ? growth.adg : null;
    const last = measured.at(-1);

    // today's weight: last weighing (+ measured ADG × days since, labelled "projected");
    // with no weighing at all, the purchase weight, labelled by its own type
    let weightKg: number | null = null;
    let weightBasis: WeightBasis = "none";
    let lastWeighed: string | null = null;
    if (last) {
      lastWeighed = last.recorded_at.slice(0, 10);
      const since = days(lastWeighed, today);
      if (adg != null && adg > 0 && since > 0) { weightKg = Number(last.weight_kg) + adg * since; weightBasis = "projected"; }
      else { weightKg = Number(last.weight_kg); weightBasis = "measured"; }
    } else if (c.initialWeightKg) {
      weightKg = c.initialWeightKg;
      weightBasis = c.initialWeightType === "measured" ? "measured" : "estimated";
    }

    const f = feed.perAnimal[c.id];
    const feedCost = f?.actual ?? 0;
    const costSoFar = c.purchasePrice + feedCost + (input.directCostByCattle[c.id] ?? 0);
    const valueToday = price && weightKg ? weightKg * price : null;
    const profitToday = valueToday != null ? valueToday - costSoFar : null;
    const readyToSell = (c.targetWeightKg != null && weightKg != null && weightKg >= c.targetWeightKg)
      || (profitToday != null && costSoFar > 0 && profitToday / costSoFar >= READY_ROI);

    let eid: HomeCattle["eid"] = null;
    if (eidDays != null && eidDays > 0 && eidDays <= EID_PROJECTION_DAYS && weightKg != null && adg != null && adg > 0) {
      const w = weightKg + adg * eidDays;
      const value = price ? w * price : null;
      const costAtEid = costSoFar + dailyFeedCost(f, today, c.purchaseDate) * eidDays;
      eid = { weightKg: w, value, profit: value != null ? value - costAtEid : null };
    }

    return {
      id: c.id, tag: c.tag, daysOnFarm: Math.max(0, days(c.purchaseDate, today)),
      weightKg, weightBasis, lastWeighed, daysSinceWeighed: lastWeighed ? days(lastWeighed, today) : null,
      adgKg: adg, costSoFar, feedCost, valueToday, profitToday, readyToSell, eid,
    };
  });

  // ── what needs doing ──
  const attention: Attention[] = [];
  // health: one line for overdue, one for due within 3 days (never a flood of rows)
  const overdueH = input.healthDue.filter((h) => h.date < today);
  const dueH = input.healthDue.filter((h) => h.date >= today);
  const list = (hs: typeof input.healthDue) => hs.slice(0, 3).map((h) => `${h.cattleTag ? `${h.cattleTag}: ` : ""}${h.title}`).join(", ");
  if (overdueH.length) attention.push({ kind: "health_overdue", severity: "urgent", title: list(overdueH), detail: String(overdueH.length), href: "/dashboard/health/vaccinations" });
  if (dueH.length) attention.push({ kind: "health_due", severity: "soon", title: list(dueH), detail: String(dueH.length), href: "/dashboard/health/vaccinations" });
  for (const i of input.feedItems) {
    if (i.inUse && i.daysLeft != null && i.daysLeft <= FEED_LOW_DAYS) {
      attention.push({ kind: "feed_low", severity: i.daysLeft <= 2 ? "urgent" : "soon", title: i.name, detail: String(i.daysLeft), href: "/dashboard/inventory/purchase" });
    }
  }
  const notStarted = input.feedItems.filter((i) => !i.inUse && i.stockQty > 0);
  if (notStarted.length) {
    attention.push({ kind: "feed_not_started", severity: "soon", title: notStarted.map((i) => i.name).join(", "), detail: String(notStarted.length), href: "/dashboard/inventory/usage" });
  }
  if (feed.totals.unreconciledLines > 0) {
    attention.push({ kind: "feed_unreconciled", severity: "urgent", title: "", detail: String(feed.totals.unreconciledLines), href: "/dashboard/inventory/usage" });
  }
  const toWeigh = cattle.filter((c) => c.daysSinceWeighed == null || c.daysSinceWeighed > WEIGH_EVERY_DAYS);
  if (toWeigh.length) {
    attention.push({ kind: "weigh", severity: "soon", title: toWeigh.map((c) => c.tag).join(", "), detail: String(toWeigh.length), href: "/dashboard/cattle/growth" });
  }
  if (!price && cattle.length) {
    attention.push({ kind: "price", severity: "soon", title: "", detail: "", href: "/dashboard/finance" });
  }
  attention.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "urgent" ? -1 : 1));

  // ── money ──
  const herdCost = cattle.reduce((s, c) => s + c.costSoFar, 0);
  const allValued = cattle.length > 0 && cattle.every((c) => c.valueToday != null);
  const herdValue = allValued ? cattle.reduce((s, c) => s + (c.valueToday ?? 0), 0) : null;

  // ── feed ──
  const month = today.slice(0, 7);
  const heads = input.cattle.length;
  let last30 = 0;
  for (const c of input.cattle) last30 += feedCostBetween(feed.perAnimal[c.id], addDays(today, -29), today);

  // ── Eid ──
  const eidCattle = cattle.filter((c) => c.eid);
  const eidComplete = eidCattle.length === cattle.length && cattle.length > 0;
  const eid = input.nextEid && eidDays != null && eidDays >= 0 ? {
    date: input.nextEid, daysLeft: eidDays, tooFar: eidDays > EID_PROJECTION_DAYS,
    projectedValue: eidComplete && eidCattle.every((c) => c.eid!.value != null) ? eidCattle.reduce((s, c) => s + c.eid!.value!, 0) : null,
    projectedProfit: eidComplete && eidCattle.every((c) => c.eid!.profit != null) ? eidCattle.reduce((s, c) => s + c.eid!.profit!, 0) : null,
  } : null;

  return {
    today,
    attention,
    money: {
      cash: input.cash,
      monthOperatingExpenses: input.monthOperatingExpenses,
      herdCost,
      herdValue,
      herdProfit: herdValue != null ? herdValue - herdCost : null,
    },
    cattle: cattle.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true })),
    feed: {
      items: [...input.feedItems].filter((i) => i.stockQty > 0 || i.inUse)
        .sort((a, b) => Number(b.inUse) - Number(a.inUse) || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9)),
      monthActual: feed.byMonth[month]?.actual ?? 0,
      monthRunning: feed.byMonth[month]?.estimated ?? 0,
      dailyPerHead: heads ? last30 / heads / 30 : null,
    },
    eid,
  };
}
