import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { BulkCostClient } from "@/components/finance/BulkCostClient";
import { ArrowLeft, FileDiff } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata = {
  title: "Bulk Add Costs | Tanvir Agro",
};

export default async function BulkCostPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Add Bulk Expenses"
        subtitle="Quickly log multiple expenses (salary, rent, electricity) or assets at once."
        icon={FileDiff}
        back="/dashboard/finance"
      />

      <BulkCostClient />
    </div>
  );
}
