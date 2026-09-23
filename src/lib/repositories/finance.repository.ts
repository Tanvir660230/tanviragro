import { BaseRepository } from "./base.repository";
import type { CostEntry, Sale, Loan, FixedAsset } from "@/types/database";

export class FinanceRepository extends BaseRepository {
  public async getCostEntries(limit = 1000): Promise<CostEntry[]> {
    const { data, error } = await this.supabase
      .from("cost_entries")
      .select("*")
      .eq("business_id", this.businessId)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (error) this.handleDbError(error, "Get cost entries");
    return (data ?? []) as CostEntry[];
  }

  public async insertCostEntry(entry: Omit<CostEntry, "id" | "business_id" | "created_at" | "deleted_at">): Promise<CostEntry> {
    const { data, error } = await this.supabase
      .from("cost_entries")
      .insert({
        ...entry,
        business_id: this.businessId,
      })
      .select("*")
      .single();

    if (error) this.handleDbError(error, "Insert cost entry");
    return data as CostEntry;
  }

  public async getSales(): Promise<Sale[]> {
    const { data, error } = await this.supabase
      .from("sales")
      .select("*, cattle!inner(business_id)")
      .eq("cattle.business_id", this.businessId)
      .is("deleted_at", null)
      .order("sold_at", { ascending: false });

    if (error) this.handleDbError(error, "Get sales records");
    return (data ?? []) as Sale[];
  }

  public async getLoans(): Promise<Loan[]> {
    const { data, error } = await this.supabase
      .from("loans")
      .select("*, loan_payments(*)")
      .eq("business_id", this.businessId)
      .is("deleted_at", null)
      .order("loan_date", { ascending: false });

    if (error) this.handleDbError(error, "Get loans");
    return (data ?? []) as Loan[];
  }

  public async getFixedAssets(): Promise<FixedAsset[]> {
    const { data, error } = await this.supabase
      .from("fixed_assets")
      .select("*")
      .eq("business_id", this.businessId)
      .order("purchase_date", { ascending: false });

    if (error) this.handleDbError(error, "Get fixed assets");
    return (data ?? []) as FixedAsset[];
  }
}
