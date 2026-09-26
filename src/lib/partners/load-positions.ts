import type { SupabaseClient } from "@supabase/supabase-js";
import { requestMemo } from "@/lib/request-memo";
import type { Partner, PartnerTransaction } from "@/types/database";
import { getAccountingData, getCachedDbData } from "@/lib/accounting/engine";
import { unallocatedCostOf } from "@/lib/accounting/inventory-ledger";
import { loadHomeInputs } from "@/lib/home/home-data";
import { buildHomeModel, type HomeModel } from "@/lib/home/home-model";
import { todayDhaka } from "@/lib/dates";
import { assetDailyCosts, spread } from "@/lib/partners/asset-costs";
import {
  buildPartnerPositions, type FarmPosition, type FeeRate, type PartnerPosition, type PositionAnimal,
  type PositionPartner, type ShareRule,
} from "@/lib/partners/position";

export type ShareRuleRow = ShareRule & { id: string; note: string | null; createdAt: string };

export type PartnerData = {
  farm: FarmPosition;
  positions: PartnerPosition[];
  partners: Partner[];
  positionPartners: PositionPartner[];
  rules: ShareRuleRow[];
  /** false until migration 20260927090000 is applied (then the partner rows' own setting is used) */
  rulesEnabled: boolean;
  feeRates: FeeRate[];
  txnsByPartner: Record<string, PartnerTransaction[]>;
  /** the accounts' own figure for the same result (retained earnings + profit paid + herd revaluation) */
  accountsCheck: number;
  /** last day the books are locked (financial lock) — rules and entries cannot start on or before it */
  lockedUntil: string | null;
  /** migration 20260927100000 applied: cycles, advances, partner loans, expenses paid by a partner */
  cyclesEnabled: boolean;
  cycleRows: { id: string; closedOn: string; note: string | null; createdAt: string }[];
  /** the farm's cash now (for checking a withdrawal) */
  cash: number;
  /** the home model it used (weights, measured growth, feed per head) — other pages reuse it */
  home: HomeModel;
};

const DAY = 86400000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);
const dayStr = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));



/**
 * Everything the partner pages show, from the central sources: the accounting engine
 * (running costs day by day, costs per animal, sales), the home model (each animal's value
 * today) and the partner share rules. Once per request.
 */
export const PREVIEW_CYCLE_ID = "preview";

/** `previewClose`: also close a cycle on that day (not saved) — what closing it would settle. */
export const loadPartnerData = requestMemo((_s: SupabaseClient<any>, businessId: string, previewClose?: string) => `${businessId}:${previewClose ?? ""}`, async (supabase: SupabaseClient<any>, businessId: string, previewClose?: string): Promise<PartnerData> => {
  const today = todayDhaka();
  const [acc, db, home, partnersRes, txnsRes, feeRes, rulesRes, deathRes, lockRes, cyclesRes] = await Promise.all([
    getAccountingData(supabase),
    getCachedDbData(supabase, businessId),
    loadHomeInputs(supabase, businessId, today, { money: false }),
    supabase.from("partners").select("*").eq("business_id", businessId).is("deleted_at", null).order("joined_at", { ascending: true }),
    supabase.from("partner_transactions").select("*, partners!inner(business_id)").eq("partners.business_id", businessId).is("deleted_at", null).order("recorded_at", { ascending: false }),
    supabase.from("management_fee_rates").select("rate_percent, effective_from").eq("business_id", businessId).is("deleted_at", null),
    supabase.from("partner_share_rules").select("id, partner_id, effective_from, share_mode, fixed_pct, bears_loss, note, created_at").eq("business_id", businessId).is("deleted_at", null),
    supabase.from("cattle_death_records").select("cattle_id, death_date").eq("business_id", businessId),
    supabase.from("financial_locks").select("locked_until").eq("business_id", businessId).order("locked_until", { ascending: false }).limit(1),
    supabase.from("partner_cycles").select("id, closed_on, note, created_at").eq("business_id", businessId).is("deleted_at", null).order("closed_on", { ascending: true }),
  ]);
  if (cyclesRes.error && !missingTable(cyclesRes.error)) throw new Error(`cycles: ${cyclesRes.error.message}`);
  const cyclesEnabled = !cyclesRes.error;
  const cycleRows = ((cyclesRes.data ?? []) as { id: string; closed_on: string; note: string | null; created_at: string }[])
    .map((c) => ({ id: c.id, closedOn: String(c.closed_on).slice(0, 10), note: c.note, createdAt: c.created_at }));
  if (partnersRes.error) throw new Error(`partners: ${partnersRes.error.message}`);
  if (txnsRes.error) throw new Error(`partner entries: ${txnsRes.error.message}`);
  if (rulesRes.error && !missingTable(rulesRes.error)) throw new Error(`share rules: ${rulesRes.error.message}`);

  const partners = (partnersRes.data ?? []) as (Partner & { left_at?: string | null })[];
  const ids = new Set(partners.map((p) => p.id));
  const txns = ((txnsRes.data ?? []) as PartnerTransaction[]).filter((t) => ids.has(t.partner_id));
  const txnsByPartner: Record<string, PartnerTransaction[]> = {};
  for (const t of txns) (txnsByPartner[t.partner_id] ??= []).push(t);
  const feeRates: FeeRate[] = ((feeRes.data ?? []) as { rate_percent: number; effective_from: string | null }[])
    .map((f) => ({ from: String(f.effective_from ?? "0000-01-01").slice(0, 10), pct: Number(f.rate_percent) || 0 }));
  const rulesEnabled = !rulesRes.error;
  const rules: ShareRuleRow[] = ((rulesRes.data ?? []) as { id: string; partner_id: string; effective_from: string; share_mode: string; fixed_pct: number; bears_loss: boolean; note: string | null; created_at: string }[])
    .filter((r) => ids.has(r.partner_id))
    .map((r) => ({ id: r.id, partnerId: r.partner_id, from: String(r.effective_from).slice(0, 10), shareMode: (r.share_mode === "manual" ? "manual" : "auto") as "auto" | "manual",
      fixedPct: Number(r.fixed_pct) || 0, bearsLoss: !!r.bears_loss, note: r.note, createdAt: r.created_at }))
    .sort((a, b) => a.from.localeCompare(b.from));

  // ── running costs by day — the same rows and totals the accounts expense ──
  const dailyCosts: { date: string; amount: number }[] = [];
  for (const c of db.costs) {
    if ((c.entry_class ?? "expense") === "asset" || (c.cattle_id && c.type === "variable")) continue;
    dailyCosts.push({ date: String(c.recorded_at).slice(0, 10), amount: Number(c.amount) });
  }
  for (const t of db.invTx) {
    const v = unallocatedCostOf({ ...t, category: t.inventory_items?.category ?? null });
    if (v) dailyCosts.push({ date: String(t.recorded_at).slice(0, 10), amount: v });
  }
  dailyCosts.push(...assetDailyCosts(acc.fixedAssets, today));   // depreciation, and a sold asset's gain or loss
  const firstLoan = db.loansData.map((l) => String(l.loan_date).slice(0, 10)).sort()[0];
  if (firstLoan) spread(dailyCosts, acc.incomeStatement.interestExpense, firstLoan, today);

  // ── costs recorded on each animal (the rows the engine capitalises) ──
  const own: Record<string, number> = {};
  const add = (id: string | null | undefined, v: number) => { if (id) own[id] = (own[id] ?? 0) + v; };
  for (const c of db.costs) if (c.cattle_id && c.type === "variable" && (c.entry_class ?? "expense") !== "asset") add(c.cattle_id, Number(c.amount));
  for (const t of db.treatments) add(t.cattle_id, Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0));
  for (const f of db.rpcFeedData as { cattle_id: string | null; total_cost: number }[]) add(f.cattle_id, Number(f.total_cost));

  // ── each animal: value today (home model), sale, death date ──
  const homeModel = buildHomeModel(home.input);
  const valueById = new Map(homeModel.cattle.map((c) => [c.id, c.valueToday]));
  const saleBy = new Map(db.sales.map((s) => [s.cattle_id, s]));
  const deathBy = new Map(((deathRes.data ?? []) as { cattle_id: string; death_date: string }[]).map((d) => [d.cattle_id, String(d.death_date).slice(0, 10)]));
  const animals: PositionAnimal[] = db.cattle
    .filter((c) => c.status === "active" || c.status === "sold" || c.status === "dead")
    .map((c) => {
      const sale = saleBy.get(c.id);
      const status = c.status as PositionAnimal["status"];
      return {
        id: c.id, tag: c.tag_id ?? "?", status,
        purchaseDate: String(c.purchase_date).slice(0, 10),
        endDate: status === "sold" ? String(sale?.sold_at ?? today).slice(0, 10)
          : status === "dead" ? (deathBy.get(c.id) ?? String(c.updated_at ?? today).slice(0, 10)) : null,
        purchasePrice: Number(c.purchase_price ?? 0),
        ownCost: own[c.id] ?? 0,
        salePrice: status === "sold" ? Number(sale?.sale_price_total ?? 0) : status === "dead" ? 0 : null,
        valueToday: status === "active" ? (valueById.get(c.id) ?? null) : null,
      };
    });

  const positionPartners: PositionPartner[] = partners.map((p) => ({
    id: p.id, name: p.name, partnerType: p.partner_type ?? "capital", joinedAt: String(p.joined_at).slice(0, 10),
    leftAt: p.left_at ? String(p.left_at).slice(0, 10) : null,
    laborValueMonthly: p.labor_value_monthly == null ? null : Number(p.labor_value_monthly), cliffMonths: Number(p.cliff_months ?? 0),
    shareMode: p.share_mode === "manual" ? "manual" : "auto", fixedPct: Number(p.profit_share_pct ?? 0),
    bearsLoss: p.partner_type === "labor" ? false : p.bears_loss !== false,
  }));

  const { farm, partners: positions } = buildPartnerPositions({
    asOf: today, partners: positionPartners, rules, feeRates,
    txns: txns.map((t) => ({ partnerId: t.partner_id, type: t.type, amount: Number(t.amount), date: String(t.recorded_at).slice(0, 10) })),
    dailyCosts, animals, marketPricePerKg: home.input.marketPricePerKg,
    cycles: [...cycleRows.map((c) => ({ id: c.id, closedOn: c.closedOn })), ...(previewClose ? [{ id: PREVIEW_CYCLE_ID, closedOn: previewClose }] : [])],
  });

  const accountsCheck = acc.balanceSheet.retainedEarnings + farm.profitPaid + (farm.herdValue - acc.balanceSheet.livestock);
  const lockedUntil = ((lockRes.data ?? []) as { locked_until: string }[])[0]?.locked_until?.slice(0, 10) ?? null;
  return { farm, positions, partners, positionPartners, rules, rulesEnabled, feeRates, txnsByPartner, accountsCheck, lockedUntil,
    cyclesEnabled, cycleRows, cash: acc.balanceSheet.cashAndBank, home: homeModel };
});
