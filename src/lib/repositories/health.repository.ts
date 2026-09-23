import { BaseRepository } from "./base.repository";
import type { HealthEvent } from "@/types/database";

export class HealthRepository extends BaseRepository {
  public async getVaccineEvents(): Promise<HealthEvent[]> {
    const { data, error } = await this.supabase
      .from("health_events")
      .select("*")
      .eq("business_id", this.businessId)
      .eq("event_type", "vaccine")
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true });

    if (error) this.handleDbError(error, "Get vaccine events");
    return (data ?? []) as HealthEvent[];
  }

  public async getUpcomingEvents(daysAhead = 30): Promise<HealthEvent[]> {
    const today = new Date().toISOString().slice(0, 10);
    const targetDate = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);

    const { data, error } = await this.supabase
      .from("health_events")
      .select("*")
      .eq("business_id", this.businessId)
      .is("completed_at", null)
      .is("deleted_at", null)
      .lte("scheduled_at", targetDate)
      .order("scheduled_at", { ascending: true });

    if (error) this.handleDbError(error, "Get upcoming health events");
    return (data ?? []) as HealthEvent[];
  }

  public async insertEvents(events: Omit<HealthEvent, "id" | "created_at" | "deleted_at">[]): Promise<void> {
    if (!events.length) return;
    const { error } = await this.supabase
      .from("health_events")
      .insert(events);

    if (error) this.handleDbError(error, "Insert health events batch");
  }
}
