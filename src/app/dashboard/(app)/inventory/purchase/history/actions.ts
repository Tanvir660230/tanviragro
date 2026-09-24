"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";

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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_PURCHASE);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!date) return { error: "Date is required" };
  if (!supplierName) return { error: "Supplier Name is required" };
  if (!items || items.length === 0) return { error: "Cannot have an empty memo. To delete, use the delete memo function." };

  const lockError = await checkFinancialLock(supabase, businessId, date);
  if (lockError) return { error: lockError };

  // Existing rows must be active purchase rows of THIS business (never trust client ids)
  const existing = await loadActivePurchaseRows(supabase, businessId, existingTxnIds);
  if ("error" in existing) return { error: existing.error };
  const existingTxns = existing.rows;

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

  // History is never edited or deleted: a changed or removed row is UNDONE by a
  // purchase_reversal (same qty and cost, audited) and the corrected row is added as new.
  const changed = itemsToUpdate.filter((it) => {
    const ex = existingMap.get(it.id);
    const unit_cost = parseFloat((it.landedCost / it.qty).toFixed(6));
    return !ex || ex.item_id !== it.itemId || Number(ex.qty) !== it.qty || Math.abs(Number(ex.unit_cost ?? 0) - unit_cost) > 0.000001;
  });
  const toUndo = [...idsToDelete, ...changed.map((it) => it.id!)];
  const toAdd = [...itemsToInsert, ...changed];

  // 1. add the corrected rows first (so undoing an old row never leaves a temporary shortfall)
  if (toAdd.length > 0) {
    const txnsToInsert = toAdd.map(it => ({
      item_id: it.itemId,
      type: "purchase" as const,
      movement_type: "purchase" as const,
      qty: it.qty,
      unit_cost: parseFloat((it.landedCost / it.qty).toFixed(6)),
      recorded_at: date,
      notes: `Invoice Memo. Supplier: ${supplierName}. | Transport: ${transportCost} | Mode: ${it.mode || "loose"} | Bags: ${it.bags || ""} | KgPerBag: ${it.kgPerBag || ""}` + (extraNotes ? ` | ${extraNotes}` : ""),
    }));
    const { error: insErr } = await supabase.from("inventory_transactions").insert(txnsToInsert);
    if (insErr) return { error: "Failed to add the corrected items." };
  }

  // 2. undo the replaced / removed rows
  const undoErr = await undoPurchaseRows(supabase, toUndo.map((id) => existingMap.get(id)), "Memo corrected");
  if (undoErr) return { error: undoErr };

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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_PURCHASE);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const lockError = await checkFinancialLock(supabase, businessId, date);
  if (lockError) return { error: lockError };

  if (!existingTxnIds || existingTxnIds.length === 0) return { error: "No transactions to delete." };

  // The rows stay in history; each one is undone by an audited purchase_reversal.
  const existing = await loadActivePurchaseRows(supabase, businessId, existingTxnIds);
  if ("error" in existing) return { error: existing.error };
  const undoErr = await undoPurchaseRows(supabase, existing.rows, "Memo deleted");
  if (undoErr) return { error: undoErr };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/purchase/history");
  revalidateTag("accounting", { expire: 0 });

  return { success: true };
}

type PurchaseRow = { id: string; item_id: string; qty: number; unit_cost: number | null; recorded_at: string };

/** Active (not yet undone) purchase rows among `ids` that belong to the business. */
async function loadActivePurchaseRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  ids: string[]
): Promise<{ rows: PurchaseRow[] } | { error: string }> {
  if (!ids.length) return { rows: [] };
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("id, item_id, qty, unit_cost, recorded_at, movement_type, inventory_items!inner(business_id)")
    .in("id", ids)
    .eq("inventory_items.business_id", businessId);
  if (error) return { error: "Could not load the memo." };
  const rows = (data ?? []) as (PurchaseRow & { movement_type: string })[];
  if (rows.length !== new Set(ids).size || rows.some((r) => r.movement_type !== "purchase")) {
    return { error: "This memo contains rows that are not purchases of this business." };
  }
  const { data: undone } = await supabase
    .from("inventory_transactions")
    .select("reverses_id")
    .eq("movement_type", "purchase_reversal")
    .in("reverses_id", ids);
  const undoneIds = new Set((undone ?? []).map((u: { reverses_id: string | null }) => u.reverses_id));
  return { rows: rows.filter((r) => !undoneIds.has(r.id)) };
}

/** Undo purchase rows with audited purchase_reversal rows (same qty, same cost, same business date). */
async function undoPurchaseRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: (PurchaseRow | undefined)[],
  reason: string
): Promise<string | null> {
  const valid = rows.filter((r): r is PurchaseRow => !!r);
  if (!valid.length) return null;
  const { error } = await supabase.from("inventory_transactions").insert(
    valid.map((r) => ({
      item_id: r.item_id,
      type: "consumption" as const,
      movement_type: "purchase_reversal" as const,
      qty: r.qty,
      recorded_at: r.recorded_at,
      reverses_id: r.id,
      idempotency_key: `purchase-undo:${r.id}`,
      notes: `${reason}: purchase row ${r.id} undone`,
    }))
  );
  if (!error) return null;
  if (error.code === "23514") return "Some of this stock has already been used, so the purchase cannot be undone. Record a stock count adjustment instead.";
  if (error.code === "23505") return "This purchase was already corrected. Refresh the page.";
  return "Failed to correct the memo.";
}
