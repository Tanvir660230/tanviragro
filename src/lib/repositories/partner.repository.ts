import { BaseRepository } from "./base.repository";
import type { Partner, PartnerTransaction } from "@/types/database";

export class PartnerRepository extends BaseRepository {
  public async getPartners(): Promise<Partner[]> {
    const { data, error } = await this.supabase
      .from("partners")
      .select("*")
      .eq("business_id", this.businessId)
      .is("deleted_at", null)
      .order("joined_at", { ascending: true });

    if (error) this.handleDbError(error, "Get partners");
    return (data ?? []) as Partner[];
  }

  public async getPartnerTransactions(): Promise<PartnerTransaction[]> {
    const { data, error } = await this.supabase
      .from("partner_transactions")
      .select("*, partners!inner(business_id)")
      .eq("partners.business_id", this.businessId)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false });

    if (error) this.handleDbError(error, "Get partner transactions");
    return (data ?? []) as PartnerTransaction[];
  }

  public async insertPartner(partner: Omit<Partner, "id" | "business_id" | "created_at" | "deleted_at">): Promise<Partner> {
    const { data, error } = await this.supabase
      .from("partners")
      .insert({
        ...partner,
        business_id: this.businessId,
      })
      .select("*")
      .single();

    if (error) this.handleDbError(error, "Insert partner");
    return data as Partner;
  }
}
