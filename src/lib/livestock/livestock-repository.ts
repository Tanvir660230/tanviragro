import type { SupabaseClient } from "@supabase/supabase-js";
import { GrowthEngine } from "./growth-engine";
import type { CattleDossier, GrowthMetrics, LifecycleTimelineItem, WeightRecord } from "./types";
import type { Cattle, WeightLog, HealthEvent } from "@/types/database";

export class CentralLivestockRepository {
  /**
   * Fetches full cattle dossier with computed growth metrics and weight logs.
   */
  public static async getCattleWithGrowthMetrics(
    supabase: SupabaseClient<any>,
    cattleId: string,
    businessId: string
  ): Promise<{ cattle: CattleDossier | null; metrics: GrowthMetrics | null; weightLogs: WeightRecord[] }> {
    const [{ data: cattleRaw }, { data: weightLogsRaw }] = await Promise.all([
      supabase
        .from("cattle")
        .select("*")
        .eq("id", cattleId)
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("weight_logs")
        .select("id, cattle_id, weight_kg, girth_cm, length_cm, recorded_at, notes")
        .eq("cattle_id", cattleId)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: true }),
    ]);

    if (!cattleRaw) return { cattle: null, metrics: null, weightLogs: [] };

    const cattle = cattleRaw as Cattle;
    const logs: WeightRecord[] = ((weightLogsRaw ?? []) as WeightLog[]).map((w) => ({
      id: w.id,
      cattleId: w.cattle_id,
      weightKg: Number(w.weight_kg),
      girthCm: w.girth_cm ? Number(w.girth_cm) : null,
      lengthCm: w.length_cm ? Number(w.length_cm) : null,
      recordedAt: w.recorded_at,
      notes: w.notes,
    }));

    const metrics = GrowthEngine.computeGrowthMetrics(
      Number(cattle.initial_weight_kg || 0),
      cattle.purchase_date || cattle.created_at.slice(0, 10),
      logs,
      new Date(),
      cattle.target_weight_kg ? Number(cattle.target_weight_kg) : undefined
    );

    const dossier: CattleDossier = {
      id: cattle.id,
      businessId: cattle.business_id,
      tagId: cattle.tag_id,
      breed: cattle.breed,
      gender: cattle.gender,
      dob: cattle.dob,
      status: cattle.status,
      purchaseDate: cattle.purchase_date,
      purchasePrice: Number(cattle.purchase_price || 0),
      initialWeightKg: Number(cattle.initial_weight_kg || 0),
      targetWeightKg: cattle.target_weight_kg ? Number(cattle.target_weight_kg) : null,
      expectedDailyGainKg: cattle.expected_daily_gain_kg ? Number(cattle.expected_daily_gain_kg) : null,
      isQuarantined: Boolean(cattle.is_quarantined),
      isQurbaniMarked: Boolean(cattle.is_qurbani_marked),
      notes: cattle.notes,
      vendorId: cattle.vendor_id,
      insuranceExpiry: cattle.insurance_expiry,
      currentWeightKg: metrics.currentWeightKg,
    };

    return { cattle: dossier, metrics, weightLogs: logs };
  }

  /**
   * Fetches active herd count and total estimated live biomass.
   */
  public static async getHerdBiomassSummary(
    supabase: SupabaseClient<any>,
    businessId: string
  ): Promise<{ activeCount: number; totalBiomassKg: number }> {
    const [{ data: activeCattle }, { data: latestLogs }] = await Promise.all([
      supabase
        .from("cattle")
        .select("id, initial_weight_kg")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null),
      supabase
        .from("weight_logs")
        .select("cattle_id, weight_kg, recorded_at")
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false }),
    ]);

    if (!activeCattle || activeCattle.length === 0) {
      return { activeCount: 0, totalBiomassKg: 0 };
    }

    const latestWeightMap = new Map<string, number>();
    for (const log of latestLogs ?? []) {
      if (!latestWeightMap.has(log.cattle_id)) {
        latestWeightMap.set(log.cattle_id, Number(log.weight_kg));
      }
    }

    let totalBiomass = 0;
    for (const c of activeCattle as { id: string; initial_weight_kg: number }[]) {
      const liveWeight = latestWeightMap.get(c.id) ?? Number(c.initial_weight_kg || 0);
      totalBiomass += liveWeight;
    }

    return {
      activeCount: activeCattle.length,
      totalBiomassKg: Math.round(totalBiomass * 10) / 10,
    };
  }

  /**
   * Compiles an authoritative unified lifecycle timeline for an animal.
   */
  public static async getCompleteLifecycleTimeline(
    supabase: SupabaseClient<any>,
    cattleId: string,
    businessId: string
  ): Promise<LifecycleTimelineItem[]> {
    const [
      { data: cattle },
      { data: weights },
      { data: healthEvents },
      { data: treatments },
      { data: sale },
    ] = await Promise.all([
      supabase.from("cattle").select("*").eq("id", cattleId).eq("business_id", businessId).maybeSingle(),
      supabase.from("weight_logs").select("*").eq("cattle_id", cattleId).is("deleted_at", null).order("recorded_at", { ascending: false }),
      supabase.from("health_events").select("*").eq("cattle_id", cattleId).is("deleted_at", null).order("scheduled_at", { ascending: false }),
      supabase.from("cattle_treatments").select("*").eq("cattle_id", cattleId).order("treated_at", { ascending: false }),
      supabase.from("sales").select("*").eq("cattle_id", cattleId).is("deleted_at", null).maybeSingle(),
    ]);

    const timeline: LifecycleTimelineItem[] = [];

    if (cattle) {
      // 1. Purchase / Registration
      timeline.push({
        id: `purchase-${cattle.id}`,
        type: "PURCHASE",
        date: cattle.purchase_date,
        title: `Purchased Tag #${cattle.tag_id}`,
        description: `Initial weight: ${cattle.initial_weight_kg} kg, Price: ৳${Number(cattle.purchase_price).toLocaleString()}`,
        metadata: { purchasePrice: cattle.purchase_price, initialWeight: cattle.initial_weight_kg },
      });
    }

    // 2. Weight logs
    for (const w of weights ?? []) {
      timeline.push({
        id: `weight-${w.id}`,
        type: "WEIGHT_ENTRY",
        date: w.recorded_at,
        title: `Weight Log: ${w.weight_kg} kg`,
        description: w.notes || `Recorded on ${w.recorded_at}`,
        metadata: { weightKg: w.weight_kg, girthCm: w.girth_cm, lengthCm: w.length_cm },
      });
    }

    // 3. Health events
    for (const h of healthEvents ?? []) {
      timeline.push({
        id: `health-${h.id}`,
        type: "VACCINATION",
        date: h.completed_at || h.scheduled_at,
        title: `${h.event_type.toUpperCase()}: ${h.title}`,
        description: h.completed_at ? `Completed on ${h.completed_at}` : `Scheduled for ${h.scheduled_at}`,
        metadata: { eventType: h.event_type, completed: Boolean(h.completed_at) },
      });
    }

    // 4. Medical treatments
    for (const t of treatments ?? []) {
      timeline.push({
        id: `treatment-${t.id}`,
        type: "TREATMENT",
        date: t.treated_at,
        title: `Medical Treatment: ${t.diagnosis || "General treatment"}`,
        description: `Doctor: ${t.doctor_name || "N/A"}, Fee: ৳${t.vet_fee || 0}`,
        metadata: { vetFee: t.vet_fee, medCost: t.additional_medical_cost },
      });
    }

    // 5. Sale event
    if (sale) {
      timeline.push({
        id: `sale-${sale.id}`,
        type: "SALE",
        date: sale.sold_at,
        title: `Sold Cattle #${cattle?.tag_id || cattleId}`,
        description: `Sale Price: ৳${Number(sale.sale_price_total).toLocaleString()}`,
        metadata: { salePrice: sale.sale_price_total, buyerName: sale.buyer_name },
      });
    }

    // Sort timeline descending by date
    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}