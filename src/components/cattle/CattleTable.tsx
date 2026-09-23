"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CattleTableRow } from "./CattleTableRow";
import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";
import { useTranslation } from "@/i18n/I18nProvider";

interface CattleTableProps {
  cattle: CattleRowEnriched[];
  allTagIds: string[];
  allBreeds: string[];
  selectedIds?: Set<string>;
  onToggleSelectOne?: (id: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
}

export function CattleTable({
  cattle,
  allTagIds,
  allBreeds,
  selectedIds,
  onToggleSelectOne,
  onToggleSelectAll,
  allSelected,
}: CattleTableProps) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());

  const hasSelection = !!onToggleSelectOne;

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-card">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/20 hover:bg-transparent">
            {hasSelection && (
              <TableHead className="h-11 w-10 text-center pl-3 pr-1">
                <input
                  type="checkbox"
                  aria-label="Select all visible cattle"
                  checked={!!allSelected && cattle.length > 0}
                  onChange={() => onToggleSelectAll?.()}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer transition-colors"
                />
              </TableHead>
            )}
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70">{t.cattle_details.table.tag_id}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70">{t.cattle_details.table.breed}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-right">{t.cattle_details.table.weight_kg}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70">{t.cattle_details.table.feed_per_day}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-center">{t.cattle_details.smart.adg}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-center">{t.cattle_details.weight.fcr}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-center">{t.cattle_details.table.status}</TableHead>
            <TableHead className="h-11 w-20 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cattle.map((c) => (
            <CattleTableRow
              key={c.id}
              c={c}
              isSelected={selectedIds?.has(c.id)}
              hasSelection={hasSelection}
              now={now}
              allTagIds={allTagIds}
              allBreeds={allBreeds}
              onToggleSelectOne={onToggleSelectOne}
              t={t}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
