"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { computeFIFOUnitCost, getItemStock as getItemStockShared } from "@/lib/inventory-fifo";

export type InventoryFormState =
  | { error?: string; success?: boolean; warning?: string }
  | undefined;



/** Current stock on hand — extracted to src/lib/inventory-fifo.ts */
async function getItemStock(supabase: ServerClient, item_id: string): Promise<number> {
  return getItemStockShared(supabase, item_id);
}

export async function createInventoryItem(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  const category = formData.get("category") as string;
  const unit = (formData.get("unit") as string)?.trim();
  const thresholdRaw = formData.get("low_stock_threshold") as string;
  const low_stock_threshold = thresholdRaw ? parseFloat(thresholdRaw) : null;

  if (!name) return { error: "Item name is required" };
  if (!category) return { error: "Category is required" };
  if (!unit) return { error: "Unit is required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Failed to set up business account" };

  const { data: newItem, error } = await supabase.from("inventory_items").insert({
    business_id: businessId,
    name,
    category: category as "feed" | "medicine" | "equipment" | "other",
    unit,
    low_stock_threshold,
  }).select("id").single();

  if (error) {
    if (error.code === "23505")
      return { error: `"${name}" already exists in inventory` };
    return { error: "Failed to save item. Please try again." };
  }

  // Handle Initial Stock
  const qtyRaw = formData.get("initial_qty") as string;
  const qty = qtyRaw ? parseFloat(qtyRaw) : 0;
  
  if (qty > 0) {
    const unitCostRaw = formData.get("unit_cost") as string;
    const unitCost = unitCostRaw ? parseFloat(unitCostRaw) : null;
    const purchaseDate = (formData.get("purchase_date") as string) || new Date().toISOString();
    const notes = (formData.get("notes") as string)?.trim() || null;

    const { error: txError } = await supabase.from("inventory_transactions").insert({
      item_id: newItem.id,
      type: "purchase",
      qty,
      unit_cost: unitCost,
      recorded_at: purchaseDate,
      notes: notes || "Initial stock added during creation",
    });
    
    if (txError) {
       return { success: true, warning: "Item created, but failed to add initial stock." };
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function addStock(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const item_id = (formData.get("item_id") as string)?.trim();
  const qty = parseFloat(formData.get("qty") as string);
  const unit_cost_raw = formData.get("unit_cost") as string;
  const unit_cost = unit_cost_raw ? parseFloat(unit_cost_raw) : null;
  const recorded_at = formData.get("recorded_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!item_id) return { error: "Invalid item" };
  if (isNaN(qty) || qty <= 0) return { error: "Enter a valid quantity" };
  if (!recorded_at) return { error: "Date is required" };

  // Ownership check
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };
  const { data: itemRow } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", item_id)
    .maybeSingle();
  if (!itemRow || itemRow.business_id !== businessId) return { error: "Unauthorized" };

  const lockError = await checkFinancialLock(supabase, businessId, recorded_at);
  if (lockError) return { error: lockError };

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id,
    type: "purchase",
    qty,
    unit_cost,
    recorded_at,
    notes,
  });

  if (error) return { error: "Failed to save transaction" };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

// computeFIFOCost extracted to src/lib/inventory-fifo.ts
const computeFIFOCost = computeFIFOUnitCost;

export async function logConsumption(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const item_id = (formData.get("item_id") as string)?.trim();
  const qty = parseFloat(formData.get("qty") as string);
  const cattle_id = (formData.get("cattle_id") as string)?.trim() || null;
  const recorded_at = formData.get("recorded_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!item_id) return { error: "Invalid item" };
  if (isNaN(qty) || qty <= 0) return { error: "Enter a valid quantity" };
  if (!recorded_at) return { error: "Date is required" };

  // Ownership check
  const businessId2 = await getCurrentBusinessId(supabase);
  if (!businessId2) return { error: "Business not found" };
  const { data: itemRow2 } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", item_id)
    .maybeSingle();
  if (!itemRow2 || itemRow2.business_id !== businessId2) return { error: "Unauthorized" };

  const lockError2 = await checkFinancialLock(supabase, businessId2, recorded_at);
  if (lockError2) return { error: lockError2 };

  // Stock check — prevent negative inventory
  const available = await getItemStock(supabase, item_id);
  if (qty > available) {
    return {
      error: `Insufficient stock. Available: ${available % 1 === 0 ? available : available.toFixed(2)}`,
    };
  }

  let fifo_unit_cost: number | null = null;
  try {
    fifo_unit_cost = await computeFIFOCost(supabase, item_id, qty);
  } catch { /* non-fatal — proceed without cost */ }

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id,
    type: "consumption" as const,
    qty,
    unit_cost: fifo_unit_cost,
    cattle_id: cattle_id || null,
    recorded_at,
    notes,
  });

  if (error) {
    // Trigger rejects concurrent over-consumption with check_violation (23514).
    if (error.code === "23514" || error.message?.includes("Insufficient stock")) {
      const fresh = await getItemStock(supabase, item_id);
      return {
        error: `Insufficient stock. Available: ${fresh % 1 === 0 ? fresh : fresh.toFixed(2)}`,
      };
    }
    return { error: "Failed to save consumption" };
  }

  // Supplement auto-deduction logic removed as per user request

  revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    if (cattle_id) revalidatePath(`/dashboard/cattle/${cattle_id}`);
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export interface DailyDeductionEntry {
  item_id: string;
  qty_per_head: number;
}

export async function dailyFeedDeduction(
  entries: DailyDeductionEntry[],
  cattle_count: number,
  recorded_at: string
): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!entries.length) return { error: "No items selected" };
  if (cattle_count <= 0) return { error: "No active cattle" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  // Verify all caller-supplied item IDs belong to this business
  const itemIds = entries.map((e) => e.item_id);
  const { data: ownedItems } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("business_id", businessId)
    .in("id", itemIds);
  const ownedSet = new Set((ownedItems ?? []).map((i) => i.id));
  if (itemIds.some((id) => !ownedSet.has(id))) return { error: "Unauthorized item" };

  const qtys = entries.map((e) =>
    parseFloat((e.qty_per_head * cattle_count).toFixed(3))
  );

  // Stock check for every item before inserting anything
  const stocks = await Promise.all(
    entries.map((e) => getItemStock(supabase, e.item_id))
  );
  const shortfall = entries
    .map((e, i) => ({ item_id: e.item_id, need: qtys[i], have: stocks[i] }))
    .find((x) => x.need > x.have);

  if (shortfall) {
    return {
      error: `Insufficient stock for item ${shortfall.item_id}. Need ${shortfall.need.toFixed(2)}, have ${shortfall.have.toFixed(2)}.`,
    };
  }

  const fifoCosts = await Promise.all(
    entries.map((e, i) =>
      computeFIFOCost(supabase, e.item_id, qtys[i]).catch(() => null)
    )
  );

  const rows = entries.map((e, i) => ({
    item_id: e.item_id,
    type: "consumption" as const,
    qty: qtys[i],
    unit_cost: fifoCosts[i],
    cattle_id: null,
    recorded_at,
    notes: `Daily batch deduction — ${cattle_count} head @ ${e.qty_per_head}/head`,
  }));

  const { error } = await supabase.from("inventory_transactions").insert(rows);
  if (error) return { error: "Failed to save deduction" };

  // Supplement auto-deduction logic removed as per user request

  revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { count: rows.length };
}

export async function archiveInventoryItem(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: item } = await supabase
    .from("inventory_items")
    .select("business_id, is_active_roughage")
    .eq("id", id)
    .maybeSingle();
  if (!item || item.business_id !== businessId) return { error: "Unauthorized" };

  if (item.is_active_roughage) {
    return { error: "This item is currently set as the active roughage. Please set a different roughage as active before deleting this one." };
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({ is_discontinued: true })
    .eq("id", id);
  if (error) return { error: "Failed to archive item" };

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function unarchiveInventoryItem(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: item } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!item || item.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("inventory_items")
    .update({ is_discontinued: false })
    .eq("id", id);
  if (error) return { error: "Failed to unarchive item" };

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function deleteInventoryItem(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: item } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!item || item.business_id !== businessId) return { error: "Unauthorized" };

  // Block deletion if any transactions exist — archive instead
  const { count } = await supabase
    .from("inventory_transactions")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);
  if ((count ?? 0) > 0)
    return { error: "This item has purchase/consumption history. Archive it instead to preserve the record." };

  const { error } = await supabase
    .from("inventory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Failed to delete item" };

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return {};
}
export async function updateInventoryItem(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const category = formData.get("category") as string;
  const unit = (formData.get("unit") as string)?.trim();
  const thresholdRaw = formData.get("low_stock_threshold") as string;
  const low_stock_threshold = thresholdRaw ? parseFloat(thresholdRaw) : null;

  if (!id) return { error: "Item ID missing" };
  if (!name) return { error: "Item name is required" };
  if (!category) return { error: "Category is required" };
  if (!unit) return { error: "Unit is required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  // Check ownership
  const { data: existing } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.business_id !== businessId) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({
      name,
      category: category as "feed" | "medicine" | "equipment" | "other",
      unit,
      low_stock_threshold,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return { error: `"${name}" already exists in inventory` };
    return { error: "Failed to update item. Please try again." };
  }

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}
export async function getFarmDailyFeedRequirement(
  dateStr: string,
  roughageActiveFromCached?: string | null   // pre-fetched by caller to avoid N queries in loops
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  // 1. Fetch active cattle (roughage_active_from is fetched once by the caller if needed,
  //    or here for standalone calls like the dashboard display)
  const { data: cattle, error } = await supabase
    .from("cattle")
    .select("id, initial_weight_kg, purchase_date, expected_daily_gain_kg, manual_feed_override")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (error || !cattle) return { error: "Failed to fetch cattle" };

  // Roughage activation date + type for correct DM% calculation.
  let roughageActiveFrom: string | null;
  let roughageDmPercent = 0.90; // default: straw
  if (roughageActiveFromCached !== undefined) {
    roughageActiveFrom = roughageActiveFromCached;
  } else {
    const { data: activeRoughageItem } = await supabase
      .from("inventory_items")
      .select("roughage_active_from, roughage_type")
      .eq("business_id", businessId)
      .eq("is_active_roughage", true)
      .maybeSingle();
    roughageActiveFrom = (activeRoughageItem as { roughage_active_from?: string | null } | null)?.roughage_active_from ?? null;
    const roughageType = (activeRoughageItem as { roughage_type?: string | null } | null)?.roughage_type;
    if (roughageType) {
      const { ROUGHAGE_TYPES } = await import("@/utils/feed-calculator");
      const found = ROUGHAGE_TYPES.find((r) => r.id === roughageType);
      if (found) roughageDmPercent = found.dmPercent;
    }
  }
  const roughageAppliesOnDate = !roughageActiveFrom || dateStr >= roughageActiveFrom;

  // 2. Fetch weight logs up to and including the target date (not future logs)
  // This ensures historical calculations use historically-known weights.
  const cattleIds = cattle.map(c => c.id);

  // Fetch weight logs on or before the target date.
  // Use the start of the NEXT day (exclusive upper bound) to capture any time
  // within the target date regardless of timezone offsets.
  const nextDay = new Date(dateStr + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDayStr = nextDay.toISOString();

  const { data: weightLogs } = await supabase
    .from("weight_logs")
    .select("cattle_id, weight_kg, recorded_at")
    .in("cattle_id", cattleIds)
    .lt("recorded_at", nextDayStr)   // < start of next day (UTC) = ≤ end of target day
    .order("recorded_at", { ascending: false });

  const latestWeights = new Map<string, { weight: number, date: string }>();
  if (weightLogs) {
    for (const log of weightLogs) {
      if (!latestWeights.has(log.cattle_id)) {
        latestWeights.set(log.cattle_id, { weight: log.weight_kg, date: log.recorded_at });
      }
    }
  }

  // Dynamic import to avoid module cycle issues if any, but we can just import from utils/feed-calculator
  const { calculateDailyFeedRequirement, calculateProjectedWeight, getEffectiveFeedDate } = await import("@/utils/feed-calculator");

  let totalConcentrateKg = 0;
  let totalRoughageKg = 0;

  for (const c of cattle) {
    const targetDate = new Date(dateStr);
    const purchaseDate = new Date(c.purchase_date ?? new Date().toISOString());
    purchaseDate.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    // If the cattle was purchased AFTER the target date, it shouldn't consume feed on that date
    if (targetDate < purchaseDate) {
      continue;
    }

    const latest = latestWeights.get(c.id);
    
    const feedData = {
      initialWeightKg: c.initial_weight_kg ?? 0,
      latestLoggedWeightKg: latest?.weight ?? null,
      lastWeighedAt: latest?.date ?? null,
      purchaseDate: c.purchase_date ?? new Date().toISOString(),
      expectedDailyGainKg: c.expected_daily_gain_kg ?? 0.8,
      roughageDmPercent,
    };

    // Calculate days on farm
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysOnFarm = Math.max(0, Math.floor((targetDate.getTime() - purchaseDate.getTime()) / msPerDay));

    let calcDateStr = dateStr;
    // New acclimatization rule: short project <= 3 days uses daily updates.
    // Established > 3 days use the Thursday lock.
    if (daysOnFarm > 3) {
      calcDateStr = getEffectiveFeedDate(dateStr);
    }

    const req = calculateDailyFeedRequirement(feedData, calcDateStr, dateStr);

    // Apply manual roughage override only if roughage was active on this date.
    // This prevents a roughage override set today from retroactively affecting past days.
    const override = c.manual_feed_override as { roughageKg?: number } | null;
    const finalRoughage = roughageAppliesOnDate
      ? (override?.roughageKg ?? req.roughageKg)
      : 0;

    totalConcentrateKg += req.actualConcentrateKg;
    totalRoughageKg += finalRoughage;
  }

  return {
    success: true,
    data: {
      totalConcentrateKg: parseFloat(totalConcentrateKg.toFixed(2)),
      totalRoughageKg: parseFloat(totalRoughageKg.toFixed(2)),
      cattleCount: cattle.length
    }
  };
}

export async function setActiveRoughage(id: string | null, activeUntil?: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { error: "Business not found" };

  if (id) {
    const today = new Date().toISOString().slice(0, 10);
    // Activate new roughage first — ensures there is never a window with zero active roughage.
    // roughage_active_from records when this roughage started — engine won't deduct before this date.
    const { error } = await supabase
      .from("inventory_items")
      .update({ is_active_roughage: true, roughage_active_until: activeUntil ?? null, roughage_active_from: today })
      .eq("id", id)
      .eq("business_id", bizId);
    if (error) return { error: "Failed to set active roughage" };

    // Then clear all others (briefly two items active rather than zero — much safer).
    const nowStr = new Date().toISOString();
    await supabase
      .from("inventory_items")
      .update({ is_active_roughage: false, roughage_active_until: nowStr })
      .eq("business_id", bizId)
      .neq("id", id);

    // Trigger auto-engine immediately so the user doesn't have to hard refresh
    await runAutoFeedDeductions();
  } else {
    // Explicitly clearing — no replacement, so just unset all
    const nowStr = new Date().toISOString();
    await supabase
      .from("inventory_items")
      .update({ is_active_roughage: false, roughage_active_until: nowStr })
      .eq("business_id", bizId)
      .eq("is_active_roughage", true);
  }

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function updateRoughageActiveUntil(activeUntil: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { error: "Business not found" };

  const { error } = await supabase
    .from("inventory_items")
    .update({ roughage_active_until: activeUntil })
    .eq("business_id", bizId)
    .eq("is_active_roughage", true);

  if (error) return { error: "Failed to update date" };
  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

// ── Autonomous Engine True-Up ──────────────────────────────────────
export async function markInventoryItemEmpty(
  itemId: string,
  finishDate: string
): Promise<{ error?: string; cattleCount?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { error: "Business not found" };

  const { data: item } = await supabase
    .from("inventory_items")
    .select("business_id, name, unit")
    .eq("id", itemId)
    .maybeSingle();

  if (!item || item.business_id !== bizId) return { error: "Unauthorized" };

  // Calculate current stock + FIFO unit cost of remaining
  const { data: txns } = await supabase
    .from("inventory_transactions")
    .select("type, qty, unit_cost, recorded_at")
    .eq("item_id", itemId)
    .order("recorded_at", { ascending: true });

  type TxnRow = { type: string; qty: number; unit_cost: number | null; recorded_at: string };
  const allTxns = (txns ?? []) as TxnRow[];

  let stock = 0;
  for (const t of allTxns) stock += (t.type === "purchase" ? t.qty : -t.qty);

  if (Math.abs(stock) < 0.01) return { error: "Stock is already at 0" };

  // FIFO cost of remaining stock
  const purchases = allTxns.filter((t) => t.type === "purchase");
  const totalConsumed = allTxns
    .filter((t) => t.type !== "purchase")
    .reduce((s, t) => s + t.qty, 0);

  const batches = purchases.map((p) => ({ qty: p.qty, unit_cost: p.unit_cost }));
  let toSkip = totalConsumed;
  for (const b of batches) {
    if (toSkip <= 0) break;
    const take = Math.min(toSkip, b.qty);
    b.qty -= take;
    toSkip -= take;
  }
  let totalValue = 0;
  let totalQty = 0;
  for (const b of batches) {
    if (b.qty > 0 && b.unit_cost != null) {
      totalValue += b.qty * b.unit_cost;
      totalQty += b.qty;
    }
  }
  const fifoUnitCost = totalQty > 0 ? totalValue / totalQty : null;

  // Insert true-up transaction on the specified finish date
  const adjustType = stock > 0 ? "consumption" : "purchase";
  const { error: txnErr } = await supabase.from("inventory_transactions").insert({
    item_id: itemId,
    type: adjustType,
    qty: Math.abs(stock),
    unit_cost: fifoUnitCost,
    recorded_at: finishDate,
    notes: `True-Up: Physical stock finished. ${stock.toFixed(2)} ${item.unit} adjusted.`,
  });

  if (txnErr) return { error: "Failed to create true-up adjustment" };



  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { cattleCount: 0 };
}

// ── Autonomous Auto-Feed Engine ────────────────────────────────────
export async function runAutoFeedDeductions(): Promise<{ error?: string, executedDays?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { error: "Business not found" };

  // 1. Get active recipe and active roughage
  const { data: activeRecipe } = await supabase
    .from("feed_recipes")
    .select("id, output_qty, active_from, recipe_ingredients(item_id, qty_per_batch)")
    .eq("business_id", bizId)
    .eq("is_active", true)
    .maybeSingle();

  const { data: activeRoughage } = await supabase
    .from("inventory_items")
    .select("id, roughage_active_from")
    .eq("business_id", bizId)
    .eq("is_active_roughage", true)
    .maybeSingle();

  if (!activeRecipe && !activeRoughage) {
    return { error: "No active recipe or roughage set" };
  }

  // 2. Find the last day we ran the auto-engine (scoped to this business via ingredient join)
  const { data: lastAutoTx } = await supabase
    .from("inventory_transactions")
    .select("recorded_at, inventory_items!inner(business_id)")
    .eq("inventory_items.business_id", bizId)
    .ilike("notes", "Auto-Feed Deduction%")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = new Date(today);
  if (lastAutoTx && lastAutoTx.recorded_at) {
    startDate = new Date(lastAutoTx.recorded_at);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Start from the earliest cattle purchase date
    const { data: earliestCattle } = await supabase
      .from("cattle")
      .select("purchase_date")
      .eq("business_id", bizId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("purchase_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (earliestCattle && earliestCattle.purchase_date) {
      startDate = new Date(earliestCattle.purchase_date);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - 1); // fallback to yesterday
    }
  }

  // Never process days before the recipe's explicit start date.
  // This prevents catch-up deductions for periods before this recipe was in use.
  const recipeFrom = (activeRecipe as { active_from?: string | null } | null)?.active_from;
  if (recipeFrom) {
    const recipeStartDate = new Date(recipeFrom + "T00:00:00");
    recipeStartDate.setHours(0, 0, 0, 0);
    if (startDate < recipeStartDate) {
      startDate = recipeStartDate;
    }
  }

  // Pre-fetch roughage_active_from once — passed to getFarmDailyFeedRequirement
  // to avoid one extra DB query per day in the loop.
  const roughageActiveFromCached = (activeRoughage as { roughage_active_from?: string | null } | null)?.roughage_active_from ?? null;

  // Batch-fetch all dates that already have auto-deductions in the catchup range.
  // This replaces one DB query per day in the loop with a single query — O(1) instead of O(days).
  const todayStr = today.toISOString().slice(0, 10);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const { data: existingBatch } = await supabase
    .from("inventory_transactions")
    .select("recorded_at, inventory_items!inner(business_id)")
    .eq("inventory_items.business_id", bizId)
    .gte("recorded_at", startDateStr)
    .lte("recorded_at", todayStr + "T23:59:59")
    .ilike("notes", "Auto-Feed Deduction%");
  const datesAlreadyDeducted = new Set(
    (existingBatch ?? []).map((t: { recorded_at: string }) => t.recorded_at.slice(0, 10))
  );

  let executedDays = 0;

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    if (datesAlreadyDeducted.has(dateStr)) continue;

    const reqRes = await getFarmDailyFeedRequirement(dateStr, roughageActiveFromCached);
    if (!reqRes.success || !reqRes.data) continue;

    const { totalConcentrateKg } = reqRes.data;

    const dayRows: {
      item_id: string; type: "consumption"; qty: number;
      unit_cost: number | null; recorded_at: string; notes: string;
    }[] = [];

    // Deduct Concentrate — compute FIFO unit_cost per ingredient so feed expense
    // appears correctly in the income statement.
    // IMPORTANT: Insert each day's rows before computing the next day's FIFO so that
    // FIFO costs see the correct cumulative consumed quantity (not stale batch state).
    if (activeRecipe && totalConcentrateKg > 0) {
      const scale = totalConcentrateKg / activeRecipe.output_qty;
      for (const ing of activeRecipe.recipe_ingredients) {
        const qtyToDeduct = parseFloat((ing.qty_per_batch * scale).toFixed(4));
        let unit_cost: number | null = null;
        try { unit_cost = await computeFIFOCost(supabase, ing.item_id, qtyToDeduct); } catch { /* non-fatal */ }
        dayRows.push({
          item_id: ing.item_id,
          type: "consumption",
          qty: qtyToDeduct,
          unit_cost,
          recorded_at: dateStr,
          notes: `Auto-Feed Deduction: ${dateStr}`,
        });
      }
    }

    if (dayRows.length > 0) {
      const { error } = await supabase.from("inventory_transactions").insert(dayRows);
      if (error) return { error: "Failed to log auto-deductions" };
    }

    // Roughage is strictly manually deducted as per user request.
    executedDays++;
  }

  if (executedDays > 0) {
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");
  }
  revalidateTag("accounting", { expire: 0 });

  return { executedDays };
}
