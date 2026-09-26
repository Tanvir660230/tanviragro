import type { Metadata } from "next";
import { PartnerDashboard } from "@/components/partners/PartnerDashboard";
import { CapitalLedger, type CapitalTxn } from "@/components/partners/CapitalLedger";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";
import { Users } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getCachedBusinessId, getServerClient } from "@/lib/supabase/cached";
import { loadPartnerData } from "@/lib/partners/load-positions";

export const metadata: Metadata = { title: "অংশীদার" };

export default async function PartnersPage() {
  await requirePagePermission(PERMISSIONS.PARTNERS_VIEW);
  const supabase = await getServerClient();
  const locale = (await cookies()).get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const dict = await getDictionary(locale as "en" | "bn");
  const businessId = (await getCachedBusinessId()) ?? "";

  // one calculation for every partner page (lib/partners/position.ts)
  const { farm, positions, partners, txnsByPartner } = await loadPartnerData(supabase, businessId);

  const nameById = Object.fromEntries(partners.map((p) => [p.id, p.name]));
  const capitalTxns: CapitalTxn[] = Object.values(txnsByPartner).flat()
    .filter((t) => t.type === "investment" || t.type === "withdrawal")
    .map((t) => ({
      id: t.id, partner_id: t.partner_id, partner_name: nameById[t.partner_id] ?? "—",
      amount: Number(t.amount), type: t.type as "investment" | "withdrawal", recorded_at: t.recorded_at, notes: t.notes,
    }));

  return (
    <div className="space-y-5">
      <PageHeader title={dict.partners.title} subtitle={dict.partners.subtitle} icon={Users} />
      <PartnerDashboard farm={farm} positions={positions} partners={partners} />
      {capitalTxns.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card px-6 py-5 shadow-card">
          <CapitalLedger transactions={capitalTxns} />
        </div>
      )}
    </div>
  );
}
