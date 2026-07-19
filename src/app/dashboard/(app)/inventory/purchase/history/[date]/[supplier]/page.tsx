import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EditPurchaseMemoClient } from "@/components/inventory/EditPurchaseMemoClient";

export const metadata = {
  title: "Edit Purchase Memo | Tanvir Agro",
};

export default async function EditPurchaseMemoPage({
  params,
}: {
  params: Promise<{ date: string; supplier: string }>;
}) {
  const { date, supplier } = await params;
  const decodedSupplier = decodeURIComponent(supplier);

  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  // Fetch all items for the dropdown
  const { data: itemsData } = await supabase
    .from("inventory_items")
    .select("id, name, category, unit, is_discontinued")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const allItems = (itemsData ?? []).filter(i => !i.is_discontinued);

  // Fetch transactions for this date
  const { data: txns } = await supabase
    .from("inventory_transactions")
    .select("id, item_id, qty, unit_cost, notes")
    .eq("type", "purchase")
    .eq("recorded_at", date);

  // Filter in JS to perfectly match the supplier from notes
  const memoTxns = (txns || []).filter((tx) => {
    const supplierMatch = tx.notes?.match(/Supplier:\s*(.*?)(?:\. | \| |\.?$|$)/);
    if (supplierMatch && supplierMatch[1]) {
      let extracted = supplierMatch[1].trim();
      if (extracted.endsWith('.')) extracted = extracted.slice(0, -1);
      return extracted === decodedSupplier;
    }
    return false;
  });

  if (memoTxns.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <h2>Memo not found or deleted.</h2>
        <Link href="/dashboard/inventory/purchase/history" className="text-primary hover:underline mt-4 inline-block">Go Back</Link>
      </div>
    );
  }

  // Find any extra notes from the first transaction
  let extraNotes = "";
  let initialTransportCost = 0;
  const firstTxn = memoTxns[0];
  if (firstTxn.notes) {
    const transportMatch = firstTxn.notes.match(/Transport:\s*([\d.]+)/);
    if (transportMatch && transportMatch[1]) {
      initialTransportCost = parseFloat(transportMatch[1]);
    }
    
    // extra notes might be anything after transport, or after supplier if transport is missing
    const parts = firstTxn.notes.split(" | ");
    // index 0 is Invoice Memo. Supplier...
    // index 1 might be Transport...
    const nonSystemParts = parts.filter(p => 
      !p.startsWith("Invoice Memo.") && 
      !p.startsWith("Transport:") && 
      !p.startsWith("Mode:") && 
      !p.startsWith("Bags:") && 
      !p.startsWith("KgPerBag:")
    );
    extraNotes = nonSystemParts.join(" | ").trim();
  }

  // Reverse landed cost math to get raw item costs
  const totalLanded = memoTxns.reduce((sum, tx) => sum + (tx.qty * (tx.unit_cost || 0)), 0);
  const totalRaw = Math.max(0, totalLanded - initialTransportCost);
  const ratio = totalLanded > 0 ? (totalRaw / totalLanded) : 1;

  const rawTxns = memoTxns.map(tx => {
    let mode = "loose";
    let bags = "";
    let kgPerBag = "";
    
    if (tx.notes) {
      const modeMatch = tx.notes.match(/Mode:\s*([a-zA-Z]+)/);
      if (modeMatch && modeMatch[1]) mode = modeMatch[1];
      
      const bagsMatch = tx.notes.match(/Bags:\s*([\d.]+)/);
      if (bagsMatch && bagsMatch[1]) bags = bagsMatch[1];
      
      const kgMatch = tx.notes.match(/KgPerBag:\s*([\d.]+)/);
      if (kgMatch && kgMatch[1]) kgPerBag = kgMatch[1];
    }

    return {
      ...tx,
      raw_total_cost: tx.qty * (tx.unit_cost || 0) * ratio,
      mode,
      bags,
      kgPerBag
    };
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Edit Purchase Memo"
        subtitle={`${decodedSupplier} • ${date}`}
        icon={ReceiptText}
        back="/dashboard/inventory/purchase/history"
      />

      <EditPurchaseMemoClient 
        date={date} 
        supplierName={decodedSupplier} 
        existingTxns={rawTxns} 
        extraNotes={extraNotes}
        initialTransportCost={initialTransportCost}
        items={allItems} 
      />
    </div>
  );
}
