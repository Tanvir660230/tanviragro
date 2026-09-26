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

export const metadata: Metadata = { title: "অংশীদার" };

export default async function PartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.PARTNERS_VIEW);
  const { id } = await params;
  const businessId = await getCachedBusinessId();
  if (!businessId) notFound();

  // the same calculation as the partners page (lib/partners/position.ts)
  const supabase = await getServerClient();
  const [data, ctx] = await Promise.all([loadPartnerData(supabase, businessId), getBusinessContext(supabase)]);
  const partner = data.partners.find((p) => p.id === id);
  const position = data.positions.find((p) => p.id === id);
  if (!partner || !position) notFound();

  const transactions = [...(data.txnsByPartner[id] ?? [])].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  return (
    <div className="space-y-5">
      <PageHeader title={partner.name} subtitle={L("অংশীদারের প্রোফাইল", "Partner profile")} back="/dashboard/partners" icon={User} />
      <PartnerProfileClient
        partner={partner}
        transactions={transactions}
        position={position}
        farm={{
          realized: data.farm.realized, estimate: data.farm.estimate, total: data.farm.total,
          soldCount: data.farm.animals.filter((a) => a.status !== "active").length,
          marketPricePerKg: data.farm.marketPricePerKg, herdValued: data.farm.herdValued,
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
