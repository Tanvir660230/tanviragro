"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ActionToolbarProps {
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  className?: string;
}

export function ActionToolbar({
  leftActions,
  rightActions,
  className,
}: ActionToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-2xl bg-card border border-border/70 shadow-2xs",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-wrap flex-1">{leftActions}</div>
      <div className="flex items-center gap-2 flex-wrap shrink-0 justify-end">{rightActions}</div>
    </div>
  );
}
