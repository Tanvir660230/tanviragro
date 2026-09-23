import { createClient } from "@/lib/supabase/server";
import { PenEngine, PenEntity, FarmEntity } from "@/lib/livestock/pen-engine";

export interface CreateFarmInput {
  name: string;
  code: string;
  location?: string | null;
  capacity?: number;
  notes?: string | null;
}

export interface CreatePenInput {
  farmId: string;
  name: string;
  code: string;
  type: PenEntity["type"];
  capacity: number;
  notes?: string | null;
}

export class FarmPenService {
  public static async getFarmsWithPens(businessId: string) {
    const supabase = await createClient();

    const [farmsRes, pensRes, cattleRes] = await Promise.all([
      supabase
        .from("farms")
        .select("*")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("pens")
        .select("*")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("code"),
      supabase
        .from("cattle")
        .select("id, tag_id, pen_id, farm_id, breed, status, is_quarantined")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null),
    ]);

    const farms = (farmsRes.data ?? []) as Array<{
      id: string;
      business_id: string;
      name: string;
      code: string;
      location: string | null;
      capacity: number;
      is_active: boolean;
    }>;

    const pens = (pensRes.data ?? []) as Array<{
      id: string;
      business_id: string;
      farm_id: string;
      name: string;
      code: string;
      type: PenEntity["type"];
      capacity: number;
      is_active: boolean;
      notes: string | null;
    }>;

    const cattle = (cattleRes.data ?? []) as Array<{
      id: string;
      tag_id: string;
      pen_id: string | null;
      farm_id: string | null;
      breed: string;
      status: string;
      is_quarantined: boolean;
    }>;

    const pensWithOccupancy: PenEntity[] = pens.map((p) => {
      const penCattle = cattle.filter((c) => c.pen_id === p.id);
      return {
        id: p.id,
        businessId: p.business_id,
        farmId: p.farm_id,
        name: p.name,
        code: p.code,
        type: p.type,
        capacity: p.capacity || 20,
        currentOccupancy: penCattle.length,
        notes: p.notes,
        isActive: p.is_active,
      };
    });

    const farmEntities: FarmEntity[] = farms.map((f) => ({
      id: f.id,
      businessId: f.business_id,
      name: f.name,
      code: f.code,
      location: f.location,
      capacity: f.capacity || 500,
      isActive: f.is_active,
    }));

    return {
      farms: farmEntities,
      pens: pensWithOccupancy,
      activeCattle: cattle,
    };
  }
}
