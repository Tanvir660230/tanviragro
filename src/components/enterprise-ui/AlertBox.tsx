"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "destructive";

export interface AlertBoxProps {
  title?: string;
  message: string | React.ReactNode;
  variant?: AlertVariant;
  icon?: LucideIcon;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function AlertBox({
  title,
  message,
  variant = "info",
  icon: CustomIcon,
  dismissible = false,
  onDismiss,
  action,
  className,
}: AlertBoxProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const config: Record<
    AlertVariant,
    { icon: LucideIcon; containerClass: string; iconClass: string; titleClass: string }
  > = {
    info: {
      icon: Info,
      containerClass: "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200",
      iconClass: "text-blue-600 dark:text-blue-400",
      titleClass: "text-blue-950 dark:text-blue-100",
    },
    success: {
      icon: CheckCircle2,
      containerClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200",
      iconClass: "text-emerald-600 dark:text-emerald-400",
      titleClass: "text-emerald-950 dark:text-emerald-100",
    },
    warning: {
      icon: AlertTriangle,
      containerClass: "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200",
      iconClass: "text-amber-600 dark:text-amber-400",
      titleClass: "text-amber-950 dark:text-amber-100",
    },
    destructive: {
      icon: AlertCircle,
      containerClass: "bg-destructive/10 border-destructive/20 text-destructive-foreground",
      iconClass: "text-destructive",
      titleClass: "text-destructive font-bold",
    },
  };

  const current = config[variant];
  const Icon = CustomIcon || current.icon;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed transition-all",
        current.containerClass,
        className
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", current.iconClass)} />
      <div className="flex-1 space-y-0.5">
        {title && <div className={cn("font-semibold text-xs", current.titleClass)}>{title}</div>}
        <div className="text-xs opacity-90">{message}</div>
        {action && <div className="pt-2">{action}</div>}
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
          aria-label="Dismiss alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
