import { BaseRepository } from "./base.repository";
import type { Business } from "@/types/database";

export class BusinessRepository extends BaseRepository {
  public async getDetails(): Promise<Business | null> {
    const { data, error } = await this.supabase
      .from("businesses")
      .select("*")
      .eq("id", this.businessId)
      .maybeSingle();

    if (error) this.handleDbError(error, "Get business details");
    return data as Business | null;
  }

  public async getFinancialLockDate(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("businesses")
      .select("financial_locked_until")
      .eq("id", this.businessId)
      .maybeSingle();

    if (error) this.handleDbError(error, "Get financial lock date");
    return (data as { financial_locked_until?: string | null })?.financial_locked_until ?? null;
  }

  public async updateSettings(updates: Partial<Business>): Promise<void> {
    const { error } = await this.supabase
      .from("businesses")
      .update(updates)
      .eq("id", this.businessId);

    if (error) this.handleDbError(error, "Update business settings");
  }
}
