"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps page content with instant, continuous workspace feel.
 * No artificial delays, timeouts, or blinking on route transitions.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <div className={cn("w-full transition-opacity duration-100 ease-out", className)}>
      {children}
    </div>
  );
}

