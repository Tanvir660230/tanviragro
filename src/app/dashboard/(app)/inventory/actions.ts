"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { getItemStock as getItemStockShared } from "@/lib/inventory-fifo";
import { AdjustmentEngine } from "@/lib/inventory/adjustment-engine";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { todayDhaka } from "@/lib/dates";
import { feedLedgerErrorMessage } from "@/lib/inventory/feed-batch";
import { scaleRecipe } from "@/lib/inventory/recipe-math";
import type { CostSource, MovementType } from "@/types/database";

export type InventoryFormState =
  | { error?: string; success?: boolean; warning?: string }
  | undefined;



/** Current stock on hand — extracted to src/lib/inventory-fifo.ts */
async function getItemStock(supabase: ServerClient, item_id: string): Promise<number> {
  return getItemStockShared(supabase, item_id);
}

/**
 * A ৳0 price is only "free" when the user says so; otherwise the database labels it
 * zero_unconfirmed so reports can show it for review (never silently treated as free).
 */
function zeroPriceSource(unitCost: number | null, formData: FormData): CostSource | undefined {
  return unitCost === 0 && formData.get("zero_confirmed") === "on" ? "zero_confirmed" : undefined;
}

type StockInMovement = "purchase" | "opening_balance" | "own_production";
const STOCK_IN_NOTE: Record<StockInMovement, string> = {
  purchase: "Purchased when item was created",
  opening_balance: "Initial stock (opening balance)",
  own_production: "Harvested from own / leased land (not a purchase)",
};
/** Which kind of stock-in the form describes; anything unexpected falls back to the default. */
function stockInMovement(formData: FormData, fallback: StockInMovement): StockInMovement {
  const v = formData.get("stock_source");
  return v === "purchase" || v === "opening_balance" || v === "own_production" ? v : fallback;
}

/** kg in one stock unit. kg items are 1 by definition; for other units NULL means unknown. */
function parseKgPerUnit(unit: string, formData: FormData): number | null | "invalid" {
  if (unit.trim().toLowerCase() === "kg") return 1;
  const raw = (formData.get("kg_per_unit") as string | null)?.trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  return n > 0 ? n : "invalid";
}

export async function createInventoryItem(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_CREATE);
  if (permissionDenied) return { error: permissionDenied };
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
  const kg_per_unit = parseKgPerUnit(unit, formData);
  if (kg_per_unit === "invalid") return { error: "kg per unit must be greater than 0 (or leave it empty if unknown)" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Failed to set up business account" };

  const { data: newItem, error } = await supabase.from("inventory_items").insert({
    business_id: businessId,
    name,
    category: category as "feed" | "medicine" | "equipment" | "other",
    unit,
    low_stock_threshold,
    kg_per_unit,
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
    // Stock already on the farm is an OPENING BALANCE (inventory, not a cash purchase).
    // Harvest from own/leased land is OWN PRODUCTION (৳0 — the land cost is an expense).
    // Only stock bought now is a purchase that reduces cash.
    const movement_type = stockInMovement(formData, "opening_balance");
    const isOwn = movement_type === "own_production";

    const { error: txError } = await supabase.from("inventory_transactions").insert({
      item_id: newItem.id,
      type: "purchase",
      movement_type,
      qty,
      unit_cost: isOwn ? null : unitCost,
      cost_source: isOwn ? undefined : zeroPriceSource(unitCost, formData),
      recorded_at: purchaseDate,
      notes: notes || STOCK_IN_NOTE[movement_type],
    });
    
    if (txError) {
       return { success: true, warning: "Item created, but failed to add initial stock." };
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

/** Stock adjustment — physical count reconciliation */
export async function adjustStock(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const item_id = (formData.get("item_id") as string)?.trim();
  const adjustedQty = parseFloat(formData.get("adjusted_qty") as string);
  const reason = (formData.get("reason") as string) || "correction";
  const recorded_at = (formData.get("recorded_at") as string) || new Date().toISOString();
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!item_id) return { error: "Item ID is required" };
  if (isNaN(adjustedQty) || adjustedQty < 0) return { error: "Valid adjusted quantity is required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };
  const { data: itemRow } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", item_id)
    .maybeSingle();
  if (!itemRow || itemRow.business_id !== businessId) return { error: "Unauthorized" };

  const currentStock = await CentralInventoryRepository.getItemStockOnHand(supabase, item_id);

  // Cost is not taken from the client: the database values the difference at WAC as of the date.
  const adjustment = AdjustmentEngine.processAdjustment(
    { itemId: item_id, adjustedQty, reason: reason as any, recordedAt: recorded_at, notes: notes || undefined },
    currentStock,
    null
  );
  if (adjustment.adjustmentQty < 0.0001) return { error: "The count matches the stock on hand. Nothing to adjust." };

  // A higher count adds stock (adjustment_in). A lower count is a loss: waste-type reasons
  // are wastage, everything else adjustment_out. Neither is a purchase or cash.
  const movement_type: MovementType =
    adjustment.direction === "IN"
      ? "adjustment_in"
      : ["spoilage", "damage", "waste"].includes(reason) ? "wastage" : "adjustment_out";

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id,
    type: adjustment.transactionType,
    movement_type,
    qty: adjustment.adjustmentQty,
    recorded_at,
    notes: adjustment.notes,
  });

  if (error) return { error: "Failed to record stock adjustment" };

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function addStock(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_PURCHASE);
  if (permissionDenied) return { error: permissionDenied };
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

  const movement_type = stockInMovement(formData, "purchase");
  const isOwn = movement_type === "own_production";
  const { error } = await supabase.from("inventory_transactions").insert({
    item_id,
    type: "purchase",
    movement_type,
    qty,
    unit_cost: isOwn ? null : unit_cost,
    cost_source: isOwn ? undefined : zeroPriceSource(unit_cost, formData),
    recorded_at,
    notes: notes || (isOwn ? STOCK_IN_NOTE.own_production : null),
  });

  if (error) return { error: "Failed to save transaction" };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function logConsumption(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_CONSUME);
  if (permissionDenied) return { error: permissionDenied };
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

  // unit_cost is set by the database (weighted-average cost as of recorded_at)
  const { error } = await supabase.from("inventory_transactions").insert({
    item_id,
    type: "consumption" as const,
    movement_type: "consumption",
    qty,
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

export interface DailyFeedingLine {
  item_id: string;
  /** total quantity ACTUALLY fed on the date, in the item's own stock unit */
  qty: number;
}

/**
 * Records what the herd was actually fed on one date. The user confirms every quantity;
 * nothing is generated from the ration formula. The database writes one consumption row
 * per item (valued at weighted-average cost) and rejects a second recording for the same
 * business, date and item, so a double submit can never deduct twice.
 */
export async function recordDailyFeeding(
  lines: DailyFeedingLine[],
  recorded_at: string
): Promise<{ error?: string; count?: number }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_CONSUME);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!/^d{4}-d{2}-d{2}$/.test(recorded_at)) return { error: "Invalid date" };
  if (recorded_at > todayDhaka()) return { error: "Feeding cannot be recorded for a future date" };

  // one line per item (two lines for the same item would violate the one-row-per-day rule)
  const byItem = new Map<string, number>();
  for (const l of lines) {
    if (!l.item_id || !Number.isFinite(l.qty) || l.qty <= 0) continue;
    byItem.set(l.item_id, (byItem.get(l.item_id) ?? 0) + l.qty);
  }
  if (!byItem.size) return { error: "Enter at least one quantity" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const lockError = await checkFinancialLock(supabase, businessId, recorded_at);
  if (lockError) return { error: lockError };

  const { data, error } = await supabase.rpc("record_herd_feeding", {
    p_business_id: businessId,
    p_date: recorded_at,
    p_lines: [...byItem].map(([item_id, qty]) => ({ item_id, qty: parseFloat(qty.toFixed(4)) })),
    p_note: null,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: `Feeding for ${recorded_at} is already recorded for one of these items. Nothing was deducted twice.` };
    }
    return { error: feedLedgerErrorMessage(error) };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { count: data ?? 0 };
}

export async function archiveInventoryItem(
  id: string
): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_DELETE);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
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
  const kg_per_unit = parseKgPerUnit(unit, formData);
  if (kg_per_unit === "invalid") return { error: "kg per unit must be greater than 0 (or leave it empty if unknown)" };

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
      kg_per_unit,
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
/** A suggested quantity for the feeding form. It is a PLAN: only recordDailyFeeding writes stock. */
export type PlannedFeedLine = { item_id: string; qty: number | null; unit: string; note?: string };

export async function getFarmDailyFeedRequirement(dateStr: string) {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_VIEW);
  if (permissionDenied) return { error: permissionDenied };
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

  // Active roughage item (its unit and kg-per-unit decide how the kg plan is shown) and the
  // business's roughage type (dry-matter %). inventory_items has no roughage_type column.
  const [{ data: activeRoughageItem }, { data: bizRow }, { data: activeRecipe }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, unit, kg_per_unit, roughage_active_from")
      .eq("business_id", businessId)
      .eq("is_active_roughage", true)
      .maybeSingle(),
    supabase.from("businesses").select("default_roughage_type").eq("id", businessId).maybeSingle(),
    supabase
      .from("feed_recipes")
      .select("id, name, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  const roughageActiveFrom = activeRoughageItem?.roughage_active_from ?? null;
  let roughageDmPercent = 0.90; // default: straw
  const roughageType = (bizRow as { default_roughage_type?: string | null } | null)?.default_roughage_type;
  if (roughageType) {
    const { ROUGHAGE_TYPES } = await import("@/utils/feed-calculator");
    const found = ROUGHAGE_TYPES.find((r) => r.id === roughageType);
    if (found) roughageDmPercent = found.dmPercent;
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
    .is("deleted_at", null)
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

  // Suggested lines (PLAN). Concentrate is split by the active recipe's proportions
  // (qty_i / Σ ingredients). Roughage is converted to the item's own unit only when its
  // kg-per-unit is known — otherwise the quantity is left for the user to enter.
  const plan: PlannedFeedLine[] = [];
  const ingredients = (activeRecipe?.recipe_ingredients ?? []) as { item_id: string; qty_per_batch: number }[];
  if (totalConcentrateKg > 0 && ingredients.length) {
    for (const l of scaleRecipe(ingredients, totalConcentrateKg)) {
      plan.push({ item_id: l.item_id, qty: parseFloat(l.qty.toFixed(2)), unit: "kg" });
    }
  }
  if (activeRoughageItem && totalRoughageKg > 0) {
    const kgPerUnit = activeRoughageItem.kg_per_unit ?? null;
    plan.push({
      item_id: activeRoughageItem.id,
      unit: activeRoughageItem.unit,
      qty: kgPerUnit ? parseFloat((totalRoughageKg / kgPerUnit).toFixed(2)) : null,
      note: kgPerUnit
        ? undefined
        : `${totalRoughageKg.toFixed(1)} kg planned. kg per ${activeRoughageItem.unit} is not set, so enter the actual ${activeRoughageItem.unit} count.`,
    });
  }

  return {
    success: true,
    data: {
      totalConcentrateKg: parseFloat(totalConcentrateKg.toFixed(2)),
      totalRoughageKg: parseFloat(totalRoughageKg.toFixed(2)),
      cattleCount: cattle.length,
      plan,
    }
  };
}

export async function setActiveRoughage(id: string | null, activeUntil?: string | null): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { error: "Business not found" };

  if (id) {
    const today = todayDhaka();
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
    // Changing the active roughage only changes the PLAN. It never creates consumption.
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
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

// ── Physical stock finished (true-up) ─────────────────────────────
export async function markInventoryItemEmpty(
  itemId: string,
  finishDate: string
): Promise<{ error?: string; cattleCount?: number }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (permissionDenied) return { error: permissionDenied };
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

  // If this feed is in an open usage period, "finished" ends that period with 0 left:
  // the stock used is FEED CONSUMPTION (Feed Expenses), reconciled by the database.
  const { data: openLine } = await supabase
    .from("v_feed_usage_lines")
    .select("period_id, status")
    .eq("item_id", itemId)
    .eq("status", "open")
    .maybeSingle();
  if (openLine?.period_id) {
    const { data: lines } = await supabase.from("v_feed_usage_lines").select("item_id").eq("period_id", openLine.period_id);
    const closing = (lines ?? []).map((l: { item_id: string }) => ({ item_id: l.item_id, qty: 0 }));
    if (closing.length > 1) return { error: "This feed is part of a recipe usage period. End it on the Feed Usage page with the remaining quantity of each ingredient." };
    const { error: closeErr } = await supabase.rpc("close_feed_usage_period", { p_period_id: openLine.period_id, p_end_date: finishDate.slice(0, 10), p_closing: closing });
    if (closeErr) return { error: closeErr.message ?? "Could not end the usage period" };
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/usage");
    revalidateTag("accounting", { expire: 0 });
    return { cattleCount: 0 };
  }

  // No usage period: a physical count of zero is a stock-count adjustment.
  const stock = await getItemStock(supabase, itemId);
  if (Math.abs(stock) < 0.01) return { error: "Stock is already at 0" };

  // A physical count of zero. The difference is a stock adjustment (not consumption by
  // cattle, not a purchase); the database values it at WAC as of the finish date.
  const { error: txnErr } = await supabase.from("inventory_transactions").insert({
    item_id: itemId,
    type: stock > 0 ? "consumption" : "purchase",
    movement_type: stock > 0 ? "adjustment_out" : "adjustment_in",
    qty: Math.abs(stock),
    recorded_at: finishDate,
    notes: `True-Up: Physical stock finished. ${stock.toFixed(2)} ${item.unit} adjusted.`,
  });

  if (txnErr) return { error: "Failed to create true-up adjustment" };



  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { cattleCount: 0 };
}

// The page-load "auto-feed engine" was removed: page rendering and configuration changes
// must never create inventory or financial transactions. Feeding is recorded explicitly
// with recordDailyFeeding.
