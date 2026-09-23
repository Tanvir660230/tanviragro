import type { Metadata } from "next";
import { Suspense } from "react";
import { Dna } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { GeneticsPageClient } from "@/components/breeding/GeneticsPageClient";
import { PedigreeEngine } from "@/lib/reproduction";
import type { PedigreeNode } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Genetics & Pedigree | Tanvir Agro" };

export default async function GeneticsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <GeneticsSection />
      </Suspense>
    </div>
  );
}

async function GeneticsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Dna} title="No business found" />;

  const { data: cattle } = await (supabase as any)
    .from("cattle")
    .select("id,tag_number,name,gender,breed,dob,dam_id,sire_id")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("tag_number");

  const cattleList = cattle || [];

  const animalMap = new Map<string, any>();
  for (const c of cattleList) {
    animalMap.set(c.id, {
      id: c.id, tagNumber: c.tag_number, name: c.name,
      gender: c.gender, breed: c.breed, dob: c.dob,
      damId: c.dam_id, sireId: c.sire_id,
    });
  }

  const pedigreeNodes: Record<string, PedigreeNode> = {};
  for (const c of cattleList) {
    const tree = PedigreeEngine.buildPedigreeTree(c.id, animalMap, 3);
    if (tree) pedigreeNodes[c.id] = tree;
  }

  return (
    <>
      <PageHeader
        title="Genetics & Pedigree"
        subtitle="Multi-generation lineage, inbreeding analysis, and breed quality tracking"
        icon={Dna}
        back="/dashboard/breeding"
      />
      <GeneticsPageClient cattleList={cattleList} pedigreeNodes={pedigreeNodes} />
    </>
  );
}
