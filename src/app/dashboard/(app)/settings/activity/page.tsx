import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { PageHeader } from "@/components/shared/PageHeader";
import { ActivityTimeline, type ActivityItem } from "@/components/settings/ActivityTimeline";

export const metadata: Metadata = {
  title: "Activity Logs | Chowdhury Agro",
};

export default async function ActivityLogPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);

  // Fetch recent data across tables to construct a unified log
  const [
    { data: cattle },
    { data: allCattleTags },
    { data: sales },
    { data: costs },
    { data: invPurchases },
    { data: treatments },
    { data: healthEvents },
    { data: partnerTxns },
    { data: loans },
  ] = await Promise.all([
    businessId
      ? supabase.from("cattle").select("id, tag_id, created_at, purchase_price").eq("business_id", businessId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("cattle").select("id, tag_id").eq("business_id", businessId).is("deleted_at", null).limit(1000)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("sales").select("id, cattle_id, sold_at, sale_price_total, buyer_name, cattle!inner(business_id)").eq("cattle.business_id", businessId).is("deleted_at", null).order("sold_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("cost_entries").select("id, category, amount, recorded_at, description").eq("business_id", businessId).is("deleted_at", null).neq("category", "Medical/Vet Fee").order("recorded_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("inventory_transactions").select("id, qty, unit_cost, recorded_at, inventory_items!inner(name, unit, business_id)").eq("inventory_items.business_id", businessId).eq("type", "purchase").order("recorded_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("cattle_treatments").select("id, cattle_id, vet_fee, additional_medical_cost, diagnosis, treated_at, cattle!inner(business_id)").eq("cattle.business_id", businessId).order("treated_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("health_events").select("id, cattle_id, title, event_type, completed_at").eq("business_id", businessId).not("completed_at", "is", null).is("deleted_at", null).order("completed_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("partner_transactions").select("id, amount, type, recorded_at, partners!inner(business_id, name)").eq("partners.business_id", businessId).is("deleted_at", null).order("recorded_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("loans").select("id, lender_name, principal_amount, loan_date, loan_payments(id, amount, paid_at)").eq("business_id", businessId).is("deleted_at", null).order("loan_date", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  const activities: ActivityItem[] = [];

  type CattleRow      = { id: string; tag_id: string; purchase_price: number; created_at: string };
  type SaleRow        = { id: string; buyer_name: string | null; sale_price_total: number; sold_at: string };
  type CostRow        = { id: string; category: string; amount: number; description: string | null; recorded_at: string };
  type InvPurchaseRow = { id: string; qty: number; unit_cost: number | null; recorded_at: string; inventory_items: { name: string; unit: string } | null };
  type TreatmentRow   = { id: string; cattle_id: string; vet_fee: number; additional_medical_cost: number; diagnosis: string | null; treated_at: string };
  type HealthRow      = { id: string; cattle_id: string; title: string; event_type: string; completed_at: string };
  type PartnerTxnRow  = { id: string; amount: number; type: string; recorded_at: string; partners: { name: string } | null };
  type LoanRow        = { id: string; lender_name: string; principal_amount: number; loan_date: string; loan_payments: { id: string; amount: number; paid_at: string }[] };

  const tagMap = new Map<string, string>();
  for (const c of (allCattleTags ?? []) as { id: string; tag_id: string }[]) tagMap.set(c.id, c.tag_id);

  (cattle as CattleRow[] ?? []).forEach((c) => {
    activities.push({
      id: `c_${c.id}`,
      type: "cattle_add",
      title: "New Cattle Purchased",
      description: `Tag: ${c.tag_id} | Price: ৳${c.purchase_price}`,
      date: c.created_at,
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    });
  });

  (sales as SaleRow[] ?? []).forEach((s) => {
    activities.push({
      id: `s_${s.id}`,
      type: "cattle_sold",
      title: "Cattle Sold",
      description: `Sold to ${s.buyer_name || "Unknown"} | Amount: ৳${s.sale_price_total}`,
      date: s.sold_at,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
    });
  });

  (costs as CostRow[] ?? []).forEach((c) => {
    activities.push({
      id: `cost_${c.id}`,
      type: "cost_add",
      title: `Expense: ${c.category}`,
      description: `Amount: ৳${c.amount} | ${c.description || ""}`,
      date: c.recorded_at,
      color: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
    });
  });

  (invPurchases as InvPurchaseRow[] ?? []).forEach((p) => {
    const name = p.inventory_items?.name ?? "Item";
    const amount = p.unit_cost != null ? Math.round(p.qty * p.unit_cost) : null;
    activities.push({
      id: `inv_${p.id}`,
      type: "inventory_purchase",
      title: `Purchased: ${name}`,
      description: `${p.qty} ${p.inventory_items?.unit ?? ""}${amount != null ? ` | Cost: ৳${amount}` : ""}`,
      date: p.recorded_at,
      color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    });
  });

  (treatments as TreatmentRow[] ?? []).forEach((tr) => {
    const totalCost = (tr.vet_fee ?? 0) + (tr.additional_medical_cost ?? 0);
    if (totalCost <= 0 && !tr.diagnosis) return;
    const tag = tagMap.get(tr.cattle_id) ?? tr.cattle_id.slice(0, 6);
    activities.push({
      id: `tr_${tr.id}`,
      type: "medical_treatment",
      title: `Treatment: Cattle #${tag}`,
      description: `${tr.diagnosis || "Medical treatment"}${totalCost > 0 ? ` | Cost: ৳${totalCost}` : ""}`,
      date: tr.treated_at,
      color: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400",
    });
  });

  (healthEvents as HealthRow[] ?? []).forEach((h) => {
    const tag = tagMap.get(h.cattle_id) ?? h.cattle_id.slice(0, 6);
    activities.push({
      id: `he_${h.id}`,
      type: "health_event",
      title: `${h.event_type === "vaccine" ? "Vaccinated" : h.event_type === "checkup" ? "Checkup" : "Health Event"}: Cattle #${tag}`,
      description: h.title,
      date: h.completed_at,
      color: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
    });
  });

  (partnerTxns as PartnerTxnRow[] ?? []).forEach((t) => {
    const name = t.partners?.name ?? "Partner";
    const label = t.type === "investment" ? "Investment" : t.type === "profit" ? "Profit Paid" : "Withdrawal";
    activities.push({
      id: `pt_${t.id}`,
      type: "partner_txn",
      title: `${label}: ${name}`,
      description: `Amount: ৳${t.amount}`,
      date: t.recorded_at,
      color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400",
    });
  });

  (loans as LoanRow[] ?? []).forEach((l) => {
    activities.push({
      id: `loan_${l.id}`,
      type: "loan",
      title: `Loan Taken: ${l.lender_name}`,
      description: `Amount: ৳${l.principal_amount}`,
      date: l.loan_date,
      color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
    });
    for (const p of l.loan_payments ?? []) {
      activities.push({
        id: `loanpay_${p.id}`,
        type: "loan",
        title: `Loan Payment: ${l.lender_name}`,
        description: `Amount: ৳${p.amount}`,
        date: p.paid_at,
        color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
      });
    }
  });

  // Sort all activities by date descending
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Activity Logs" 
        subtitle="A unified timeline of all recent events and transactions on the farm."
      />

      <ActivityTimeline activities={activities} />
    </div>
  );
}
