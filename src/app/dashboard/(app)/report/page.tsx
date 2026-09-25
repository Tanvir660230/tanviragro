import { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/cached";
import { ReportHubClient } from "@/components/report/ReportHubClient";
import { ReportEngine } from "@/lib/reports/report-engine";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getCachedBusinessId } from "@/lib/supabase/cached";

export const metadata: Metadata = {
  title: "রিপোর্ট",
  description: "খামারের হিসাব, গরু ও খাবারের রিপোর্ট",
};

export default async function ReportPage() {
  await requirePagePermission(PERMISSIONS.REPORTS_VIEW);
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: bizRow } = userId
    ? await supabase
        .from("businesses")
        .select("id, name")
        .eq("id", (await getCachedBusinessId()) ?? "")
        .maybeSingle()
    : { data: null };

  const businessId: string | null = (bizRow as { id?: string } | null)?.id ?? null;
  const bizName: string           = (bizRow as { name?: string } | null)?.name ?? "Tanvir Agro";

  if (!businessId) {
    return (
      <ReportHubClient
        bizName={bizName}
        reportDate={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        reportId="TA-RPT-EMPTY"
        totalCattle={0}
        activeCattle={0}
        soldCattle={0}
        activeCattleValuation={0}
        revenue={0}
        soldCattleCost={0}
        feedCost={0}
        operatingCosts={0}
        netPL={0}
        cashBalance={0}
        bankBalance={0}
        totalLiquidCash={0}
        totalInventoryValue={0}
        inventoryWithStock={[]}
        totalLiabilities={0}
        netEquity={0}
        zakatAssets={0}
      />
    );
  }

  const [reportData] = await Promise.all([
    ReportEngine.generateFinancialStatementReport(supabase, businessId, bizName).catch((err) => {
      console.error("ReportEngine.generateFinancialStatementReport error:", err);
      return {
        bizName,
        reportDate: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        reportId: "TA-RPT-FALLBACK",
        totalCattle: 0,
        activeCattle: 0,
        soldCattle: 0,
        activeCattleValuation: 0,
        revenue: 0,
        soldCattleCost: 0,
        feedCost: 0,
        operatingCosts: 0,
        netPL: 0,
        cashBalance: 0,
        bankBalance: 0,
        totalLiquidCash: 0,
        totalInventoryValue: 0,
        inventoryWithStock: [],
        totalLiabilities: 0,
        netEquity: 0,
        zakatAssets: 0,
      };
    }),
  ]);

  return <ReportHubClient {...reportData} />;
}

