"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { feedLedgerErrorMessage } from "@/lib/inventory/feed-batch";

export type UsageFormState = { error?: string; success?: boolean; status?: string } | undefined;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function done() {
  for (const p of ["/dashboard/inventory/usage", "/dashboard/inventory", "/dashboard/inventory/feeding-chart", "/dashboard", "/dashboard/finance", "/dashboard/cattle"]) revalidatePath(p);
  revalidateTag("accounting", { expire: 0 });
}

function dbMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23P01" || error.code === "P0001" || error.code === "23514" || error.code === "P0002") {
    return error.message ?? "Not allowed";   // our functions raise owner-readable messages
  }
  return feedLedgerErrorMessage(error);
}

type RuleChoice = { type: "weight_share" | "pct_live_weight" | "per_head" | "chart"; value: number | null };

function parseRule(formData: FormData, prefix = ""): RuleChoice | { error: string } {
  const type = (formData.get(`${prefix}rule_type`) as string) || "weight_share";
  if (type === "weight_share" || type === "chart") return { type, value: null };
  if (type !== "pct_live_weight" && type !== "per_head") return { error: "Unknown feeding rule" };
  const value = parseFloat(formData.get(`${prefix}rule_value`) as string);
  if (!(value > 0)) return { error: type === "pct_live_weight" ? "Enter the % of live weight fed per day" : "Enter the quantity per head per day" };
  return { type, value };
}

/** "Start using" a feed item or a recipe from a date (no stock is moved). */
export async function startFeedUsage(_prev: UsageFormState, formData: FormData): Promise<UsageFormState> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const target = ((formData.get("target") as string) || "").split(":");
  const startDate = (formData.get("start_date") as string) || "";
  if (target.length !== 2 || !["item", "recipe"].includes(target[0]) || !target[1]) return { error: "Choose the feed or recipe" };
  if (!DATE_RE.test(startDate)) return { error: "Choose the start date" };
  const rule = parseRule(formData);
  if ("error" in rule) return { error: rule.error };

  const { error } = await supabase.rpc("open_feed_usage_period", {
    p_business_id: businessId,
    p_target_type: target[0],
    p_target_id: target[1],
    p_start: startDate,
    p_rule_type: rule.type,
    p_rule_value: rule.value,
    p_notes: ((formData.get("notes") as string) || "").trim() || null,
    p_idempotency_key: (formData.get("key") as string) || null,
  });
  if (error) return { error: dbMessage(error) };
  done();
  return { success: true, status: "open" };
}

/**
 * End a usage period (or correct a closed one) with the remaining quantity of each item,
 * and optionally start the next feed the following day — one step for "finished / new one".
 */
export async function endFeedUsage(_prev: UsageFormState, formData: FormData): Promise<UsageFormState> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const periodId = (formData.get("period_id") as string) || "";
  const endDate = (formData.get("end_date") as string) || "";
  const reason = ((formData.get("reason") as string) || "").trim() || null;
  if (!periodId) return { error: "Period missing" };
  if (!DATE_RE.test(endDate)) return { error: "Choose the end date" };

  const checkpoint = formData.get("mode") === "checkpoint";
  const closing: { item_id: string; qty: number }[] = [];
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("closing:")) continue;
    const qty = v === "" ? NaN : parseFloat(v as string);
    if (!Number.isFinite(qty) || qty < 0) return { error: "Enter the remaining quantity for every item (0 if finished)" };
    closing.push({ item_id: k.slice(8), qty });
  }
  if (!closing.length) return { error: "Enter the remaining quantity (0 if finished)" };

  const lock = await checkFinancialLock(supabase, businessId, endDate);
  if (lock) return { error: lock };

  // count check: the period closes at the count and the same feed continues from the next day
  if (checkpoint) {
    const { error } = await supabase.rpc("checkpoint_feed_usage_period", { p_period_id: periodId, p_date: endDate, p_closing: closing });
    if (error) return { error: dbMessage(error) };
    done();
    return { success: true, status: "checkpoint" };
  }

  const { data: status, error } = await supabase.rpc("close_feed_usage_period", {
    p_period_id: periodId, p_end_date: endDate, p_closing: closing, p_reason: reason,
  });
  if (error) return { error: dbMessage(error) };

  const next = (formData.get("next_target") as string) || "";
  if (next) {
    const nextFd = new FormData();
    nextFd.set("target", next);
    nextFd.set("start_date", (formData.get("next_start_date") as string) || endDate);
    nextFd.set("rule_type", (formData.get("next_rule_type") as string) || "weight_share");
    nextFd.set("rule_value", (formData.get("next_rule_value") as string) || "");
    nextFd.set("key", `next-after:${periodId}:${next}`);
    const res = await startFeedUsage(undefined, nextFd);
    if (res?.error) return { error: `Period ended (${status}), but the next feed could not be started: ${res.error}` };
  }
  done();
  return { success: true, status: (status as string) ?? "closed" };
}

export type FinishChoice = { itemId: string; how: "fed" | "used" | "lost"; fedFrom?: string | null };

/**
 * "These are finished" for several items at once, on one date:
 *  • in use → its usage period ends with 0 left (what was eaten is feed consumption);
 *  • not in use, fed → it was fed from `fedFrom` to the date: a usage period is opened and
 *    closed with 0 left, so the eaten quantity lands on those days as feed consumption;
 *  • used (medicine and other non-feed items) → consumed on the date (its expense, e.g. medicine);
 *  • lost (spoiled, given away) → a stock count of 0 (an adjustment, not feed eaten).
 * Each item is done on its own; the result lists any that could not be.
 */
export async function finishItems(input: { date: string; items: FinishChoice[] }): Promise<{ done: number; failed: { itemId: string; error: string }[] }> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { done: 0, failed: input.items.map((i) => ({ itemId: i.itemId, error: denied })) };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  const fail = (error: string) => ({ done: 0, failed: input.items.map((i) => ({ itemId: i.itemId, error })) });
  if (!businessId) return fail("Business not found");
  if (!DATE_RE.test(input.date)) return fail("Choose the date it finished");
  const lock = await checkFinancialLock(supabase, businessId, input.date);
  if (lock) return fail(lock);

  const ids = [...new Set(input.items.map((i) => i.itemId))];
  const { data: own } = await supabase.from("inventory_items").select("id, unit, category").eq("business_id", businessId).in("id", ids);
  const mine = new Set(((own ?? []) as { id: string }[]).map((r) => r.id));
  const isFeed = new Set(((own ?? []) as { id: string; category: string }[]).filter((r) => r.category === "feed" || r.category === "roughage").map((r) => r.id));
  const { data: openRows } = await supabase.from("v_feed_usage_lines").select("period_id, item_id").eq("status", "open").in("item_id", ids);
  const periodOf = new Map(((openRows ?? []) as { period_id: string; item_id: string }[]).map((r) => [r.item_id, r.period_id]));

  const failed: { itemId: string; error: string }[] = [];
  let doneCount = 0;
  const closedPeriods = new Set<string>();

  for (const choice of input.items) {
    const id = choice.itemId;
    if (!mine.has(id)) { failed.push({ itemId: id, error: "Not an item of this farm" }); continue; }
    const periodId = periodOf.get(id);
    try {
      if (periodId) {
        if (closedPeriods.has(periodId)) { doneCount++; continue; }
        // every item of the period ends with 0 — a recipe period needs all its items selected
        const { data: lines } = await supabase.from("v_feed_usage_lines").select("item_id").eq("period_id", periodId);
        const lineIds = ((lines ?? []) as { item_id: string }[]).map((l) => l.item_id);
        if (lineIds.some((l) => !ids.includes(l))) { failed.push({ itemId: id, error: "Part of a recipe in use — select all its items, or end it from “In use”" }); continue; }
        const { error } = await supabase.rpc("close_feed_usage_period", {
          p_period_id: periodId, p_end_date: input.date, p_closing: lineIds.map((l) => ({ item_id: l, qty: 0 })), p_reason: null,
        });
        if (error) { failed.push({ itemId: id, error: dbMessage(error) }); continue; }
        closedPeriods.add(periodId);
        doneCount++;
        continue;
      }

      if (choice.how === "fed" && isFeed.has(id)) {
        const from = choice.fedFrom && DATE_RE.test(choice.fedFrom) ? choice.fedFrom : input.date;
        if (from > input.date) { failed.push({ itemId: id, error: "“Fed since” is after the finish date" }); continue; }
        const { data: newId, error: openErr } = await supabase.rpc("open_feed_usage_period", {
          p_business_id: businessId, p_target_type: "item", p_target_id: id, p_start: from,
          p_rule_type: "weight_share", p_rule_value: null, p_notes: "Finished (marked from the stock list)",
          p_idempotency_key: `finish:${id}:${from}:${input.date}`,
        });
        if (openErr) { failed.push({ itemId: id, error: dbMessage(openErr) }); continue; }
        let pid = typeof newId === "string" ? newId : null;
        if (!pid) {
          const { data: again } = await supabase.from("v_feed_usage_lines").select("period_id").eq("status", "open").eq("item_id", id).maybeSingle();
          pid = (again as { period_id?: string } | null)?.period_id ?? null;
        }
        if (!pid) { failed.push({ itemId: id, error: "Could not start the feeding period" }); continue; }
        const { error: closeErr } = await supabase.rpc("close_feed_usage_period", {
          p_period_id: pid, p_end_date: input.date, p_closing: [{ item_id: id, qty: 0 }], p_reason: null,
        });
        if (closeErr) {
          await supabase.rpc("cancel_feed_usage_period", { p_period_id: pid, p_reason: "Finish failed — undone" });
          failed.push({ itemId: id, error: dbMessage(closeErr) });
          continue;
        }
        doneCount++;
        continue;
      }

      // used up (non-feed) or lost: the rest leaves stock on the date; the database values it at WAC
      const { data: bal } = await supabase.from("v_inventory_balance").select("qty_on_hand").eq("item_id", id).maybeSingle();
      const stock = Number((bal as { qty_on_hand?: number | string } | null)?.qty_on_hand ?? 0);
      if (Math.abs(stock) < 0.0001) { doneCount++; continue; }
      const used = choice.how !== "lost" && stock > 0;   // "fed" on a non-feed item is its use
      const { error } = await supabase.from("inventory_transactions").insert({
        item_id: id, type: stock > 0 ? "consumption" : "purchase",
        movement_type: stock > 0 ? (used ? "consumption" : "wastage") : "adjustment_in",
        qty: Math.abs(stock), recorded_at: input.date,
        notes: used ? `Finished — used up (${stock.toFixed(2)})` : `Finished — lost or spoiled (${stock.toFixed(2)} written off)`,
      });
      if (error) { failed.push({ itemId: id, error: "Could not write off the stock" }); continue; }
      doneCount++;
    } catch (e) {
      failed.push({ itemId: id, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  done();
  return { done: doneCount, failed };
}

/** Cancel an open period started by mistake (kept for the audit trail). */
export async function cancelFeedUsage(periodId: string, reason: string): Promise<{ error?: string }> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_feed_usage_period", { p_period_id: periodId, p_reason: reason });
  if (error) return { error: dbMessage(error) };
  done();
  return {};
}

/** Change how a running period is fed (days already deducted stay as they are). */
export async function setFeedUsageRule(_prev: UsageFormState, formData: FormData): Promise<UsageFormState> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const periodId = (formData.get("period_id") as string) || "";
  if (!periodId) return { error: "Period missing" };
  const rule = parseRule(formData);
  if ("error" in rule) return { error: rule.error };
  const { error } = await supabase.rpc("set_feed_usage_rule", { p_period_id: periodId, p_rule_type: rule.type, p_rule_value: rule.value });
  if (error) return { error: dbMessage(error) };
  done();
  return { success: true };
}

export type ChartBandInput = { min_kg: number; max_kg: number | null; amount: number; basis: "per_head" | "pct_bw" };

/** Save a feeding chart version (same target + same date replaces that version). */
export async function saveFeedChart(input: { target: string; effectiveFrom: string; bands: ChartBandInput[]; notes?: string | null }): Promise<{ error?: string }> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };
  const [type, id] = (input.target || "").split(":");
  if (!["item", "recipe"].includes(type) || !id) return { error: "Choose the feed or recipe" };
  if (!DATE_RE.test(input.effectiveFrom)) return { error: "Choose the date the chart starts" };
  const bands = (input.bands ?? []).map((b) => ({ min_kg: Number(b.min_kg), max_kg: b.max_kg == null ? null : Number(b.max_kg), amount: Number(b.amount), basis: b.basis }));
  if (bands.some((b) => !Number.isFinite(b.min_kg) || !Number.isFinite(b.amount) || (b.max_kg != null && !Number.isFinite(b.max_kg)))) return { error: "Enter numbers in every row" };
  const { error } = await supabase.rpc("save_feed_chart", {
    p_business_id: businessId, p_target_type: type, p_target_id: id, p_effective_from: input.effectiveFrom,
    p_bands: bands, p_notes: (input.notes ?? "").trim() || null,
  });
  if (error) return { error: dbMessage(error) };
  done();
  return {};
}

/** Remove one chart version (the earlier version applies again). */
export async function deleteFeedChart(chartId: string): Promise<{ error?: string }> {
  const denied = await actionPermissionError(PERMISSIONS.INVENTORY_EDIT);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_feed_chart", { p_chart_id: chartId });
  if (error) return { error: dbMessage(error) };
  done();
  return {};
}
