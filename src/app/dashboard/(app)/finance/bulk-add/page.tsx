import { createClient } from "@/lib/supabase/server";
import { siteTitle } from "@/components/navigation/site-map";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { BulkCostClient } from "@/components/finance/BulkCostClient";
import { FileDiff } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getL } from "@/i18n/server-text";

export const metadata = {
  title: "Bulk Add Costs | Tanvir Agro",
};

export default async function BulkCostPage() {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.COST_ENTRY_CREATE);
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <PageHeader
        title={siteTitle(L, "/dashboard/finance/bulk-add", "Add Bulk Expenses")}
        subtitle={L("একসাথে কয়েকটি খরচ (বেতন, ভাড়া, বিদ্যুৎ) বা সম্পদ লিখুন।", "Quickly log multiple expenses (salary, rent, electricity) or assets at once.")}
        icon={FileDiff}
        back="/dashboard/finance"
      />

      <BulkCostClient />
    </div>
  );
}
