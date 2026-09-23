"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PageContentProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 12;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function PageContent({
  children,
  columns,
  gap = "md",
  className,
}: PageContentProps) {
  const gapClasses = {
    sm: "gap-3",
    md: "gap-5 sm:gap-6",
    lg: "gap-8",
  };

  const colClasses = {
    1: "grid grid-cols-1",
    2: "grid grid-cols-1 md:grid-cols-2",
    3: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    12: "grid grid-cols-12",
  };

  return (
    <div
      className={cn(
        columns ? colClasses[columns] : "space-y-6",
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
