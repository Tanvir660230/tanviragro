"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { CostingEngine } from "@/lib/inventory/costing-engine";
import { InventoryEventBus } from "@/lib/inventory/events";
import { FinancialEventBus } from "@/lib/financial/events";

export type PurchaseItem = {
  isNew: boolean;
  itemId?: string; 
  newItemName?: string;
  newItemCategory?: string; // "feed", "medicine", "equipment"
  newItemUnit?: string;
  /** new item counted in pieces/bundles: kg in one unit (optional) */
  newItemKgPerUnit?: number | null;
  qty: number;
  itemTotalCost: number;
  mode?: string;
  bags?: string;
  kgPerBag?: string;
};

export async function submitBulkPurchase(formData: FormData, items: PurchaseItem[]) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.INVENTORY_PURCHASE);

    const date = formData.get("date") as string;
    const supplierName = (formData.get("supplierName") as string)?.trim();
    const transportCost = parseFloat(formData.get("transportCost") as string) || 0;
    const paymentMethod = formData.get("paymentMethod") as string; // "cash", "due", "partial"
    const paidAmountStr = formData.get("paidAmount") as string;
    const paidAmount = paidAmountStr ? parseFloat(paidAmountStr) : 0;
    const notes = (formData.get("notes") as string)?.trim();
    // one key per memo form: a double tap or a retry never saves the memo twice
    const memoKey = ((formData.get("memoKey") as string) || "").trim();
    const rowKey = (idx: number) => (memoKey ? `memo:${memoKey}:${idx}` : null);

    if (!date) return { error: "Date is required" };
    if (!supplierName) return { error: "Supplier Name is required" };
    if (!items || items.length === 0) return { error: "No items added to invoice" };
    for (const it of items) {
      if (!it.qty || it.qty <= 0) return { error: "Each item must have a positive quantity" };
      if (it.itemTotalCost < 0) return { error: "Item cost cannot be negative" };
    }

    const lockError = await verifyFinancialLock(supabase, ctx.businessId, date);
    if (lockError) return { error: lockError };

    if (memoKey) {
      const { data: already } = await supabase.from("inventory_transactions").select("id").eq("idempotency_key", rowKey(0)!).maybeSingle();
      if (already) return { success: true, duplicate: true };
    }

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
        // an item with this name already exists: use it instead of making a second one
        const { data: same } = await supabase.from("inventory_items").select("id")
          .eq("business_id", ctx.businessId).is("deleted_at", null).ilike("name", it.newItemName.trim()).limit(1).maybeSingle();
        if (same) {
          finalItemId = same.id;
        } else {
          const kgPerUnit = it.newItemKgPerUnit != null && Number(it.newItemKgPerUnit) > 0 ? Number(it.newItemKgPerUnit) : null;
          const { data: insertedItem, error: itemErr } = await supabase
            .from("inventory_items")
            .insert({
              business_id: ctx.businessId,
              name: it.newItemName.trim(),
              category: it.newItemCategory as "feed" | "medicine" | "equipment" | "roughage" | "other",
              unit: it.newItemUnit.trim(),
              ...(kgPerUnit ? { kg_per_unit: kgPerUnit } : {}),
            })
            .select("id")
            .single();
          if (itemErr) return { error: `Failed to create item: ${it.newItemName}` };
          finalItemId = insertedItem.id;
        }
      }
      if (!finalItemId) return { error: "Item ID missing" };
      finalItems.push({ ...it, itemId: finalItemId });
    }

    // Distribute landed cost with CostingEngine
    const costedLines = CostingEngine.distributeLandedCost(
      finalItems.map((it) => ({
        itemId: it.itemId,
        qty: it.qty,
        itemTotalCost: it.itemTotalCost,
      })),
      transportCost
    );

    // Prepare inventory transactions
    const txnsToInsert = finalItems.map((it, idx) => {
      const costed = costedLines[idx];
      return {
        item_id: it.itemId,
        type: "purchase" as const,
        movement_type: "purchase" as const,   // a supplier invoice: the only movement that is a cash purchase
        qty: it.qty,
        unit_cost: costed.unitCost,
        recorded_at: date,
        notes: `Invoice Memo. Supplier: ${supplierName}. | Transport: ${transportCost} | Mode: ${it.mode || "loose"} | Bags: ${it.bags || ""} | KgPerBag: ${it.kgPerBag || ""}` + (notes ? ` | ${notes}` : ""),
        idempotency_key: rowKey(idx),
      };
    });

    const { error: txErr } = await supabase.from("inventory_transactions").insert(txnsToInsert);
    if (txErr?.code === "23505") return { success: true, duplicate: true };   // the same memo form was saved a moment ago
    if (txErr) return { error: "Failed to record transactions" };

    // Create or Update Liability if due
    if (dueAmount > 0) {
      const { data: existingLiab } = await supabase
        .from("liabilities")
        .select("id, principal, outstanding, notes")
        .eq("business_id", ctx.businessId)
        .eq("category", "accounts_payable")
        .is("settled_at", null)
        .ilike("lender", supplierName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLiab) {
        await supabase
          .from("liabilities")
          .update({
            principal: existingLiab.principal + dueAmount,
            outstanding: existingLiab.outstanding + dueAmount,
            notes: (existingLiab.notes || "") + `\n+ ${dueAmount} on ${date} (Bulk Purchase).`,
          })
          .eq("id", existingLiab.id);
      } else {
        await supabase.from("liabilities").insert({
          business_id: ctx.businessId,
          name: `Due to ${supplierName} (Inv)`,
          category: "accounts_payable",
          principal: dueAmount,
          outstanding: dueAmount,
          recorded_at: date,
          lender: supplierName,
          notes: `Due for bulk purchase invoice on ${date}`,
        });
      }
    }

    // Publish domain events
    await InventoryEventBus.publish(
      "StockReceived",
      ctx.businessId,
      {
        supplierName,
        totalBill,
        transportCost,
        itemCount: items.length,
        recordedAt: date,
      },
      ctx.user.id
    );

    await FinancialEventBus.publish(
      "InventoryPurchased",
      ctx.businessId,
      {
        totalBill,
        paidAmount: totalBill - dueAmount,
        dueAmount,
        recordedAt: date,
      },
      ctx.user.id
    );

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/purchase");
    revalidatePath("/dashboard/inventory/purchase/history");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record bulk purchase" };
  }
}