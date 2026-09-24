/**
 * Cattle list ("board") model — pure. Active animals use exactly the homepage calculation
 * (lib/home/home-model.ts), so the homepage, the list and the profile show the same figures.
 * Sold / dead animals get their realised result (sale price − full cost, or the loss).
 */
import { buildHomeModel, WEIGH_EVERY_DAYS, type HomeCattle, type HomeInput } from "@/lib/home/home-model";

export type BoardRow = {
  id: string; tag_id: string; breed: string | null; gender: string | null; status: string;
  purchase_date: string; purchase_price: number; target_weight_kg: number | null;
  is_quarantined: boolean | null; is_qurbani_marked: boolean | null;
  initial_weight_kg?: number | null; initial_weight_type?: string | null;
};
export type HealthEvent = { cattle_id: string; title: string; date: string };
export type Sale = { cattle_id: string; sold_at: string; price: number };

export type BoardAnimal = {
  id: string; tag: string; breed: string | null; gender: string | null; status: string;
  quarantined: boolean; qurbani: boolean;
  metrics: HomeCattle | null;                 // active animals only
  targetWeightKg: number | null;
  series: { date: string; kg: number; type: "measured" | "estimated" }[];
  nextHealth: { title: string; date: string; overdue: boolean } | null;
  realised: { kind: "sold" | "dead"; date: string | null; salePrice: number | null; cost: number; result: number } | null;
};

export type BoardSummary = {
  active: number;
  liveWeightKg: number; weighedCount: number; estimatedCount: number;
  avgAdgKg: number | null;
  herdCost: number; herdValue: number | null; herdProfit: number | null;
  readyCount: number;
};

export type Board = { animals: BoardAnimal[]; summary: BoardSummary };

export const SLOW_ADG_KG = 0.5;
export const HEALTH_SOON_DAYS = 3;

export type BoardFilter = "all" | "ready" | "weigh" | "health" | "slow" | "losing" | "quarantine" | "qurbani" | "past";

export function matchesFilter(a: BoardAnimal, f: BoardFilter, today: string): boolean {
  const m = a.metrics;
  const active = a.status === "active";
  switch (f) {
    case "all": return active;
    case "ready": return active && !!m?.readyToSell;
    case "weigh": return active && (m?.daysSinceWeighed == null || m.daysSinceWeighed > WEIGH_EVERY_DAYS);
    case "health": {
      if (!active || !a.nextHealth) return false;
      const soon = new Date(Date.parse(`${today}T00:00:00Z`) + HEALTH_SOON_DAYS * 86400000).toISOString().slice(0, 10);
      return a.nextHealth.date <= soon;
    }
    case "slow": return active && m?.adgKg != null && m.adgKg < SLOW_ADG_KG;
    case "losing": return active && m?.profitToday != null && m.profitToday < 0;
    case "quarantine": return active && a.quarantined;
    case "qurbani": return active && a.qurbani;
    case "past": return !active;
  }
}

export type BoardSort = "tag" | "profit" | "adg" | "days" | "weight";

export function sortAnimals(list: BoardAnimal[], s: BoardSort): BoardAnimal[] {
  const num = (a: BoardAnimal): number | null => {
    const m = a.metrics;
    if (s === "profit") return m?.profitToday ?? a.realised?.result ?? null;
    if (s === "adg") return m?.adgKg ?? null;
    if (s === "days") return m?.daysOnFarm ?? null;
    if (s === "weight") return m?.weightKg ?? null;
    return null;
  };
  const byTag = (x: BoardAnimal, y: BoardAnimal) => x.tag.localeCompare(y.tag, undefined, { numeric: true });
  if (s === "tag") return [...list].sort(byTag);
  // highest first; animals without the figure last
  return [...list].sort((x, y) => {
    const a = num(x), b = num(y);
    if (a == null && b == null) return byTag(x, y);
    if (a == null) return 1;
    if (b == null) return -1;
    return b - a || byTag(x, y);
  });
}

export function buildBoard(p: {
  home: HomeInput;                       // active animals, as on the homepage
  rows: BoardRow[];                      // every animal (active, sold, dead)
  logs: Record<string, { date: string; kg: number; type: "measured" | "estimated" }[]>;
  feedByAnimal: Record<string, number>;  // actual feed value per animal (feed engine)
  directCostByCattle: Record<string, number>;
  health: HealthEvent[];                 // open (not completed) events, any date
  sales: Sale[];
}): Board {
  const model = buildHomeModel(p.home);
  const metricsById = new Map(model.cattle.map((c) => [c.id, c]));
  const nextHealthBy = new Map<string, HealthEvent>();
  for (const h of [...p.health].sort((a, b) => a.date.localeCompare(b.date))) if (!nextHealthBy.has(h.cattle_id)) nextHealthBy.set(h.cattle_id, h);
  const saleBy = new Map(p.sales.map((s) => [s.cattle_id, s]));

  const animals: BoardAnimal[] = p.rows.map((r) => {
    const h = nextHealthBy.get(r.id);
    let realised: BoardAnimal["realised"] = null;
    if (r.status === "sold" || r.status === "dead") {
      const cost = Number(r.purchase_price ?? 0) + (p.feedByAnimal[r.id] ?? 0) + (p.directCostByCattle[r.id] ?? 0);
      const sale = saleBy.get(r.id);
      realised = r.status === "sold" && sale
        ? { kind: "sold", date: sale.sold_at, salePrice: sale.price, cost, result: sale.price - cost }
        : { kind: r.status === "sold" ? "sold" : "dead", date: null, salePrice: null, cost, result: -cost };
    }
    return {
      id: r.id, tag: r.tag_id, breed: r.breed, gender: r.gender, status: r.status,
      quarantined: !!r.is_quarantined, qurbani: !!r.is_qurbani_marked,
      metrics: r.status === "active" ? metricsById.get(r.id) ?? null : null,
      targetWeightKg: r.target_weight_kg == null ? null : Number(r.target_weight_kg),
      // weight history starts at the purchase weight (hollow when it was only an estimate)
      series: [
        ...(r.initial_weight_kg ? [{ date: r.purchase_date, kg: Number(r.initial_weight_kg), type: (r.initial_weight_type === "estimated" ? "estimated" : "measured") as "measured" | "estimated" }] : []),
        ...(p.logs[r.id] ?? []),
      ].sort((a, b) => a.date.localeCompare(b.date)),
      nextHealth: r.status === "active" && h ? { title: h.title, date: h.date, overdue: h.date < p.home.today } : null,
      realised,
    };
  });

  const active = animals.filter((a) => a.status === "active" && a.metrics);
  const weights = active.map((a) => a.metrics!).filter((m) => m.weightKg != null);
  const adgs = active.map((a) => a.metrics!.adgKg).filter((x): x is number => x != null);
  return {
    animals,
    summary: {
      active: active.length,
      liveWeightKg: weights.reduce((s, m) => s + (m.weightKg ?? 0), 0),
      weighedCount: weights.filter((m) => m.weightBasis === "measured" || m.weightBasis === "projected").length,
      estimatedCount: weights.filter((m) => m.weightBasis === "estimated").length,
      avgAdgKg: adgs.length ? adgs.reduce((s, x) => s + x, 0) / adgs.length : null,
      herdCost: model.money.herdCost,
      herdValue: model.money.herdValue,
      herdProfit: model.money.herdProfit,
      readyCount: active.filter((a) => a.metrics!.readyToSell).length,
    },
  };
}
