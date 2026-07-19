import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, ReceiptText, Calendar, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { format } from "date-fns";

export const metadata = {
  title: "Purchase History | Tanvir Agro",
};

type MemoGroup = {
  date: string;
  supplier: string;
  itemCount: number;
  totalCost: number;
  transactions: any[];
};

export default async function PurchaseHistoryPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  // Fetch all purchase transactions for this business
  const { data: txns } = await supabase
    .from("inventory_transactions")
    .select(`
      id,
      item_id,
      qty,
      unit_cost,
      recorded_at,
      notes,
      created_at,
      inventory_items!inner(business_id, name, unit)
    `)
    .eq("inventory_items.business_id", businessId)
    .eq("type", "purchase")
    .order("recorded_at", { ascending: false })
    .order("created_at", { ascending: false });

  // Group transactions into memos
  const memosMap = new Map<string, MemoGroup>();

  (txns || []).forEach((tx) => {
    // Extract supplier from notes
    // Notes format: "Invoice Memo. Supplier: Supplier Name." or "Invoice Memo. Supplier: Supplier Name. | Extra"
    let supplierName = "Unknown Supplier";
    const supplierMatch = tx.notes?.match(/Supplier:\s*(.*?)(?:\. | \| |\.?$|$)/);
    if (supplierMatch && supplierMatch[1]) {
      supplierName = supplierMatch[1].trim();
      if (supplierName.endsWith('.')) {
        supplierName = supplierName.slice(0, -1);
      }
    }

    const groupKey = `${tx.recorded_at}_${supplierName}`;
    const totalCost = Number(tx.qty) * Number(tx.unit_cost || 0);

    if (!memosMap.has(groupKey)) {
      memosMap.set(groupKey, {
        date: tx.recorded_at,
        supplier: supplierName,
        itemCount: 0,
        totalCost: 0,
        transactions: [],
      });
    }

    const group = memosMap.get(groupKey)!;
    group.itemCount += 1;
    group.totalCost += totalCost;
    group.transactions.push(tx);
  });

  const memos = Array.from(memosMap.values());

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Purchase History"
        subtitle="View and modify past bulk purchase memos."
        icon={History}
        back="/dashboard/inventory"
      />

      <div className="glass-panel border-primary/10 shadow-md">
        <div className="border-b border-border bg-muted/30 px-5 py-4 rounded-t-2xl">
          <h2 className="text-sm font-semibold text-foreground">All Memos</h2>
        </div>
        
        {memos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ReceiptText className="mx-auto h-8 w-8 opacity-20 mb-3" />
            <p>No purchase memos found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border bg-background rounded-b-2xl">
            {memos.map((memo, idx) => (
              <Link
                key={idx}
                href={`/dashboard/inventory/purchase/history/${memo.date}/${encodeURIComponent(memo.supplier)}`}
                className="flex items-center justify-between p-5 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ReceiptText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {memo.supplier}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(memo.date), "MMM d, yyyy")}
                      </span>
                      <span>•</span>
                      <span>{memo.itemCount} items</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="font-bold text-base">{memo.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ৳</div>
                    <div className="text-xs text-muted-foreground">Total Value</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors opacity-50 group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
