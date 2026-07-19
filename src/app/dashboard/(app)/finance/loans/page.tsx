import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { LoanDashboard } from "@/components/finance/LoanDashboard";
import type { LoanRow } from "@/components/finance/LoanDashboard";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Loan & Debt Tracker" };

export default async function LoansPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");
  const tr = t.finance.loans;

  const { data } = businessId
    ? await supabase
        .from("loans")
        .select("*, loan_payments(id, amount, paid_at, notes)")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("loan_date", { ascending: false })
    : { data: [] };

  type RawLoan = Omit<LoanRow, "payments"> & { loan_payments: LoanRow["payments"] };
  const loans: LoanRow[] = ((data ?? []) as RawLoan[]).map((l) => ({
    ...l,
    payments: (l.loan_payments ?? []).sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    ),
  }));

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title={tr.title}
        subtitle={tr.subtitle}
        icon={Landmark}
        back="/dashboard/finance"
      />
      <LoanDashboard loans={loans} />
    </div>
  );
}
