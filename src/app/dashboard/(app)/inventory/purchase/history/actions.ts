"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type EditPurchaseItem = {
  id?: string; // existing txn id, undefined if new
  isNew: boolean;
  itemId?: string; // inventory_items id
  newItemName?: string;
  newItemCategory?: string;
  newItemUnit?: string;
  qty: number;
  itemTotalCost: number; // to calculate unit_cost
  mode?: string;
  bags?: string;
  kgPerBag?: string;
};

export async function updatePurchaseMemo(
  date: string, 
  supplierName: string, 
  extraNotes: string, 
  transportCost: number,
  items: EditPurchaseItem[],
  existingTxnIds: string[]
) {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!date) return { error: "Date is required" };
  if (!supplierName) return { error: "Supplier Name is required" };
  if (!items || items.length === 0) return { error: "Cannot have an empty memo. To delete, use the delete memo function." };

  const lockError = await checkFinancialLock(supabase, businessId, date);
  if (lockError) return { error: lockError };

  // Fetch existing transactions to check stock and calculate original bill
  const { data: existingTxns } = await supabase
    .from("inventory_transactions")
    .select("id, item_id, qty, unit_cost")
    .in("id", existingTxnIds);

  let originalTotalBill = 0;
  const existingMap = new Map();
  if (existingTxns) {
    for (const tx of existingTxns) {
      originalTotalBill += tx.qty * (tx.unit_cost || 0);
      existingMap.set(tx.id, tx);
    }
  }

  // Handle New Items Creation first
  const finalItems = [];
  const rawItemsTotal = items.reduce((sum, it) => sum + (it.itemTotalCost || 0), 0);
  const newTotalBill = rawItemsTotal + transportCost;

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
    
    // Calculate landed cost
    let landedCost = it.itemTotalCost || 0;
    if (rawItemsTotal > 0 && transportCost > 0) {
      landedCost += transportCost * (landedCost / rawItemsTotal);
    } else if (rawItemsTotal === 0 && transportCost > 0) {
      landedCost += transportCost / items.length;
    }
    
    finalItems.push({ ...it, itemId: finalItemId, landedCost });
  }

  const itemsToUpdate = finalItems.filter(it => it.id);
  const itemsToInsert = finalItems.filter(it => !it.id);
  
  const updatedIds = itemsToUpdate.map(it => it.id!);
  const idsToDelete = existingTxnIds.filter(id => !updatedIds.includes(id));

  // --- Pre-flight Stock Validation ---
  const allAffectedItemIds = [...new Set([...finalItems.map(it => it.itemId), ...(existingTxns || []).map(tx => tx.item_id)])];
  const { data: currentStockRows } = await supabase
    .from("inventory_transactions")
    .select("item_id, type, qty")
    .in("item_id", allAffectedItemIds);

  const stockMap = new Map();
  if (currentStockRows) {
    for (const row of currentStockRows) {
      const isAddition = row.type === "purchase";
      const change = isAddition ? row.qty : -row.qty;
      stockMap.set(row.item_id, (stockMap.get(row.item_id) || 0) + change);
    }
  }

  // Check deletions
  for (const delId of idsToDelete) {
    const exTx = existingMap.get(delId);
    if (exTx) {
      const currentStock = stockMap.get(exTx.item_id) || 0;
      if (currentStock < exTx.qty) {
         return { error: `Cannot remove an item because you only have ${currentStock} left in stock (trying to remove ${exTx.qty}).` };
      }
    }
  }

  // Check updates (reductions)
  for (const it of itemsToUpdate) {
    const exTx = existingMap.get(it.id);
    if (exTx && it.qty < exTx.qty) {
      const currentStock = stockMap.get(exTx.item_id) || 0;
      const reduction = exTx.qty - it.qty;
      if (currentStock < reduction) {
        return { error: `Cannot reduce item quantity. You only have ${currentStock} left in stock, but trying to reduce by ${reduction}.` };
      }
    }
  }

  // 1. Delete removed items
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("inventory_transactions")
      .delete()
      .in("id", idsToDelete);
      
    if (delErr) return { error: "Failed to delete removed items." };
  }

  // 2. Update existing items
  for (const it of itemsToUpdate) {
    const unit_cost = parseFloat((it.landedCost / it.qty).toFixed(4));
    const notesString = `Invoice Memo. Supplier: ${supplierName}. | Transport: ${transportCost} | Mode: ${it.mode || "loose"} | Bags: ${it.bags || ""} | KgPerBag: ${it.kgPerBag || ""}` + (extraNotes ? ` | ${extraNotes}` : "");
    const { error: upErr } = await supabase
      .from("inventory_transactions")
      .update({
        qty: it.qty,
        unit_cost: unit_cost,
        notes: notesString
      })
      .eq("id", it.id!);
      
    if (upErr) return { error: "Failed to update item." };
  }

  // 3. Insert new items
  if (itemsToInsert.length > 0) {
    const txnsToInsert = itemsToInsert.map(it => ({
      item_id: it.itemId,
      type: "purchase" as const,
      qty: it.qty,
      unit_cost: parseFloat((it.landedCost / it.qty).toFixed(4)),
      recorded_at: date,
      notes: `Invoice Memo. Supplier: ${supplierName}. | Transport: ${transportCost} | Mode: ${it.mode || "loose"} | Bags: ${it.bags || ""} | KgPerBag: ${it.kgPerBag || ""}` + (extraNotes ? ` | ${extraNotes}` : ""),
    }));

    const { error: insErr } = await supabase.from("inventory_transactions").insert(txnsToInsert);
    if (insErr) return { error: "Failed to add new items." };
  }

  // --- Liability Adjustment ---
  const difference = newTotalBill - originalTotalBill;
  if (Math.abs(difference) > 0.01) {
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
      const sign = difference > 0 ? "+" : "";
      await supabase
        .from("liabilities")
        .update({
          principal: existingLiab.principal + difference,
          outstanding: existingLiab.outstanding + difference,
          notes: existingLiab.notes + `\n${sign}${difference.toFixed(2)} on ${date} (Auto-adjusted from memo edit).`,
        })
        .eq("id", existingLiab.id);
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/inventory/purchase/history");
  revalidateTag("accounting", { expire: 0 });

  return { success: true };
}

export async function deletePurchaseMemo(date: string, supplierName: string, existingTxnIds: string[]) {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const lockError = await checkFinancialLock(supabase, businessId, date);
  if (lockError) return { error: lockError };

  if (!existingTxnIds || existingTxnIds.length === 0) return { error: "No transactions to delete." };

  // Delete transactions
  const { error: delErr } = await supabase
    .from("inventory_transactions")
    .delete()
    .in("id", existingTxnIds);

  if (delErr) {
    if (delErr.message?.includes("negative")) {
      return { error: "Cannot delete this memo because some items have already been consumed (stock would go negative)." };
    }
    return { error: "Failed to delete memo." };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/purchase/history");
  revalidateTag("accounting", { expire: 0 });

  return { success: true };
}
