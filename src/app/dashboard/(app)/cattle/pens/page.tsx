import { Metadata } from "next";
import { getCachedBusinessId } from "@/lib/supabase/cached";
import { redirect } from "next/navigation";
import { FarmPenService } from "@/lib/services/farm-pen.service";
import { PenManagementClient } from "./PenManagementClient";

export const metadata: Metadata = {
  title: "Multi-Farm & Pen Management | Tanvir Agro",
  description: "Manage farm facilities, shed layouts, pen occupancy rates, and cattle movements.",
};

export default async function PenManagementPage() {
  const businessId = await getCachedBusinessId();
  if (!businessId) {
    redirect("/login");
  }

  const { farms, pens, activeCattle } = await FarmPenService.getFarmsWithPens(businessId);

  return (
    <PenManagementClient
      farms={farms}
      pens={pens}
      activeCattle={activeCattle}
    />
  );
}
