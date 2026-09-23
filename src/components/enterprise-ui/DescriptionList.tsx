"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface DescriptionItem {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2;
  copyable?: boolean;
}

export interface DescriptionListProps {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}

export function DescriptionList({
  items,
  columns = 2,
  className,
}: DescriptionListProps) {
  const colClasses = {
    1: "grid grid-cols-1",
    2: "grid grid-cols-1 sm:grid-cols-2",
    3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <dl className={cn("grid gap-x-4 gap-y-3 text-xs", colClasses[columns], className)}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            "flex flex-col space-y-1 p-2 rounded-lg bg-muted/20 border border-border/30",
            item.span === 2 && "sm:col-span-2"
          )}
        >
          <dt className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {item.label}
          </dt>
          <dd className="font-medium text-foreground break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
