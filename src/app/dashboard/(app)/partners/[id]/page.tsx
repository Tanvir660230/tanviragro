import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { User } from "lucide-react";
import { PartnerProfileClient } from "@/components/partners/PartnerProfileClient";
import type {
  Partner,
  PartnerTransaction,
  ManagementFeeRate,
} from "@/types/database";
import { PartnerEngine } from "@/lib/partners/partner-engine";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { type PartnerAccountSummary } from "@/lib/partners/calculations";
import { getCachedBusinessId } from "@/lib/supabase/cached";
import { getL } from "@/i18n/server-text";

export const metadata: Metadata = { title: "অংশীদার" };

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PartnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.PARTNERS_VIEW);
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id, default_daily_gain_kg")
    .eq("id", (await getCachedBusinessId()) ?? "")
    .maybeSingle();

  const businessId = bizData?.id ?? null;
  if (!businessId) notFound();

  // ── Fetch this partner ────────────────────────────────────────────
  const { data: partnerData } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!partnerData) notFound();

  // ── Parallel fetch everything needed ────────────────────────────
  const [
    { data: txnsData },
    { data: allPartnersData },
    { data: allTxnsData },
    { data: salesData },
    { data: costsData },
    { data: feedData },
    { data: feeRatesData },
    { data: activeCattleData },
    { data: marketPriceData },
  ] = await Promise.all([
    // This partner's transactions
    supabase
      .from("partner_transactions")
      .select("*")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false }),

    // All partners in this business (for share calculation)
    supabase
      .from("partners")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("joined_at", { ascending: true }),

    // All partner transactions (for auto-share pool)
    supabase
      .from("partner_transactions")
      .select("*, partners!inner(business_id)")
      .eq("partners.business_id", businessId)
      .is("deleted_at", null),

    // Sales for realized P&L
    supabase
      .from("sales")
      .select(
        "cattle_id, sale_price_total, cattle!inner(purchase_price, business_id)"
      )
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null),

    // Cost entries for realized P&L
    supabase
      .from("cost_entries")
      .select("amount, entry_class, cattle_id, type")
      .eq("business_id", businessId)
      .is("deleted_at", null),

    // Feed consumed (RPC)
    supabase.rpc("get_cattle_consumptions", {
      p_business_id: businessId,
    }),

    // Management fee
    supabase
      .from("management_fee_rates")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("effective_from", { ascending: false })
      .limit(1),

    // Active cattle count for unrealized value
    supabase
      .from("cattle")
      .select("id, purchase_price")
      .eq("business_id", businessId)
      .eq("status", "active"),

    // Latest market price
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const partner = partnerData as Partner;
  const transactions = (txnsData ?? []) as PartnerTransaction[];
  const allPartners = (allPartnersData ?? []) as Partner[];

  // Build txnsByPartner map (for share pool computation)
  type AllTxnRow = PartnerTransaction & { partners: { business_id: string } };
  const allTxns = (allTxnsData ?? []) as AllTxnRow[];
  const txnsByPartner: Record<string, PartnerTransaction[]> = {};
  for (const txn of allTxns) {
    if (!txnsByPartner[txn.partner_id]) txnsByPartner[txn.partner_id] = [];
    txnsByPartner[txn.partner_id].push(txn);
  }

  // ── Realized P&L (same logic as main partners page) ──────────────
  type SaleRow = {
    cattle_id: string;
    sale_price_total: number;
    cattle: { purchase_price: number | null };
  };
  const typedSales = (salesData ?? []) as SaleRow[];
  const totalRevenue = typedSales.reduce(
    (s, r) => s + Number(r.sale_price_total ?? 0),
    0
  );
  const soldCattleCosts = typedSales.reduce(
    (s, r) => s + Number(r.cattle?.purchase_price ?? 0),
    0
  );

  type CostRow = {
    amount: number;
    entry_class?: string;
    cattle_id?: string | null;
    type?: string;
  };
  const typedCosts = (costsData ?? []) as CostRow[];
  const activeCattleIds = new Set(
    (activeCattleData ?? []).map((c) => (c as { id: string }).id)
  );
  const operatingCosts = typedCosts
    .filter((c) => (c.entry_class ?? "expense") === "expense")
    .filter((c) => !c.cattle_id || !activeCattleIds.has(c.cattle_id))
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const soldCattleIdSet = new Set(
    typedSales.map((r) => r.cattle_id).filter(Boolean)
  );
  const rpcFeed = (feedData ?? []) as {
    cattle_id: string | null;
    category: string;
    total_cost: number;
  }[];
  const feedCosts = rpcFeed.reduce((s, t) => {
    const cost = Number(t.total_cost ?? 0);
    if (!t.cattle_id) return s + cost;
    if (soldCattleIdSet.has(t.cattle_id)) return s + cost;
    return s;
  }, 0);

  const netPL = totalRevenue - soldCattleCosts - operatingCosts - feedCosts;
  const mgmtFeeRate =
    ((feeRatesData ?? []) as ManagementFeeRate[])[0]?.rate_percent ?? 0;
  const mgmtFeeAmount = netPL > 0 ? (netPL * mgmtFeeRate) / 100 : 0;
  const netPLAfterFee = netPL - mgmtFeeAmount;

  // Per-partner netPL (founding partners use all P&L, new ones subtract entry baseline)
  const netPLForPartner = netPLAfterFee - (partner.entry_netpl ?? 0);

  // ── Centralized Effective share & account ─────────────────────────
  const partnerEquity = PartnerEngine.calculatePartnerEquity({
    partner,
    allPartners,
    txnsByPartner,
    netPLAfterFee,
  });

  const sharePct = partnerEquity.effectiveSharePct;
  const acc: PartnerAccountSummary = {
    totalInvested: partnerEquity.totalContributedCapital,
    withdrawn: partnerEquity.totalWithdrawnCapital,
    profitReceived: partnerEquity.totalRealizedProfit,
    lossBorne: partnerEquity.totalRealizedLoss,
    laborValue: partnerEquity.vestedLaborValue,
    months: partnerEquity.monthsActive,
    equity: partnerEquity.currentBookEquity,
    pendingProfit: partnerEquity.pendingProfit,
    pendingLoss: partnerEquity.pendingLoss,
  };

  // ── Business total value (for market-value equity display) ────────
  const totalPartnerCapital = allPartners.reduce((s, p) => {
    return s + PartnerEngine.computeNetInvestment(p, txnsByPartner[p.id] ?? []);
  }, 0);

  const marketPricePerKg: number = marketPriceData?.price_per_kg ?? 0;
  const hasMarketPrice = marketPricePerKg > 0;

  // Simplified: active cattle cost basis as floor value
  const activeCattleCostBasis = (
    activeCattleData ?? []
  ).reduce((s, c) => s + Number((c as { purchase_price: number }).purchase_price ?? 0), 0);

  const totalEquityAcrossPartners = allPartners.reduce((s, p) => {
    const ptxns = txnsByPartner[p.id] ?? [];
    const pShare = PartnerEngine.calculateEffectiveShare(p, allPartners, txnsByPartner);
    const pNetPL = netPLAfterFee - (p.entry_netpl ?? 0);
    const pAcc = PartnerEngine.calculateAccountSummary(p, ptxns, pNetPL, pShare);
    return s + pAcc.equity;
  }, 0);

  const totalBusinessValue = totalEquityAcrossPartners + activeCattleCostBasis;

  return (
    <div className="space-y-5">
      <PageHeader
        title={partner.name}
        subtitle={L("অংশীদারের প্রোফাইল", "Partner profile")}
        back="/dashboard/partners"
        icon={User}
      />
      <PartnerProfileClient
        partner={partner}
        transactions={transactions}
        sharePct={sharePct}
        acc={acc}
        totalBusinessValue={totalBusinessValue}
        hasMarketPrice={hasMarketPrice}
      />
    </div>
  );
}
