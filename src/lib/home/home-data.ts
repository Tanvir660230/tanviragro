import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFeedData } from "@/lib/feed/feed-data";
import { getAccountingData } from "@/lib/accounting/engine";
import { capitalSummary } from "@/lib/money/summary";
import { addDays, startOfMonth, todayDhaka } from "@/lib/dates";
import { nextEidDate } from "@/lib/home/eid";
import { buildHomeModel, type HomeInput, type HomeModel } from "@/lib/home/home-model";
import { alignHomeWithFarm } from "@/lib/home/farm-align";
import type { FarmPosition } from "@/lib/partners/position";
import type { FeedData } from "@/lib/feed/feed-data";
import { AuthError, ForbiddenError } from "@/lib/errors/app-error";

export type HomeInputs = { input: HomeInput; feed: FeedData; directCostByCattle: Record<string, number> };

/**
 * Loads the homepage from the verified sources; money figures are omitted without accounting
 * access. Each animal's cost and the herd's result come from the farm position (the same as the
 * Money and partners pages) when the viewer may see it.
 */
export async function loadHomeModel(supabase: SupabaseClient<any>, businessId: string, today = todayDhaka()): Promise<HomeModel> {
  const [inputs, farm] = await Promise.all([loadHomeInputs(supabase, businessId, today), loadFarm(supabase, businessId)]);
  return alignHomeWithFarm(buildHomeModel(inputs.input), farm);
}

/** The farm position, or null without accounting access (the plain home figures are shown then). */
export async function loadFarm(supabase: SupabaseClient<any>, businessId: string): Promise<FarmPosition | null> {
  // imported here: load-positions itself reads the home inputs
  const { loadPartnerData } = await import("@/lib/partners/load-positions");
  return loadPartnerData(supabase, businessId).then((p) => p.farm).catch((e) => {
    if (!(e instanceof ForbiddenError || e instanceof AuthError)) console.error("farm position failed", e);
    return null;
  });
}

/**
 * The raw inputs of the home model (also used by the cattle list so both show the same figures).
 * money = false skips the accounting engine (cash, month's expenses) when a page does not need it.
 */
export async function loadHomeInputs(supabase: SupabaseClient<any>, businessId: string, today = todayDhaka(), opts: { money?: boolean } = {}): Promise<HomeInputs> {
  // the accounting engine starts at the same time as everything else (it used to wait for them)
  const moneyP = opts.money !== false
    ? Promise.all([getAccountingData(supabase), getAccountingData(supabase, startOfMonth(today), today)])
        .then(([all, month]) => ({ cash: all.balanceSheet.cashAndBank, month: capitalSummary(month).operatingExpenses }))
        .catch((e) => {
          // no accounting access → money is not shown; any other failure is a bug, so it is logged
          if (!(e instanceof ForbiddenError || e instanceof AuthError)) console.error("home: accounting engine failed", e);
          return null;
        })
    : Promise.resolve(null);
  const [cattleRes, feed, costsRes, treatmentsRes, priceRes, healthRes] = await Promise.all([
    supabase.from("cattle")
      .select("id, tag_id, purchase_date, purchase_price, initial_weight_kg, initial_weight_type, target_weight_kg")
      .eq("business_id", businessId).eq("status", "active").is("deleted_at", null),
    loadFeedData(supabase, businessId, today),
    supabase.from("cost_entries").select("cattle_id, amount")
      .eq("business_id", businessId).is("deleted_at", null).not("cattle_id", "is", null)
      .eq("type", "variable").eq("entry_class", "expense")
      .neq("category", "Medical/Vet Fee"),   // that money is on the treatment row (counted below)
    supabase.from("cattle_treatments").select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId),
    supabase.from("market_prices").select("price_per_kg").eq("business_id", businessId)
      .order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("health_events").select("title, scheduled_at, cattle_id")
      .eq("business_id", businessId).is("deleted_at", null).is("completed_at", null)
      .lte("scheduled_at", addDays(today, 3)).order("scheduled_at", { ascending: true }),   // no cap: the list length is the count shown
  ]);

  const cattleRows = (cattleRes.data ?? []) as {
    id: string; tag_id: string; purchase_date: string; purchase_price: number | string;
    initial_weight_kg: number | string | null; initial_weight_type: "measured" | "estimated" | "unknown" | null; target_weight_kg: number | string | null;
  }[];
  const logsBy = new Map(feed.animals.map((a) => [a.id, a.logs]));
  const tagById = new Map(cattleRows.map((c) => [c.id, c.tag_id]));

  const direct: Record<string, number> = {};
  for (const c of (costsRes.data ?? []) as { cattle_id: string; amount: number | string }[]) direct[c.cattle_id] = (direct[c.cattle_id] ?? 0) + Number(c.amount);
  for (const t of (treatmentsRes.data ?? []) as { cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null }[]) {
    direct[t.cattle_id] = (direct[t.cattle_id] ?? 0) + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
  }

  // money: the accounting engine (needs accounting permission — otherwise not shown)
  const money = await moneyP;
  const cash: number | null = money?.cash ?? null;
  const monthOperatingExpenses: number | null = money?.month ?? null;

  const price = (priceRes.data as { price_per_kg: number | string } | null)?.price_per_kg;

  const input: HomeInput = {
    today,
    nextEid: nextEidDate(today),
    cattle: cattleRows.map((c) => ({
      id: c.id, tag: c.tag_id, purchaseDate: String(c.purchase_date).slice(0, 10), purchasePrice: Number(c.purchase_price ?? 0),
      initialWeightKg: c.initial_weight_kg == null ? null : Number(c.initial_weight_kg),
      initialWeightType: c.initial_weight_type, targetWeightKg: c.target_weight_kg == null ? null : Number(c.target_weight_kg),
      logs: logsBy.get(c.id) ?? [],
    })),
    feed: feed.snapshot,
    feedItems: feed.items.filter((i) => !i.discontinued || i.openPeriodId).map((i) => ({ id: i.id, name: i.name, unit: i.unit, stockQty: i.stockQty, daysLeft: i.daysLeft == null ? null : Math.floor(i.daysLeft), inUse: !!i.openPeriodId, role: i.role })),
    directCostByCattle: direct,
    marketPricePerKg: price != null && Number(price) > 0 ? Number(price) : null,
    cash,
    monthOperatingExpenses,
    healthDue: ((healthRes.data ?? []) as { title: string; scheduled_at: string; cattle_id: string | null }[])
      .map((h) => ({ cattleTag: h.cattle_id ? tagById.get(h.cattle_id) ?? null : null, title: h.title, date: String(h.scheduled_at).slice(0, 10) })),
  };
  return { input, feed, directCostByCattle: direct };
}
