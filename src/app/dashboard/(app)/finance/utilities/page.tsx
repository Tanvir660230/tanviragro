import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { todayDhaka } from "@/lib/dates";
import { monthlyExpenseSummary } from "@/lib/expenses/categories";
import { UtilityExpensesClient, type UtilityExpense, type UtilityAudit } from "@/components/finance/UtilityExpensesClient";
import type { ExpenseCategory } from "@/types/database";

export const metadata: Metadata = { title: "Utility Expenses" };

export default async function UtilityExpensesPage() {
  const ctx = await requirePagePermission(PERMISSIONS.FINANCE_VIEW);
  const supabase = await createClient();

  const [{ data: catData }, { data: entryData }] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("*")
      .eq("business_id", ctx.businessId)
      .eq("kind", "utility")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("cost_entries")
      .select("id, category, category_id, amount, recorded_at, description, attachment_path, created_at")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .or("category.eq.utilities,category_id.not.is.null")
      .order("recorded_at", { ascending: false })
      .limit(1000),
  ]);

  const categories = (catData ?? []) as ExpenseCategory[];
  const utilityIds = new Set(categories.map((c) => c.id));
  // utility expenses = linked to a utility category, or legacy free-text "utilities"
  const expenses = ((entryData ?? []) as UtilityExpense[]).filter((e) =>
    e.category_id ? utilityIds.has(e.category_id) : e.category === "utilities"
  );

  const ids = expenses.map((e) => e.id);
  const { data: auditData } = ids.length
    ? await supabase
        .from("cost_entry_audit")
        .select("cost_entry_id, action, old_row, new_row, changed_at")
        .in("cost_entry_id", ids)
        .in("action", ["update", "restore"])
        .order("changed_at", { ascending: false })
    : { data: [] };

  const summary = monthlyExpenseSummary(expenses, todayDhaka(), 12);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Utility Expenses"
        subtitle="Electricity, internet, gas, water and other utilities — kept separate from feed and cattle costs"
        icon={Zap}
        back="/dashboard/finance"
      />
      <UtilityExpensesClient
        categories={categories}
        expenses={expenses}
        audits={(auditData ?? []) as UtilityAudit[]}
        summary={summary}
        today={todayDhaka()}
        canCreate={hasPermission(ctx, PERMISSIONS.COST_ENTRY_CREATE)}
        canEdit={hasPermission(ctx, PERMISSIONS.COST_ENTRY_EDIT)}
        canDelete={hasPermission(ctx, PERMISSIONS.COST_ENTRY_DELETE)}
        canManageCategories={hasPermission(ctx, PERMISSIONS.SETTINGS_EDIT)}
      />
    </div>
  );
}
