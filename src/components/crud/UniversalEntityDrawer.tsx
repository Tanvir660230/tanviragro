"use client";

import React from "react";
import { X, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UniversalEntityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  badge?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function UniversalEntityDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  badge,
  onEdit,
  onDelete,
  children,
  className,
}: UniversalEntityDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={cn(
            "w-screen max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/80 bg-muted/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground font-serif">{title}</h3>
                {badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
