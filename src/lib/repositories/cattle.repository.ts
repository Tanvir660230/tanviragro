import { BaseRepository } from "./base.repository";
import type { Cattle, WeightLog, HealthEvent } from "@/types/database";
import { CentralLivestockRepository } from "@/lib/livestock/livestock-repository";
import type { CattleDossier, GrowthMetrics, LifecycleTimelineItem } from "@/lib/livestock/types";

export class CattleRepository extends BaseRepository {
  public async getActiveCattle(): Promise<Cattle[]> {
    const { data, error } = await this.supabase
      .from("cattle")
      .select("*")
      .eq("business_id", this.businessId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) this.handleDbError(error, "Get active cattle");
    return (data ?? []) as Cattle[];
  }

  public async getById(id: string): Promise<Cattle | null> {
    const { data, error } = await this.supabase
      .from("cattle")
      .select("*")
      .eq("id", id)
      .eq("business_id", this.businessId)
      .maybeSingle();

    if (error) this.handleDbError(error, "Get cattle by ID");
    return data as Cattle | null;
  }

  public async getCattleDossier(id: string): Promise<{
    cattle: CattleDossier | null;
    metrics: GrowthMetrics | null;
    weightLogs: WeightLog[];
  }> {
    const result = await CentralLivestockRepository.getCattleWithGrowthMetrics(this.supabase, id, this.businessId);
    return {
      cattle: result.cattle,
      metrics: result.metrics,
      weightLogs: (result.weightLogs ?? []) as any as WeightLog[],
    };
  }

  public async getTimeline(cattleId: string): Promise<LifecycleTimelineItem[]> {
    return CentralLivestockRepository.getCompleteLifecycleTimeline(this.supabase, cattleId, this.businessId);
  }

  public async insertCattle(
    cattleData: Omit<Cattle, "id" | "business_id" | "created_at" | "updated_at" | "deleted_at">
  ): Promise<Cattle> {
    const { data, error } = await this.supabase
      .from("cattle")
      .insert({
        ...cattleData,
        business_id: this.businessId,
      })
      .select("*")
      .single();

    if (error) this.handleDbError(error, "Insert cattle");
    return data as Cattle;
  }

  public async addWeightLog(log: Omit<WeightLog, "id" | "created_at" | "deleted_at">): Promise<WeightLog> {
    const { data, error } = await this.supabase
      .from("weight_logs")
      .insert(log)
      .select("*")
      .single();

    if (error) this.handleDbError(error, "Add weight log");
    return data as WeightLog;
  }

  public async getWeightHistory(cattleId: string): Promise<WeightLog[]> {
    const { data, error } = await this.supabase
      .from("weight_logs")
      .select("*")
      .eq("cattle_id", cattleId)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false });

    if (error) this.handleDbError(error, "Get weight history");
    return (data ?? []) as WeightLog[];
  }

  public async getHerdBiomass(): Promise<{ activeCount: number; totalBiomassKg: number }> {
    return CentralLivestockRepository.getHerdBiomassSummary(this.supabase, this.businessId);
  }
}