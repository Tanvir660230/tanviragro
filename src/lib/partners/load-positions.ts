import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Partner, PartnerTransaction } from "@/types/database";
import { getAccountingData, getCachedDbData } from "@/lib/accounting/engine";
import { loadHomeInputs } from "@/lib/home/home-data";
import { buildHomeModel } from "@/lib/home/home-model";
import { todayDhaka } from "@/lib/dates";
import { buildPartnerPositions, type FarmPosition, type PartnerPosition, type PositionAnimal } from "@/lib/partners/position";

export type PartnerData = {
  farm: FarmPosition;
  positions: PartnerPosition[];
  partners: Partner[];
  txnsByPartner: Record<string, PartnerTransaction[]>;
  feePct: number;
  /** the accounts' own figure for the same result (retained earnings + profit paid + herd revaluation) */
  accountsCheck: number;
};

/**
 * Everything the partner pages show, from the central sources:
 * the accounting engine (running costs, costs per animal, sales) and the home model (each
 * animal's value today). Once per request.
 */
export const loadPartnerData = cache(async (supabase: SupabaseClient<any>, businessId: string): Promise<PartnerData> => {
  const today = todayDhaka();
  const [acc, db, home, partnersRes, txnsRes, feeRes] = await Promise.all([
    getAccountingData(supabase),
    getCachedDbData(supabase, businessId),
    loadHomeInputs(supabase, businessId, today, { money: false }),
    supabase.from("partners").select("*").eq("business_id", businessId).is("deleted_at", null).order("joined_at", { ascending: true }),
    supabase.from("partner_transactions").select("*, partners!inner(business_id)").eq("partners.business_id", businessId).is("deleted_at", null).order("recorded_at", { ascending: false }),
    supabase.from("management_fee_rates").select("rate_percent").eq("business_id", businessId).is("deleted_at", null).order("effective_from", { ascending: false }).limit(1),
  ]);
  if (partnersRes.error) throw new Error(`partners: ${partnersRes.error.message}`);
  if (txnsRes.error) throw new Error(`partner entries: ${txnsRes.error.message}`);

  const partners = (partnersRes.data ?? []) as Partner[];
  const ids = new Set(partners.map((p) => p.id));
  const txns = ((txnsRes.data ?? []) as PartnerTransaction[]).filter((t) => ids.has(t.partner_id));
  const txnsByPartner: Record<string, PartnerTransaction[]> = {};
  for (const t of txns) (txnsByPartner[t.partner_id] ??= []).push(t);
  const feePct = Number((feeRes.data as { rate_percent: number }[] | null)?.[0]?.rate_percent ?? 0);

  // ── running costs: what the accounts expense that is not tied to one animal (all time) ──
  const is = acc.incomeStatement;
  const runningCosts = is.feedExpenses + is.vetMedical + is.laborWages + is.utilities + is.rentLease + is.transport
    + is.repairsMaintenance + is.generalExpenses + is.depreciation + is.interestExpense;

  // ── costs recorded on each animal (the same rows the engine capitalises) ──
  const own: Record<string, number> = {};
  const add = (id: string | null | undefined, v: number) => { if (id) own[id] = (own[id] ?? 0) + v; };
  for (const c of db.costs) if (c.cattle_id && c.type === "variable" && (c.entry_class ?? "expense") !== "asset") add(c.cattle_id, Number(c.amount));
  for (const t of db.treatments) add(t.cattle_id, Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0));
  for (const f of db.rpcFeedData as { cattle_id: string | null; total_cost: number }[]) add(f.cattle_id, Number(f.total_cost));

  // ── each animal's value today: the home model (measured weight × latest market price) ──
  const valueById = new Map(buildHomeModel(home.input).cattle.map((c) => [c.id, c.valueToday]));
  const saleBy = new Map(db.sales.map((s) => [s.cattle_id, s]));

  const animals: PositionAnimal[] = db.cattle
    .filter((c) => c.status === "active" || c.status === "sold" || c.status === "dead")
    .map((c) => {
      const sale = saleBy.get(c.id);
      const status = c.status as PositionAnimal["status"];
      return {
        id: c.id, tag: c.tag_id ?? "?", status,
        purchaseDate: String(c.purchase_date).slice(0, 10),
        endDate: status === "sold" ? String(sale?.sold_at ?? today).slice(0, 10) : status === "dead" ? String(c.updated_at ?? today).slice(0, 10) : null,
        purchasePrice: Number(c.purchase_price ?? 0),
        ownCost: own[c.id] ?? 0,
        salePrice: status === "sold" ? Number(sale?.sale_price_total ?? 0) : status === "dead" ? 0 : null,
        valueToday: status === "active" ? (valueById.get(c.id) ?? null) : null,
      };
    });

  const { farm, partners: positions } = buildPartnerPositions({
    asOf: today,
    partners: partners.map((p) => ({
      id: p.id, name: p.name, partnerType: p.partner_type ?? "capital", shareMode: p.share_mode === "manual" ? "manual" : "auto",
      fixedPct: Number(p.profit_share_pct ?? 0), bearsLoss: p.bears_loss !== false, joinedAt: String(p.joined_at).slice(0, 10),
      laborValueMonthly: p.labor_value_monthly == null ? null : Number(p.labor_value_monthly), cliffMonths: Number(p.cliff_months ?? 0),
    })),
    txns: txns.map((t) => ({ partnerId: t.partner_id, type: t.type, amount: Number(t.amount), date: String(t.recorded_at).slice(0, 10) })),
    feePct,
    runningCosts,
    animals,
    marketPricePerKg: home.input.marketPricePerKg,
  });

  const herdValueAll = farm.herdValue;
  const accountsCheck = acc.balanceSheet.retainedEarnings + farm.profitPaid + (herdValueAll - acc.balanceSheet.livestock);
  return { farm, positions, partners, txnsByPartner, feePct, accountsCheck };
});
