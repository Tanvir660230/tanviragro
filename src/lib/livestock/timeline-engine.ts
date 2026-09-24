import type { UnifiedTimelineEvent, TimelineEventCategory } from "./types";

export interface RawAnimalTimelineData {
  cattle: {
    id: string;
    tag_id: string;
    dob?: string | null;
    purchase_date?: string | null;
    purchase_price?: number | null;
    initial_weight_kg?: number | null;
    initial_weight_type?: string | null;
    created_at?: string;
    status: string;
    breed?: string | null;
    gender: string;
  };
  weightLogs?: Array<{
    id: string;
    recorded_at: string;
    weight_kg: number;
    girth_cm?: number | null;
    length_cm?: number | null;
    notes?: string | null;
    weight_type?: string | null;
  }>;
  healthEvents?: Array<{
    id: string;
    title: string;
    event_type: string;
    scheduled_at: string;
    completed_at?: string | null;
    dosage?: string | null;
    cost_bdt?: number | null;
    notes?: string | null;
  }>;
  breedingRecords?: Array<{
    id: string;
    insemination_date: string;
    insemination_type: string;
    sire_tag_or_breed: string;
    pd_check_date?: string | null;
    is_pregnant?: boolean | null;
    actual_calving_date?: string | null;
    notes?: string | null;
  }>;
  salesData?: Array<{
    id: string;
    sold_at: string;
    sale_price_total: number;
    buyer_name?: string | null;
    weight_at_sale_kg?: number | null;
  }>;
  deathRecord?: {
    id: string;
    death_date: string;
    cause_of_death: string;
    post_mortem_notes?: string | null;
    disposal_method: string;
    estimated_casualty_loss_bdt?: number | null;
  } | null;
  auditLogs?: Array<{
    id: string;
    action: string;
    actor_id: string;
    actor_role: string;
    previous_state?: Record<string, unknown> | null;
    new_state?: Record<string, unknown> | null;
    timestamp: string;
  }>;
}

export class TimelineEngine {
  /**
   * Compiles all disparate domain records into a unified chronological event stream.
   */
  public static compileUnifiedTimeline(
    data: RawAnimalTimelineData,
    filterCategory: TimelineEventCategory = "all"
  ): UnifiedTimelineEvent[] {
    const events: UnifiedTimelineEvent[] = [];
    const { cattle } = data;

    // 1. Birth Event
    if (cattle.dob) {
      events.push({
        id: `birth-${cattle.id}`,
        cattleId: cattle.id,
        category: "lifecycle",
        eventType: "BIRTH",
        title: `Calf Born (#${cattle.tag_id})`,
        description: `Born on ${cattle.dob}. Gender: ${cattle.gender === "male" ? "Bull" : "Cow"}${cattle.breed ? `, Breed: ${cattle.breed}` : ""}.`,
        timestamp: cattle.dob,
        badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
        metadata: { dob: cattle.dob, gender: cattle.gender, breed: cattle.breed },
      });
    }

    // 2. Acquisition / Purchase Event
    if (cattle.purchase_date) {
      events.push({
        id: `purchase-${cattle.id}`,
        cattleId: cattle.id,
        category: "financial",
        eventType: "PURCHASE",
        title: `Acquisition (#${cattle.tag_id})`,
        description: `Acquired for ৳${(cattle.purchase_price ?? 0).toLocaleString()} with initial weight ${cattle.initial_weight_kg ?? "?"} kg${cattle.initial_weight_type === "estimated" ? " (ESTIMATED — not weighed)" : cattle.initial_weight_type === "measured" ? " (measured)" : ""}.`,
        timestamp: cattle.purchase_date,
        badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        metadata: {
          purchasePrice: cattle.purchase_price,
          initialWeightKg: cattle.initial_weight_kg,
          initialWeightType: cattle.initial_weight_type ?? "unknown",
        },
      });
    }

    // 3. Weight Logs
    if (data.weightLogs) {
      for (const wl of data.weightLogs) {
        events.push({
          id: `weight-${wl.id}`,
          cattleId: cattle.id,
          category: "growth",
          eventType: "WEIGHT_ENTRY",
          title: `Weight Logged: ${wl.weight_kg} kg${wl.weight_type === "estimated" ? " (estimated)" : " (measured)"}`,
          description: `${wl.weight_type === "estimated" ? "Estimated (not weighed)" : "Live body weight measured"}${wl.girth_cm ? ` (Girth: ${wl.girth_cm}cm, Length: ${wl.length_cm ?? "-"}cm)` : ""}.${wl.notes ? ` Note: ${wl.notes}` : ""}`,
          timestamp: wl.recorded_at,
          badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
          metadata: { weightKg: wl.weight_kg, weightType: wl.weight_type ?? "measured", girthCm: wl.girth_cm, lengthCm: wl.length_cm },
        });
      }
    }

    // 4. Health Events & Vaccinations
    if (data.healthEvents) {
      for (const he of data.healthEvents) {
        const isVaccine = he.event_type.toLowerCase() === "vaccination";
        const isDone = !!he.completed_at;
        events.push({
          id: `health-${he.id}`,
          cattleId: cattle.id,
          category: "health",
          eventType: isVaccine ? "VACCINATION" : "TREATMENT",
          title: `${he.title} (${isDone ? "Completed" : "Scheduled"})`,
          description: `${he.event_type.toUpperCase()}${he.dosage ? ` • Dose: ${he.dosage}` : ""}${he.cost_bdt ? ` • Cost: ৳${he.cost_bdt}` : ""}.${he.notes ? ` ${he.notes}` : ""}`,
          timestamp: he.completed_at || he.scheduled_at,
          badgeColor: isDone
            ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
          metadata: {
            eventType: he.event_type,
            dosage: he.dosage,
            costBdt: he.cost_bdt,
            completedAt: he.completed_at,
            scheduledAt: he.scheduled_at,
          },
        });
      }
    }

    // 5. Breeding & Calving Records
    if (data.breedingRecords) {
      for (const br of data.breedingRecords) {
        events.push({
          id: `breeding-${br.id}`,
          cattleId: cattle.id,
          category: "breeding",
          eventType: "BREEDING",
          title: `Insemination (${br.insemination_type.toUpperCase()})`,
          description: `Inseminated with Sire: ${br.sire_tag_or_breed}.${br.is_pregnant === true ? " Confirmed Pregnant!" : br.is_pregnant === false ? " PD Result: Not Pregnant." : ""}`,
          timestamp: br.insemination_date,
          badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
          metadata: {
            sire: br.sire_tag_or_breed,
            isPregnant: br.is_pregnant,
            actualCalvingDate: br.actual_calving_date ?? null,
          },
        });

        if (br.actual_calving_date) {
          events.push({
            id: `calving-${br.id}`,
            cattleId: cattle.id,
            category: "breeding",
            eventType: "CALVING",
            title: `Successful Calving`,
            description: `Calf delivered on ${br.actual_calving_date}. Cow entering lactation period.`,
            timestamp: br.actual_calving_date,
            badgeColor: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
            metadata: { calvingDate: br.actual_calving_date },
          });
        }
      }
    }

    // 6. Sales
    if (data.salesData) {
      for (const sale of data.salesData) {
        events.push({
          id: `sale-${sale.id}`,
          cattleId: cattle.id,
          category: "financial",
          eventType: "SALE",
          title: `Animal Sold: ৳${sale.sale_price_total.toLocaleString()}`,
          description: `Sold to ${sale.buyer_name || "Buyer"}${sale.weight_at_sale_kg ? ` at ${sale.weight_at_sale_kg} kg` : ""}. Ownership transferred.`,
          timestamp: sale.sold_at,
          badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
          metadata: {
            salePrice: sale.sale_price_total,
            buyer: sale.buyer_name,
            weightAtSale: sale.weight_at_sale_kg,
          },
        });
      }
    }

    // 7. Death / Mortality
    if (data.deathRecord) {
      events.push({
        id: `death-${data.deathRecord.id}`,
        cattleId: cattle.id,
        category: "lifecycle",
        eventType: "DEATH",
        title: `Mortality: ${data.deathRecord.cause_of_death}`,
        description: `Animal deceased. Disposal method: ${data.deathRecord.disposal_method}.${data.deathRecord.post_mortem_notes ? ` Notes: ${data.deathRecord.post_mortem_notes}` : ""}`,
        timestamp: data.deathRecord.death_date,
        badgeColor: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
        metadata: {
          cause: data.deathRecord.cause_of_death,
          disposal: data.deathRecord.disposal_method,
          casualtyLoss: data.deathRecord.estimated_casualty_loss_bdt,
        },
      });
    }

    // 8. Lifecycle Transitions from Audit Logs
    if (data.auditLogs) {
      for (const audit of data.auditLogs) {
        if (audit.action === "STATUS_CHANGE") {
          const prev = (audit.previous_state as { status?: string })?.status || "?";
          const curr = (audit.new_state as { status?: string })?.status || "?";
          events.push({
            id: `audit-${audit.id}`,
            cattleId: cattle.id,
            category: "lifecycle",
            eventType: "STATUS_CHANGE",
            title: `Status Transition: ${prev} → ${curr}`,
            description: `Lifecycle state changed by ${audit.actor_role || "User"} (${audit.actor_id}).${(audit.new_state as { reason?: string })?.reason ? ` Reason: ${(audit.new_state as { reason?: string }).reason}` : ""}`,
            timestamp: audit.timestamp,
            badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
            actor: { id: audit.actor_id, role: audit.actor_role },
            metadata: {
              previousStatus: prev,
              newStatus: curr,
              reason: (audit.new_state as { reason?: string })?.reason,
            },
          });
        }
      }
    }

    // Sort chronologically (most recent first)
    const sorted = events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply category filter if not "all"
    if (filterCategory !== "all") {
      return sorted.filter((e) => e.category === filterCategory);
    }

    return sorted;

    return events;
  }
}