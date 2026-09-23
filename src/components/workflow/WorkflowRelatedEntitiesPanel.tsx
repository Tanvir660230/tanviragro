"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, Layers, ArrowRight } from "lucide-react";
import { RelatedEntityReference } from "@/lib/workflow-engine/types";

interface Props {
  relatedEntities: RelatedEntityReference[];
}

export function WorkflowRelatedEntitiesPanel({ relatedEntities }: Props) {
  if (!relatedEntities || relatedEntities.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> Cross-Module Linked Records
        </h4>
        <span className="text-[10px] text-muted-foreground">{relatedEntities.length} links</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {relatedEntities.map((entity, idx) => (
          <Link
            key={idx}
            href={entity.url}
            className="group flex items-center justify-between rounded-lg border border-border/70 bg-background/60 p-2.5 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs"
          >
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase font-semibold text-muted-foreground block">
                {entity.module} • {entity.entityType}
              </span>
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {entity.label}
              </span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
