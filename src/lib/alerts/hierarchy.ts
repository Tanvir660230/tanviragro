/**
 * Tanvir Agro ERP — Alert Hierarchy & Visual Design System
 * 5-Tier enterprise alert classification standard with visual styling tokens,
 * icon mapping, priority weighting, and localization descriptors.
 */

import {
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface AlertLevelConfig {
  severity: AlertSeverity;
  rank: number; // 1 (highest) to 5 (lowest)
  labelEn: string;
  labelBn: string;
  icon: LucideIcon;
  colorClass: {
    bg: string;
    text: string;
    border: string;
    dot: string;
    badge: string;
    darkBg: string;
    darkText: string;
  };
}

export const ALERT_HIERARCHY: Record<AlertSeverity, AlertLevelConfig> = {
  critical: {
    severity: "critical",
    rank: 1,
    labelEn: "Critical",
    labelBn: "জরুরি",
    icon: AlertCircle,
    colorClass: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-300",
      dot: "bg-rose-600",
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-300 dark:border-rose-800",
      darkBg: "dark:bg-rose-950/25",
      darkText: "dark:text-rose-400",
    },
  },
  high: {
    severity: "high",
    rank: 2,
    labelEn: "High Priority",
    labelBn: "উচ্চ অগ্রাধিকার",
    icon: ShieldAlert,
    colorClass: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-300",
      dot: "bg-amber-600",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-300 dark:border-amber-800",
      darkBg: "dark:bg-amber-950/25",
      darkText: "dark:text-amber-400",
    },
  },
  medium: {
    severity: "medium",
    rank: 3,
    labelEn: "Warning",
    labelBn: "সতর্কতা",
    icon: AlertTriangle,
    colorClass: {
      bg: "bg-amber-50/60",
      text: "text-amber-600",
      border: "border-amber-200",
      dot: "bg-amber-500",
      badge: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      darkBg: "dark:bg-amber-900/20",
      darkText: "dark:text-amber-300",
    },
  },
  low: {
    severity: "low",
    rank: 4,
    labelEn: "Notice",
    labelBn: "নোটিশ",
    icon: Clock,
    colorClass: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      dot: "bg-blue-500",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      darkBg: "dark:bg-blue-950/25",
      darkText: "dark:text-blue-400",
    },
  },
  info: {
    severity: "info",
    rank: 5,
    labelEn: "Informational",
    labelBn: "তথ্য",
    icon: Info,
    colorClass: {
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
      dot: "bg-slate-500",
      badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      darkBg: "dark:bg-slate-900/40",
      darkText: "dark:text-slate-300",
    },
  },
};

/**
 * Standard comparison helper to sort notifications or alerts by strict severity rank
 */
export function compareSeverity(a: AlertSeverity, b: AlertSeverity): number {
  return ALERT_HIERARCHY[a].rank - ALERT_HIERARCHY[b].rank;
}
