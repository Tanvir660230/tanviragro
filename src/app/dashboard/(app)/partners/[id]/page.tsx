import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { User } from "lucide-react";
import { PartnerProfileClient } from "@/components/partners/PartnerProfileClient";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getCachedBusinessId, getServerClient } from "@/lib/supabase/cached";
import { getL } from "@/i18n/server-text";
import { loadPartnerData } from "@/lib/partners/load-positions";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { loadPartnerHeldCash } from "@/lib/money/holder-view";

export const metadata: Metadata = { title: "অংশীদার" };

export default async function PartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.PARTNERS_VIEW);
  const { id } = await params;
  const businessId = await getCachedBusinessId();
  if (!businessId) notFound();

  // the same calculation as the partners page (lib/partners/position.ts)
  const supabase = await getServerClient();
  const [data, ctx, held] = await Promise.all([loadPartnerData(supabase, businessId), getBusinessContext(supabase), loadPartnerHeldCash(supabase, businessId, id)]);
  const partner = data.partners.find((p) => p.id === id);
  const position = data.positions.find((p) => p.id === id);
  if (!partner || !position) notFound();

  const transactions = [...(data.txnsByPartner[id] ?? [])].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  return (
    <div className="space-y-5">
      <PageHeader title={partner.name} subtitle={L("অংশীদারের প্রোফাইল", "Partner profile")} back="/dashboard/partners" icon={User} />
      {held && (
        <Link href={`/dashboard/finance/holders/${held.holderId}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm hover:bg-amber-500/10">
          <Wallet className="h-4 w-4 text-amber-600" aria-hidden />
          <span>{L(`খামারের নগদ ${held.balance < 0 ? "−" : ""}৳${Math.round(Math.abs(held.balance)).toLocaleString("en-IN")} এখন ${partner.name}-এর কাছে`, `${held.balance < 0 ? "−" : ""}৳${Math.round(Math.abs(held.balance)).toLocaleString("en-IN")} of the farm's cash is with ${partner.name}`)}</span>
          <span className="text-xs text-muted-foreground">{L("— এটা খামারের টাকা, তাঁর পাওনা নয়; হিসাব মেটানোর আগে হাতবদল করে নিন", "— it is the farm's money, not their share; hand it over before settling")}</span>
        </Link>
      )}
      <PartnerProfileClient
        partner={partner}
        transactions={transactions}
        position={position}
        farm={{
          realized: data.farm.realized, estimate: data.farm.estimate, total: data.farm.total,
          soldCount: data.farm.animals.filter((a) => a.status !== "active").length,
          marketPricePerKg: data.farm.marketPricePerKg, herdValued: data.farm.herdValued,
          cycles: data.farm.cycles.map((c) => ({ closedOn: c.closedOn, from: c.from, share: c.shares[id] ?? 0 })),
        }}
        money={{ cash: data.cash, moneyTypesEnabled: data.cyclesEnabled }}
        shareRules={{
          partner: data.positionPartners.find((p) => p.id === id)!,
          partners: data.positionPartners,
          rules: data.rules,
          lockedUntil: data.lockedUntil,
          rulesEnabled: data.rulesEnabled,
          canManage: hasPermission(ctx, PERMISSIONS.PARTNERS_MANAGE),
        }}
      />
    </div>
  );
}
