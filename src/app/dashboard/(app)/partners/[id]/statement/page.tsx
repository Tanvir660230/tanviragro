import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Partner, PartnerTransaction, ManagementFeeRate } from "@/types/database";
import { StatementClient } from "@/components/partners/StatementClient";

export const metadata: Metadata = { title: "Partner Statement" };

// ── Pure helpers (same logic as profile page) ─────────────────────────────────

function totalCapitalOf(txns: PartnerTransaction[]): number {
  return txns.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
}

function monthsActive(joinedAt: string): number {
  const joined = new Date(joinedAt + "T00:00:00");
  const now = new Date();
  let months =
    (now.getFullYear() - joined.getFullYear()) * 12 +
    (now.getMonth() - joined.getMonth());
  if (now.getDate() < joined.getDate()) months--;
  return Math.max(0, months);
}

function computeNetInvestment(p: Partner, txns: PartnerTransaction[]): number {
  const invested = totalCapitalOf(txns);
  const withdrawn = txns.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
  const months = monthsActive(p.joined_at);
  const cliff = p.cliff_months ?? 0;
  const vestedMonths = months >= cliff ? months : 0;
  const laborValue = p.labor_value_monthly ? p.labor_value_monthly * vestedMonths : 0;
  return Math.max(0, invested - withdrawn + laborValue);
}

function effectiveShare(
  p: Partner,
  allPartners: Partner[],
  txnsByPartner: Record<string, PartnerTransaction[]>
): number {
  if (p.share_mode === "manual") return p.profit_share_pct;
  const manualTotal = allPartners
    .filter((x) => x.share_mode === "manual")
    .reduce((s, x) => s + x.profit_share_pct, 0);
  const remainingPool = Math.max(0, 100 - manualTotal);
  const autoPartners = allPartners.filter((x) => x.share_mode !== "manual");
  const totalAutoInvested = autoPartners.reduce(
    (s, x) => s + computeNetInvestment(x, txnsByPartner[x.id] ?? []),
    0
  );
  if (totalAutoInvested === 0) return 0;
  return (computeNetInvestment(p, txnsByPartner[p.id] ?? []) / totalAutoInvested) * remainingPool;
}

export interface AccountSummary {
  totalInvested: number;
  withdrawn: number;
  profitReceived: number;
  lossBorne: number;
  laborValue: number;
  months: number;
  equity: number;
  pendingProfit: number;
  pendingLoss: number;
}

function computeAccount(
  p: Partner,
  txns: PartnerTransaction[],
  netPL: number,
  sharePct: number
): AccountSummary {
  const totalInvested = totalCapitalOf(txns);
  const withdrawn = txns.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
  const profitReceived = txns.filter((t) => t.type === "profit").reduce((s, t) => s + t.amount, 0);
  const lossBorne = txns.filter((t) => t.type === "loss_allocation").reduce((s, t) => s + t.amount, 0);
  const months = monthsActive(p.joined_at);
  const cliff = p.cliff_months ?? 0;
  const vestedMonths = months >= cliff ? months : 0;
  const laborValue =
    p.partner_type !== "capital" && p.labor_value_monthly
      ? p.labor_value_monthly * vestedMonths
      : 0;
  const pendingProfit =
    netPL > 0 && sharePct > 0 ? Math.max(0, (netPL * sharePct) / 100 - profitReceived) : 0;
  const pendingLoss =
    netPL < 0 && sharePct > 0 && p.bears_loss
      ? Math.max(0, (Math.abs(netPL) * sharePct) / 100 - lossBorne)
      : 0;
  const equity = totalInvested + laborValue - withdrawn - lossBorne + pendingProfit - pendingLoss;
  return { totalInvested, withdrawn, profitReceived, lossBorne, laborValue, months, equity, pendingProfit, pendingLoss };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();

  const businessId = bizData?.id ?? null;
  if (!businessId) notFound();

  const businessName: string = (bizData as { name?: string } | null)?.name ?? "Tanvir Agro";

  const { data: partnerData } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!partnerData) notFound();

  const [
    { data: txnsData },
    { data: allPartnersData },
    { data: allTxnsData },
    { data: salesData },
    { data: costsData },
    { data: feedData },
    { data: feeRatesData },
    { data: activeCattleData },
    { data: treatmentsData },
  ] = await Promise.all([
    supabase
      .from("partner_transactions")
      .select("*")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: true }),

    supabase
      .from("partners")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null),

    supabase
      .from("partner_transactions")
      .select("*, partners!inner(business_id)")
      .eq("partners.business_id", businessId)
      .is("deleted_at", null),

    supabase
      .from("sales")
      .select("cattle_id, sale_price_total, cattle!inner(purchase_price, business_id)")
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null),

    supabase
      .from("cost_entries")
      .select("amount, entry_class, cattle_id, type")
      .eq("business_id", businessId)
      .is("deleted_at", null),

    supabase.rpc("get_cattle_consumptions", { p_business_id: businessId }),

    supabase
      .from("management_fee_rates")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("effective_from", { ascending: false })
      .limit(1),

    supabase
      .from("cattle")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "active"),

    supabase
      .from("cattle_treatments")
      .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId),
  ]);

  const partner = partnerData as Partner;
  const transactions = (txnsData ?? []) as PartnerTransaction[];
  const allPartners = (allPartnersData ?? []) as Partner[];

  type AllTxnRow = PartnerTransaction & { partners: { business_id: string } };
  const txnsByPartner: Record<string, PartnerTransaction[]> = {};
  for (const txn of (allTxnsData ?? []) as AllTxnRow[]) {
    if (!txnsByPartner[txn.partner_id]) txnsByPartner[txn.partner_id] = [];
    txnsByPartner[txn.partner_id].push(txn);
  }

  // Realized P&L
  type SaleRow = { cattle_id: string; sale_price_total: number; cattle: { purchase_price: number | null } };
  const typedSales = (salesData ?? []) as SaleRow[];
  const totalRevenue = typedSales.reduce((s, r) => s + Number(r.sale_price_total ?? 0), 0);
  const soldCattleCosts = typedSales.reduce((s, r) => s + Number(r.cattle?.purchase_price ?? 0), 0);

  const activeCattleIds = new Set((activeCattleData ?? []).map((c) => (c as { id: string }).id));
  
  // Total medical treatments (exclude active cattle for realized operating costs)
  const allTreatments = (treatmentsData ?? []) as { cattle_id: string; vet_fee: number; additional_medical_cost: number }[];
  const realizedMedicalCosts = allTreatments
    .filter((t) => !activeCattleIds.has(t.cattle_id))
    .reduce((s, t) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0);

  const typedCosts = (costsData ?? []) as { amount: number; entry_class?: string; cattle_id?: string | null; type?: string }[];
  const operatingCosts = typedCosts
    .filter((c) => (c.entry_class ?? "expense") === "expense")
    .filter((c) => !c.cattle_id || !activeCattleIds.has(c.cattle_id))
    .reduce((s, c) => s + Number(c.amount ?? 0), 0) + realizedMedicalCosts;

  const soldCattleIdSet = new Set(typedSales.map((r) => r.cattle_id).filter(Boolean));
  const rpcFeed = (feedData ?? []) as { cattle_id: string | null; total_cost: number }[];
  const feedCosts = rpcFeed.reduce((s, t) => {
    const cost = Number(t.total_cost ?? 0);
    if (!t.cattle_id) return s + cost;
    if (soldCattleIdSet.has(t.cattle_id)) return s + cost;
    return s;
  }, 0);

  const netPL = totalRevenue - soldCattleCosts - operatingCosts - feedCosts;
  const mgmtFeeRate = ((feeRatesData ?? []) as ManagementFeeRate[])[0]?.rate_percent ?? 0;
  const mgmtFeeAmount = netPL > 0 ? (netPL * mgmtFeeRate) / 100 : 0;
  const netPLAfterFee = netPL - mgmtFeeAmount;
  const netPLForPartner = netPLAfterFee - (partner.entry_netpl ?? 0);

  const sharePct = effectiveShare(partner, allPartners, txnsByPartner);
  const acc = computeAccount(partner, transactions, netPLForPartner, sharePct);

  const statementDate = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <StatementClient
      businessName={businessName}
      partner={partner}
      transactions={transactions}
      acc={acc}
      sharePct={sharePct}
      statementDate={statementDate}
      backUrl={`/dashboard/partners/${id}`}
    />
  );
}
