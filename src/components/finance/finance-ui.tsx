import React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { PrintButton } from "./PrintButton";

export function fmtBDT(n: number, decimals: number = 0): string {
  if (!isFinite(n) || isNaN(n)) return "৳0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  return `${sign}৳${abs.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function fmtBDTCompact(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "৳0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 10_000_000) return `${sign}৳${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}৳${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}৳${(abs / 1_000).toFixed(1)}K`;
  return `${sign}৳${Math.round(abs).toLocaleString("en-IN")}`;
}

export function FinancialStatCard({
  label,
  value,
  subtext,
  change,
  isPositive,
  icon: Icon,
  variant = "default",
  badge,
  onClick,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  change?: string;
  isPositive?: boolean;
  icon?: React.ElementType;
  variant?: "default" | "success" | "danger" | "warning" | "blue" | "purple";
  badge?: string;
  onClick?: () => void;
}) {
  const variantStyles = {
    default: {
      card: "border-border/80 bg-card hover:border-border shadow-sm",
      iconBg: "bg-muted text-muted-foreground",
      valColor: "text-foreground",
    },
    success: {
      card: "border-emerald-500/25 bg-emerald-500/[0.03] hover:border-emerald-500/40 shadow-sm",
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      valColor: "text-emerald-700 dark:text-emerald-400",
    },
    danger: {
      card: "border-rose-500/25 bg-rose-500/[0.03] hover:border-rose-500/40 shadow-sm",
      iconBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
      valColor: "text-rose-700 dark:text-rose-400",
    },
    warning: {
      card: "border-amber-500/25 bg-amber-500/[0.03] hover:border-amber-500/40 shadow-sm",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      valColor: "text-amber-700 dark:text-amber-400",
    },
    blue: {
      card: "border-blue-500/25 bg-blue-500/[0.03] hover:border-blue-500/40 shadow-sm",
      iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      valColor: "text-blue-700 dark:text-blue-400",
    },
    purple: {
      card: "border-purple-500/25 bg-purple-500/[0.03] hover:border-purple-500/40 shadow-sm",
      iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
      valColor: "text-purple-700 dark:text-purple-400",
    },
  }[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border p-4 sm:p-5 transition-all duration-200",
        onClick && "cursor-pointer active:scale-[0.99]",
        variantStyles.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
              {label}
            </p>
            {badge && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {badge}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 pt-0.5">
            <span
              className={cn(
                "text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums",
                variantStyles.valColor
              )}
            >
              {typeof value === "number" ? fmtBDT(value) : value}
            </span>
          </div>
          {(subtext || change) && (
            <div className="flex items-center gap-1.5 pt-1 text-xs">
              {change && (
                <span
                  className={cn(
                    "font-semibold",
                    isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {change}
                </span>
              )}
              {subtext && <span className="text-muted-foreground/80 font-medium truncate">{subtext}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("rounded-xl p-2.5 shrink-0", variantStyles.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function StatementReportHeader({
  title,
  subtitle,
  asOfDate,
  isAuditedBalanced = true,
  action,
}: {
  title: string;
  subtitle?: string;
  asOfDate?: string;
  isAuditedBalanced?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {isAuditedBalanced ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Audited &amp; Balanced
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5" />
              Audit Discrepancy
            </span>
          )}
        </div>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          {subtitle ?? "Official Double-Entry Financial Statement"}
          {asOfDate && ` · As of ${new Date(asOfDate).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        </p>
      </div>
      <div className="flex items-center gap-2 print:hidden">
        {action}
        <PrintButton />
      </div>
    </div>
  );
}
