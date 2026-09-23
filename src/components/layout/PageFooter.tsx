"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PageFooterProps {
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PageFooter({
  leftActions,
  rightActions,
  sticky = false,
  className,
  children,
}: PageFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 pt-6 border-t border-border/60",
        sticky &&
          "sticky bottom-0 z-30 bg-background/90 backdrop-blur-md p-4 -mx-4 sm:-mx-6 lg:-mx-8 border-t shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">{leftActions}</div>
      <div className="flex items-center gap-2.5 flex-wrap ml-auto">
        {rightActions}
        {children}
      </div>
    </div>
  );
}
