"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: "narrow" | "prose" | "standard" | "wide" | "full";
  className?: string;
}

export function PageContainer({
  children,
  maxWidth = "standard",
  className,
}: PageContainerProps) {
  const widthClasses = {
    narrow: "max-w-3xl",
    prose: "max-w-4xl",
    standard: "max-w-7xl",
    wide: "max-w-[1600px]",
    full: "max-w-none",
  };

  return (
    <div
      className={cn(
        "w-full mx-auto space-y-6 transition-all duration-150 overflow-x-hidden",
        widthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}

export const ResponsivePageContainer = PageContainer;

