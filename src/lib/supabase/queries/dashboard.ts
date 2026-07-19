import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cattle, WeightLog, Sale, CostEntry } from "@/types/database";
import { fmtBDT } from "@/lib/format";
import type { Dictionary } from "@/i18n/getDictionary";
import { calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";

// Use SupabaseClient without generic so TypeScript doesn't try to infer
// column picks from our manually-written Database type (which lacks the
// Supabase-generated Relationships metadata needed for column narrowing).
// We add explicit types on each destructured result instead.
 
type Client = SupabaseClient<any>;

export interface DashboardStats {
  totalCattle: number;
  totalInvestment: number;
  totalSales: number;
  netProfitLoss: number;
}



export type ActivityType =
  | "cattle_added"
  | "weight_logged"
  | "sale_recorded"
  | "cost_entered"
  | "inventory_purchased"
  | "medical_treatment"
  | "health_event"
  | "partner_txn"
  | "loan";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  label: string;
  detail: string;
  date: string;
  href?: string;
}



export async function getDashboardStats(
  supabase: Client,
  businessId: string | null
): Promise<DashboardStats> {
  if (!businessId) {
    return { totalCattle: 0, totalInvestment: 0, totalSales: 0, netProfitLoss: 0 };
  }

  const [
    { data: activeCountData },
    { data: salesData },
    { data: bizData },
    { data: rpcFeedData },
    { data: activeCostData },
    { data: recentPurchasesData },
    { data: roughagesData },
    { data: recipesData },
    { data: treatmentsData },
  ] = await Promise.all([
    supabase
      .from("cattle")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("sales")
      .select("sale_price_total, sold_at, cattle_id, cattle!inner(business_id, purchase_price, purchase_date, initial_weight_kg)")
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("businesses")
      .select("default_daily_gain_kg, default_roughage_type")
      .eq("id", businessId)
      .maybeSingle(),
    supabase.rpc("get_cattle_consumptions", { p_business_id: businessId }),
    supabase
      .from("cost_entries")
      .select("cattle_id, amount")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .not("cattle_id", "is", null)
      .eq("type", "variable")
      .neq("entry_class", "asset"),
    supabase
      .from("inventory_transactions")
      .select("item_id, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: false })
      .limit(300),
    supabase
      .from("inventory_items")
      .select("id, name, unit, roughage_active_from, roughage_active_until")
      .eq("business_id", businessId)
      .not("roughage_active_from", "is", null),
    supabase
      .from("feed_recipes")
      .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", businessId)
      .not("active_from", "is", null),
    supabase
      .from("cattle_treatments")
      .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId),
  ]);

  const sales = (salesData ?? []) as any[];
  const dailyGainKg = bizData?.default_daily_gain_kg ?? 0.6;
  const bizDefaultRoughage = bizData?.default_roughage_type ?? "straw";
  const defaultRoughageDm = ROUGHAGE_TYPES.find(r => r.id === bizDefaultRoughage)?.dmPercent ?? 0.90;

  // Build Cost Maps
  const feedCostByCattle: Record<string, number> = {};
  for (const t of (rpcFeedData ?? []) as any[]) {
    if (t.cattle_id) {
      feedCostByCattle[t.cattle_id] = (feedCostByCattle[t.cattle_id] ?? 0) + Number(t.total_cost);
    }
  }

  const costsByCattle: Record<string, number> = {};
  for (const c of (activeCostData ?? []) as any[]) {
    if (c.cattle_id) {
      costsByCattle[c.cattle_id] = (costsByCattle[c.cattle_id] ?? 0) + Number(c.amount);
    }
  }
  for (const t of (treatmentsData ?? []) as any[]) {
    if (t.cattle_id) {
      costsByCattle[t.cattle_id] = (costsByCattle[t.cattle_id] ?? 0) + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    }
  }

  const unitCostMap: Record<string, number> = {};
  for (const p of (recentPurchasesData ?? []) as any[]) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) {
      unitCostMap[p.item_id] = p.unit_cost;
    }
  }

  const roughages = (roughagesData ?? []) as any[];
  const recipes = (recipesData ?? []) as any[];

  let totalSales = 0;
  let totalSoldCostBasis = 0;

  for (const s of sales) {
    totalSales += Number(s.sale_price_total ?? 0);
    const c = s.cattle;
    if (!c) continue;

    const purchasePrice = Number(c.purchase_price ?? 0);
    const startMs = new Date(c.purchase_date + "T00:00:00").getTime();
    const endMs = new Date(s.sold_at).getTime();
    const daysInPen = Math.max(0, Math.floor((endMs - startMs) / 86400000));
    
    // Algorithmic feed fallback if no feed logged
    if ((feedCostByCattle[s.cattle_id] ?? 0) === 0) {
      const estimatedFinalWeight = c.initial_weight_kg + daysInPen * dailyGainKg;
      const { allocatedFeedCost } = calculateAlgorithmicFeedCost({
        daysInPen,
        startMs,
        recipes,
        roughages,
        unitCostMap,
        feedData: {
          initialWeightKg: c.initial_weight_kg ?? 0,
          latestLoggedWeightKg: estimatedFinalWeight,
          lastWeighedAt: s.sold_at,
          purchaseDate: c.purchase_date,
          expectedDailyGainKg: dailyGainKg,
          roughageDmPercent: defaultRoughageDm,
        },
        overrideRoughage: null,
      });
      feedCostByCattle[s.cattle_id] = allocatedFeedCost;
    }

    const costBasis = purchasePrice + (feedCostByCattle[s.cattle_id] ?? 0) + (costsByCattle[s.cattle_id] ?? 0);
    totalSoldCostBasis += costBasis;
  }

  return {
    totalCattle: activeCountData?.length ?? 0, // Fallback since count is in activeCountData array if we use destructuring
    totalInvestment: totalSoldCostBasis, // Alias totalInvestment to Realized Cost Basis for the dashboard hero
    totalSales,
    netProfitLoss: totalSales - totalSoldCostBasis,
  };
}


export async function getRecentActivity(
  supabase: Client,
  businessId: string | null,
  t?: Dictionary
): Promise<ActivityItem[]> {
  if (!businessId) return [];

  // Round 1 (parallel):
  // A — all cattle IDs+tags for business (no status filter → includes sold cattle for tagMap+scoping)
  // B — 4 most recently created cattle for the "cattle_added" activity items
  // C — recent costs (independent query)
  const [allCattleRes, recentCattleRes, costsRes, invPurchasesRes, treatmentsRes, healthRes, partnerRes, loansRes] = await Promise.allSettled([
    supabase
      .from("cattle")
      .select("id, tag_id")
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("cattle")
      .select("id, tag_id, breed, purchase_date, purchase_price")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("cost_entries")
      .select("id, amount, category, recorded_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("category", "Medical/Vet Fee")
      .order("recorded_at", { ascending: false })
      .limit(5),
    supabase
      .from("inventory_transactions")
      .select("id, qty, unit_cost, recorded_at, inventory_items!inner(name, unit, business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: false })
      .limit(4),
    supabase
      .from("cattle_treatments")
      .select("id, cattle_id, vet_fee, additional_medical_cost, diagnosis, treated_at, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .order("treated_at", { ascending: false })
      .limit(4),
    supabase
      .from("health_events")
      .select("id, cattle_id, title, event_type, completed_at")
      .eq("business_id", businessId)
      .not("completed_at", "is", null)
      .is("deleted_at", null)
      .order("completed_at", { ascending: false })
      .limit(4),
    supabase
      .from("partner_transactions")
      .select("id, amount, type, recorded_at, partners!inner(business_id, name)")
      .eq("partners.business_id", businessId)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false })
      .limit(4),
    supabase
      .from("loans")
      .select("id, lender_name, principal_amount, loan_date, loan_payments(id, amount, paid_at)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("loan_date", { ascending: false })
      .limit(4),
  ]);

  type CattleIdRow      = Pick<Cattle, "id" | "tag_id">;
  type CattleRow        = Pick<Cattle, "id" | "tag_id" | "breed" | "purchase_date" | "purchase_price">;
  type CostRow          = Pick<CostEntry, "id" | "amount" | "category" | "recorded_at">;
  type InvPurchaseRow   = { id: string; qty: number; unit_cost: number | null; recorded_at: string; inventory_items: { name: string; unit: string } | null };
  type TreatmentRow     = { id: string; cattle_id: string; vet_fee: number; additional_medical_cost: number; diagnosis: string | null; treated_at: string };
  type HealthEventRow   = { id: string; cattle_id: string; title: string; event_type: string; completed_at: string };
  type PartnerTxnRow    = { id: string; amount: number; type: string; recorded_at: string; partners: { name: string } | null };
  type LoanRow          = { id: string; lender_name: string; principal_amount: number; loan_date: string; loan_payments: { id: string; amount: number; paid_at: string }[] };

  const allCattleData    = (allCattleRes.status    === "fulfilled" ? allCattleRes.value.data    : null) as CattleIdRow[] | null;
  const recentCattleData = (recentCattleRes.status === "fulfilled" ? recentCattleRes.value.data : null) as CattleRow[]   | null;
  const costsData        = (costsRes.status        === "fulfilled" ? costsRes.value.data        : null) as CostRow[]     | null;
  const invPurchasesData = (invPurchasesRes.status === "fulfilled" ? invPurchasesRes.value.data  : null) as InvPurchaseRow[] | null;
  const treatmentsData   = (treatmentsRes.status   === "fulfilled" ? treatmentsRes.value.data    : null) as TreatmentRow[]   | null;
  const healthEventsData = (healthRes.status       === "fulfilled" ? healthRes.value.data        : null) as HealthEventRow[] | null;
  const partnerTxnData   = (partnerRes.status      === "fulfilled" ? partnerRes.value.data       : null) as PartnerTxnRow[]  | null;
  const loansData        = (loansRes.status        === "fulfilled" ? loansRes.value.data         : null) as LoanRow[]        | null;

  // All business cattle IDs — used to scope weight_logs + sales (covers sold cattle too)
  const allCattleIds = (allCattleData ?? []).map((c) => c.id);

  // Round 2: weight_logs + sales scoped to all business cattle via .in() — no join
  const [weightRes, salesRes] = await Promise.allSettled([
    allCattleIds.length > 0
      ? supabase
          .from("weight_logs")
          .select("id, weight_kg, recorded_at, cattle_id")
          .in("cattle_id", allCattleIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as Pick<WeightLog, "id" | "weight_kg" | "recorded_at" | "cattle_id">[] }),
    allCattleIds.length > 0
      ? supabase
          .from("sales")
          .select("id, sale_price_total, sold_at, cattle_id")
          .in("cattle_id", allCattleIds)
          .is("deleted_at", null)
          .order("sold_at", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] as Pick<Sale, "id" | "sale_price_total" | "sold_at" | "cattle_id">[] }),
  ]);

  type WeightRow = Pick<WeightLog, "id" | "weight_kg" | "recorded_at" | "cattle_id">;
  type SaleRow   = Pick<Sale, "id" | "sale_price_total" | "sold_at" | "cattle_id">;

  const weightData = (weightRes.status === "fulfilled" ? weightRes.value.data : null) as WeightRow[] | null;
  const salesData  = (salesRes.status  === "fulfilled" ? salesRes.value.data  : null) as SaleRow[]  | null;

  // tagMap from ALL cattle (including sold) — no more missing tags for sold animals
  const tagMap: Record<string, string> = {};
  for (const c of allCattleData ?? []) tagMap[c.id] = c.tag_id;

  const items: ActivityItem[] = [];

  for (const c of recentCattleData ?? []) {
    items.push({
      id: `cattle-${c.id}`,
      type: "cattle_added",
      label: t ? t.activity.cattle_added.replace("{tag}", c.tag_id) : `Cattle #${c.tag_id} added`,
      detail: `${fmtBDT(c.purchase_price ?? 0)} · ${c.breed ?? (t ? t.activity.unknown_breed : "Unknown breed")}`,
      date: c.purchase_date,
      href: `/dashboard/cattle/${c.id}`,
    });
  }

  for (const w of weightData ?? []) {
    const tag = tagMap[w.cattle_id] ?? w.cattle_id.slice(0, 6);
    items.push({
      id: `weight-${w.id}`,
      type: "weight_logged",
      label: t ? t.activity.weight_logged.replace("{tag}", tag) : `Weight logged — #${tag}`,
      detail: `${w.weight_kg} kg`,
      date: w.recorded_at,
      href: `/dashboard/cattle/${w.cattle_id}`,
    });
  }

  for (const s of salesData ?? []) {
    const tag = tagMap[s.cattle_id] ?? s.cattle_id.slice(0, 6);
    items.push({
      id: `sale-${s.id}`,
      type: "sale_recorded",
      label: t ? t.activity.sale_recorded.replace("{tag}", tag) : `Cattle #${tag} sold`,
      detail: fmtBDT(s.sale_price_total),
      date: s.sold_at,
      href: `/dashboard/cattle/${s.cattle_id}`,
    });
  }

  for (const c of costsData ?? []) {
    items.push({
      id: `cost-${c.id}`,
      type: "cost_entered",
      label: t ? t.activity.cost_entered.replace("{category}", c.category) : `Cost: ${c.category}`,
      detail: fmtBDT(c.amount),
      date: c.recorded_at,
      href: `/dashboard/finance`,
    });
  }

  for (const p of invPurchasesData ?? []) {
    const name = p.inventory_items?.name ?? "Item";
    const amount = p.unit_cost != null ? p.qty * p.unit_cost : 0;
    items.push({
      id: `inv-${p.id}`,
      type: "inventory_purchased",
      label: t ? t.activity.inventory_purchased.replace("{item}", name) : `Purchased: ${name}`,
      detail: `${p.qty} ${p.inventory_items?.unit ?? ""}${amount > 0 ? ` · ${fmtBDT(amount)}` : ""}`,
      date: p.recorded_at,
      href: `/dashboard/inventory`,
    });
  }

  for (const tr of treatmentsData ?? []) {
    const cost = (tr.vet_fee ?? 0) + (tr.additional_medical_cost ?? 0);
    const tag = tagMap[tr.cattle_id] ?? tr.cattle_id.slice(0, 6);
    items.push({
      id: `treat-${tr.id}`,
      type: "medical_treatment",
      label: t ? t.activity.medical_treatment.replace("{tag}", tag) : `Treatment — #${tag}`,
      detail: `${tr.diagnosis || ""}${cost > 0 ? ` · ${fmtBDT(cost)}` : ""}`.trim(),
      date: tr.treated_at,
      href: `/dashboard/cattle/${tr.cattle_id}`,
    });
  }

  for (const h of healthEventsData ?? []) {
    const tag = tagMap[h.cattle_id] ?? h.cattle_id.slice(0, 6);
    const eventLabel = h.event_type === "vaccine" ? "Vaccinated" : h.event_type === "checkup" ? "Checkup" : "Health Event";
    items.push({
      id: `health-${h.id}`,
      type: "health_event",
      label: t ? t.activity.health_event_completed.replace("{event_type}", eventLabel).replace("{tag}", tag) : `${eventLabel} — #${tag}`,
      detail: h.title,
      date: h.completed_at,
      href: `/dashboard/cattle/${h.cattle_id}`,
    });
  }

  for (const pt of partnerTxnData ?? []) {
    const name = pt.partners?.name ?? "Partner";
    const key = pt.type === "investment" ? "partner_investment" : pt.type === "profit" ? "partner_profit" : "partner_withdrawal";
    const fallback = pt.type === "investment" ? `Investment — ${name}` : pt.type === "profit" ? `Profit paid — ${name}` : `Withdrawal — ${name}`;
    items.push({
      id: `ptxn-${pt.id}`,
      type: "partner_txn",
      label: t ? t.activity[key].replace("{name}", name) : fallback,
      detail: fmtBDT(pt.amount),
      date: pt.recorded_at,
      href: `/dashboard/partners`,
    });
  }

  for (const l of loansData ?? []) {
    items.push({
      id: `loan-${l.id}`,
      type: "loan",
      label: t ? t.activity.loan_taken.replace("{lender}", l.lender_name) : `Loan taken — ${l.lender_name}`,
      detail: fmtBDT(l.principal_amount),
      date: l.loan_date,
      href: `/dashboard/finance/loans`,
    });
    for (const p of l.loan_payments ?? []) {
      items.push({
        id: `loanpay-${p.id}`,
        type: "loan",
        label: t ? t.activity.loan_payment.replace("{lender}", l.lender_name) : `Loan payment — ${l.lender_name}`,
        detail: fmtBDT(p.amount),
        date: p.paid_at,
        href: `/dashboard/finance/loans`,
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
}
