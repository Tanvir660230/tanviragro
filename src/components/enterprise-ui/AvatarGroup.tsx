"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface AvatarItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  fallbackText?: string;
}

export interface AvatarGroupProps {
  items: AvatarItem[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvatarGroup({
  items,
  max = 4,
  size = "md",
  className,
}: AvatarGroupProps) {
  const visibleItems = items.slice(0, max);
  const extraCount = Math.max(0, items.length - max);

  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  return (
    <div className={cn("flex items-center -space-x-2 overflow-hidden", className)}>
      {visibleItems.map((item) => (
        <div
          key={item.id}
          title={item.name}
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-background bg-muted text-foreground font-semibold overflow-hidden select-none",
            sizeClasses[size]
          )}
        >
          {item.avatarUrl ? (
            <Image src={item.avatarUrl} alt={item.name} fill className="object-cover" />
          ) : (
            <span>{item.fallbackText ?? item.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      ))}
      {extraCount > 0 && (
        <div
          title={`${extraCount} more`}
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-background bg-muted text-muted-foreground font-bold select-none",
            sizeClasses[size]
          )}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}
