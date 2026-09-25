"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { addDays } from "@/lib/dates";
import { computeFIFOUnitCost } from "@/lib/inventory-fifo";
import type { HealthEventType } from "@/types/database";

export interface VaccinationActionResult {
  success?: boolean;
  error?: string;
  /** how many animals got the dose */
  count?: number;
  /** of those, how many closed a task that was already scheduled */
  closedScheduled?: number;
}

export interface GiveVaccinePayload {
  /** one or more animals */
  cattleIds: string[];
  vaccineName: string;
  givenAt: string;
  doseMl?: number | null;
  route?: string | null;
  givenBy?: string | null;
  notes?: string | null;
  /** the scheduled task this dose completes (from the queue); otherwise a matching pending task is closed */
  scheduledEventId?: string | null;
  /** stock used: the item and the quantity per animal, in that item's own unit */
  stockItemId?: string | null;
  stockQtyPerAnimal?: number | null;
  /** add a follow-up (booster) task this many days later */
  boosterDays?: number | null;
}

function refresh() {
  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/vaccinations");
  revalidatePath("/dashboard/health/treatments");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
}

/**
 * Record a vaccine given to one or several animals.
 * For each animal it CLOSES the task that was waiting for this vaccine (the one tapped in the
 * queue, or a pending task with the same name) instead of adding a second, completed copy —
 * the old version left the scheduled task overdue and counted the dose twice.
 */
export async function giveVaccineAction(p: GiveVaccinePayload): Promise<VaccinationActionResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required" };
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const name = p.vaccineName.trim();
  const ids = [...new Set(p.cattleIds)].filter(Boolean);
  if (!name) return { error: "Vaccine name is required" };
  if (!ids.length) return { error: "Select at least one animal" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.givenAt)) return { error: "Invalid date" };

  const lockErr = await checkFinancialLock(supabase, businessId, p.givenAt);
  if (lockErr) return { error: lockErr };

  // only this farm's animals
  const { data: herd } = await supabase.from("cattle").select("id").eq("business_id", businessId).in("id", ids);
  const valid = (herd ?? []).map((c) => c.id);
  if (valid.length !== ids.length) return { error: "Animal not found" };

  const detail = [
    p.doseMl ? `Dose: ${p.doseMl}ml${p.route ? ` (${p.route})` : ""}` : null,
    p.givenBy?.trim() ? `By: ${p.givenBy.trim()}` : null,
    p.notes?.trim() || null,
  ].filter(Boolean).join(" | ") || null;

  // the tasks this closes: the tapped one, else pending tasks with the same name
  const { data: pending } = await supabase
    .from("health_events")
    .select("id, cattle_id, title, notes")
    .eq("business_id", businessId)
    .in("cattle_id", valid)
    .is("completed_at", null)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: true });
  const byAnimal = new Map<string, { id: string; notes: string | null }>();
  for (const e of pending ?? []) {
    const hit = p.scheduledEventId ? e.id === p.scheduledEventId : e.title.trim().toLowerCase() === name.toLowerCase();
    if (hit && !byAnimal.has(e.cattle_id)) byAnimal.set(e.cattle_id, { id: e.id, notes: e.notes });
  }

  let closed = 0;
  for (const cid of valid) {
    const task = byAnimal.get(cid);
    if (task) {
      const { error } = await supabase.from("health_events")
        .update({ completed_at: p.givenAt, notes: [task.notes, detail].filter(Boolean).join(" | ") || null })
        .eq("id", task.id).eq("business_id", businessId);
      if (error) return { error: "Could not update the task: " + error.message };
      closed++;
    } else {
      const { error } = await supabase.from("health_events").insert({
        business_id: businessId, cattle_id: cid, title: name, event_type: "vaccine" as HealthEventType,
        scheduled_at: p.givenAt, completed_at: p.givenAt, notes: detail,
      });
      if (error) return { error: "Could not save the vaccine: " + error.message };
    }
  }

  // stock used (in the item's own unit)
  const per = Number(p.stockQtyPerAnimal) || 0;
  if (p.stockItemId && per > 0) {
    const { data: item } = await supabase.from("inventory_items").select("id").eq("id", p.stockItemId).eq("business_id", businessId).maybeSingle();
    if (item) {
      const qty = per * valid.length;
      const unitCost = await computeFIFOUnitCost(supabase, item.id, qty);
      const { error } = await supabase.from("inventory_transactions").insert({
        item_id: item.id,
        cattle_id: valid.length === 1 ? valid[0] : null,
        type: "consumption",
        qty,
        unit_cost: unitCost ?? undefined,
        recorded_at: p.givenAt,
        notes: `Vaccine: ${name} — ${valid.length} animal(s)`,
      });
      if (error) return { error: "Vaccine saved, but the stock could not be reduced: " + error.message };
    }
  }

  const booster = Number(p.boosterDays) || 0;
  if (booster > 0) {
    const due = addDays(p.givenAt, booster);
    await supabase.from("health_events").insert(valid.map((cid) => ({
      business_id: businessId, cattle_id: cid, title: `${name} — Booster`, event_type: "vaccine" as HealthEventType,
      scheduled_at: due, notes: `Follow-up of the dose on ${p.givenAt}`,
    })));
  }

  refresh();
  return { success: true, count: valid.length, closedScheduled: closed };
}
