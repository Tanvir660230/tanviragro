/**
 * One cost and one result per animal, everywhere (pure, no I/O).
 *
 * The home model counts an animal's cost as purchase + its feed + its own costs; the farm
 * position (lib/partners/position.ts — the rule the owner chose: running costs shared day by
 * day, taka × days) adds its share of the farm's running costs (wages, rent, utilities,
 * depreciation, feed not recorded on it). The homepage, the cattle list and an animal's page
 * showed the first; the partners and Money pages the second — two profits for one animal.
 * This puts the farm position's figures into the home model, so every page shows the same.
 */
import type { HomeModel } from "@/lib/home/home-model";
import { READY_ROI } from "@/lib/home/home-model";
import type { FarmPosition } from "@/lib/partners/position";

export function alignHomeWithFarm(model: HomeModel, farm: FarmPosition | null | undefined): HomeModel {
  if (!farm) return model;
  const byId = new Map(farm.animals.map((a) => [a.id, a]));
  const eidDays = model.eid?.daysLeft ?? null;

  const cattle = model.cattle.map((c) => {
    const a = byId.get(c.id);
    if (!a) return c;
    const costSoFar = a.fullCost;
    const profitToday = c.valueToday != null ? c.valueToday - costSoFar : null;
    const readyToSell = c.targetReached || (profitToday != null && costSoFar > 0 && profitToday / costSoFar >= READY_ROI);
    // at Eid: the value there, less the cost so far plus the farm's running cost per head per day
    const eid = c.eid && eidDays != null
      ? { ...c.eid, profit: c.eid.value != null ? c.eid.value - (costSoFar + farm.costPerHeadDay * eidDays) : null }
      : c.eid;
    return { ...c, costSoFar, profitToday, readyToSell, eid };
  });

  const eidCattle = cattle.filter((c) => c.eid);
  return {
    ...model,
    cattle,
    money: {
      ...model.money,
      herdCost: cattle.reduce((s, c) => s + c.costSoFar, 0),
      // "if every animal were sold today" — the same figure as the Money and partners pages
      herdProfit: model.money.herdValue != null ? farm.total : null,
    },
    eid: model.eid ? {
      ...model.eid,
      projectedProfit: model.eid.projectedProfit != null && eidCattle.every((c) => c.eid!.profit != null)
        ? eidCattle.reduce((s, c) => s + c.eid!.profit!, 0) : null,
    } : null,
  };
}
