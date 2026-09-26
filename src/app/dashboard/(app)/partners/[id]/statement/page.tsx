import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatementClient } from "@/components/partners/StatementClient";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getCachedBusinessId, getServerClient } from "@/lib/supabase/cached";
import { getCurrentBusiness } from "@/lib/supabase/get-business";
import { loadPartnerData } from "@/lib/partners/load-positions";

export const metadata: Metadata = { title: "অংশীদারের হিসাব বিবরণী" };

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission(PERMISSIONS.PARTNERS_STATEMENT);
  const { id } = await params;
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) notFound();

  // the same calculation as the partners page and the profile (lib/partners/position.ts)
  const [data, biz] = await Promise.all([loadPartnerData(supabase, businessId), getCurrentBusiness(supabase)]);
  const partner = data.partners.find((p) => p.id === id);
  const position = data.positions.find((p) => p.id === id);
  if (!partner || !position) notFound();

  const transactions = [...(data.txnsByPartner[id] ?? [])].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const statementDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());

  return (
    <StatementClient
      businessName={biz?.name ?? "Farm"}
      partner={partner}
      transactions={transactions}
      position={position}
      statementDate={statementDate}
      backUrl={`/dashboard/partners/${id}`}
    />
  );
}
