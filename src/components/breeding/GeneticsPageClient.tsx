"use client";

import { useState } from "react";
import { Dna } from "lucide-react";
import { SectionCard } from "@/components/shared/SectionCard";
import { PedigreeTreeViewer } from "@/components/cattle/breeding/PedigreeTreeViewer";
import { RecordBreedingModal } from "@/components/cattle/breeding/RecordBreedingModal";
import type { PedigreeNode } from "@/lib/reproduction";
import { useRouter } from "next/navigation";

interface GeneticsPageClientProps {
  cattleList: any[];
  pedigreeNodes: Record<string, PedigreeNode>;
}

export function GeneticsPageClient({ cattleList, pedigreeNodes }: GeneticsPageClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(cattleList[0]?.id || "");

  const currentNode = selectedId ? pedigreeNodes[selectedId] : null;

  if (cattleList.length === 0) {
    return (
      <SectionCard title="No Animals" icon={Dna} iconVariant="blue">
        <p className="text-sm text-muted-foreground py-8 text-center">Add cattle to view pedigree trees and inbreeding analysis.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Lineage, Pedigree & Inbreeding Engine"
        description="Multi-generation ancestral tree and Wright's Inbreeding Coefficient"
        icon={Dna}
        iconVariant="blue"
        action={
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="text-xs h-8 rounded-lg border bg-background px-2.5 w-48"
          >
            {cattleList.map((c: any) => (
              <option key={c.id} value={c.id}>
                #{c.tag_number}{c.name ? ` — ${c.name}` : ""}
              </option>
            ))}
          </select>
        }
      >
        {currentNode ? (
          <PedigreeTreeViewer rootNode={currentNode} />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Select an animal above to view its pedigree tree.</p>
        )}
      </SectionCard>

      <SectionCard title="Breed Composition Summary" icon={Dna} iconVariant="primary">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(
            cattleList.reduce((acc: Record<string, number>, c: any) => {
              const key = c.breed || "Unknown";
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {})
          )
            .sort((a, b) => b[1] - a[1])
            .map(([breed, count]) => (
              <div key={breed} className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground truncate">{breed}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{count}</p>
                <p className="text-[10px] text-muted-foreground">{Math.round(count / cattleList.length * 100)}% of herd</p>
              </div>
            ))}
        </div>
      </SectionCard>
    </div>
  );
}
