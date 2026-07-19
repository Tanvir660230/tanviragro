"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type PurchaseItem = {
  isNew: boolean;
  itemId?: string; 
  newItemName?: string;
  newItemCategory?: string; // "feed", "medicine", "equipment"
  newItemUnit?: string;
  qty: number;
  itemTotalCost: number;
  mode?: string;
  bags?: string;
  kgPerBag?: string;
};

export async function submitBulkPurchase(formData: FormData, items: PurchaseItem[]) {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const date = formData.get("date") as string;
  const supplierName = formData.get("supplierName") as string;
  const transportCost = parseFloat(formData.get("transportCost") as string) || 0;
  const paymentMethod = formData.get("paymentMethod") as string; // "cash", "due", "partial"
  const paidAmountStr = formData.get("paidAmount") as string;
  const paidAmount = paidAmountStr ? parseFloat(paidAmountStr) : 0;
  const notes = formData.get("notes") as string;

  if (!date) return { error: "Date is required" };
  if (!supplierName) return { error: "Supplier Name is required" };
  if (!items || items.length === 0) return { error: "No items added to invoice" };
  for (const it of items) {
    if (!it.qty || it.qty <= 0) return { error: "Each item must have a positive quantity" };
    if (it.itemTotalCost < 0) return { error: "Item cost cannot be negative" };
  }

  const lockError = await checkFinancialLock(supabase, businessId, date);
  if (lockError) return { error: lockError };

  // Total raw items cost
  const rawItemsTotal = items.reduce((sum, it) => sum + (it.itemTotalCost || 0), 0);
  const totalBill = rawItemsTotal + transportCost;

  let dueAmount = 0;
  if (paymentMethod === "due") {
    dueAmount = totalBill;
  } else if (paymentMethod === "partial") {
    dueAmount = totalBill - paidAmount;
    if (dueAmount < 0) return { error: "Paid amount cannot exceed total bill" };
  }

  // Handle New Items Creation first
  const finalItems = [];
  for (const it of items) {
    let finalItemId = it.itemId;
    if (it.isNew) {
      if (!it.newItemName || !it.newItemCategory || !it.newItemUnit) {
        return { error: "New items must have name, category, and unit" };
      }
      const { data: insertedItem, error: itemErr } = await supabase
        .from("inventory_items")
        .insert({
          business_id: businessId,
          name: it.newItemName,
          category: it.newItemCategory as "feed" | "medicine" | "equipment" | "roughage" | "other",
          unit: it.newItemUnit,
        })
        .select("id")
        .single();
      if (itemErr) return { error: `Failed to create item: ${it.newItemName}` };
      finalItemId = insertedItem.id;
    }
    if (!finalItemId) return { error: "Item ID missing" };
    finalItems.push({ ...it, itemId: finalItemId });
  }

  // Prepare inventory transactions
  const txnsToInsert = finalItems.map((it) => {
    // Distribute transport cost based on item cost value
    let landedCost = it.itemTotalCost || 0;
    if (rawItemsTotal > 0 && transportCost > 0) {
      landedCost += transportCost * (landedCost / rawItemsTotal);
    } else if (rawItemsTotal === 0 && transportCost > 0) {
      landedCost += transportCost / items.length;
    }
    
    const unit_cost = parseFloat((landedCost / it.qty).toFixed(4));
    
    return {
      item_id: it.itemId,
      type: "purchase" as const,
      qty: it.qty,
      unit_cost: unit_cost,
      recorded_at: date,
      notes: `Invoice Memo. Supplier: ${supplierName}. | Transport: ${transportCost} | Mode: ${it.mode || "loose"} | Bags: ${it.bags || ""} | KgPerBag: ${it.kgPerBag || ""}` + (notes ? ` | ${notes}` : ""),
    };
  });

  const { error: txErr } = await supabase.from("inventory_transactions").insert(txnsToInsert);
  if (txErr) return { error: "Failed to record transactions" };

  // Create or Update Liability if due
  if (dueAmount > 0) {
    const { data: existingLiab } = await supabase
      .from("liabilities")
      .select("id, principal, outstanding, notes")
      .eq("business_id", businessId)
      .eq("category", "accounts_payable")
      .is("settled_at", null)
      .ilike("lender", supplierName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLiab) {
      const { error: liabErr } = await supabase
        .from("liabilities")
        .update({
          principal: existingLiab.principal + dueAmount,
          outstanding: existingLiab.outstanding + dueAmount,
          notes: existingLiab.notes + `\n+ ${dueAmount} on ${date} (Bulk Purchase).`,
        })
        .eq("id", existingLiab.id);
      if (liabErr) console.error("Liability update failed:", liabErr);
    } else {
      const { error: liabErr } = await supabase.from("liabilities").insert({
        business_id: businessId,
        name: `Due to ${supplierName} (Inv)`,
        category: "accounts_payable",
        principal: dueAmount,
        outstanding: dueAmount,
        recorded_at: date,
        lender: supplierName,
        notes: `Due for bulk purchase invoice on ${date}`,
      });
      if (liabErr) console.error("Liability creation failed:", liabErr);
    }
  }

  revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });

  return { success: true };
}
