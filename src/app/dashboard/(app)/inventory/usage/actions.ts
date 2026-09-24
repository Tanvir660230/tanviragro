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
  for (const p of ["/dashboard/inventory/usage", "/dashboard/inventory", "/dashboard", "/dashboard/finance", "/dashboard/cattle"]) revalidatePath(p);
  revalidateTag("accounting", { expire: 0 });
}

function dbMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23P01" || error.code === "P0001" || error.code === "23514" || error.code === "P0002") {
    return error.message ?? "Not allowed";   // our functions raise owner-readable messages
  }
  return feedLedgerErrorMessage(error);
}

function parseRule(formData: FormData): { type: "weight_share" | "pct_live_weight" | "per_head"; value: number | null } | { error: string } {
  const type = (formData.get("rule_type") as string) || "weight_share";
  if (type === "weight_share") return { type, value: null };
  if (type !== "pct_live_weight" && type !== "per_head") return { error: "Unknown feeding rule" };
  const value = parseFloat(formData.get("rule_value") as string);
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
