import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Partner, PartnerTransaction, ManagementFeeRate } from "@/types/database";
import { StatementClient } from "@/components/partners/StatementClient";
import {
  effectiveShare,
  computeAccount,
  type PartnerAccountSummary as AccountSummary,
} from "@/lib/partners/calculations";
import { PartnerEngine } from "@/lib/partners/partner-engine";

export const metadata: Metadata = { title: "Partner Statement" };

export type { AccountSummary };

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

  const partnerEquity = PartnerEngine.calculatePartnerEquity({
    partner,
    allPartners,
    txnsByPartner,
    netPLAfterFee,
  });

  const sharePct = partnerEquity.effectiveSharePct;
  const acc: AccountSummary = {
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
