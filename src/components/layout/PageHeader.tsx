"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Share2, Download, Printer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  badgeVariant?: "default" | "success" | "warning" | "destructive" | "outline";
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShare?: () => void;
  onExport?: (format: "csv" | "pdf" | "excel") => void;
  onPrint?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function EnterprisePageHeader({
  title,
  subtitle,
  badge,
  badgeVariant = "default",
  icon: Icon,
  backHref,
  backLabel,
  isFavorite,
  onToggleFavorite,
  onShare,
  onExport,
  onPrint,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const badgeStyles = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-background text-muted-foreground border-border",
  };

  const handleShare = () => {
    if (onShare) onShare();
    else if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{backLabel ?? "Back"}</span>
          </Link>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
            {title}
          </h1>
          {badge !== undefined && (
            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", badgeStyles[badgeVariant])}>
              {badge}
            </span>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Remove favorite" : "Add to favorites"}
              className={cn("p-1 rounded-lg cursor-pointer", isFavorite ? "text-amber-500" : "text-muted-foreground/50 hover:text-muted-foreground")}
            >
              <Star className={cn("h-4 w-4", isFavorite && "fill-amber-500")} />
            </button>
          )}
        </div>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-1">
          {onShare !== undefined && (
            <button type="button" onClick={handleShare} title={copied ? "Copied link!" : "Share link"} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/60 cursor-pointer">
              <Share2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onPrint && (
            <button type="button" onClick={onPrint} title="Print page" className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/60 cursor-pointer">
              <Printer className="h-3.5 w-3.5" />
            </button>
          )}
          {onExport && (
            <div className="relative">
              <button type="button" onClick={() => setExportOpen(!exportOpen)} title="Export data" className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/60 cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[120px] rounded-xl border border-border bg-popover p-1 shadow-lg text-xs">
                    {(["csv", "pdf", "excel"] as const).map((fmt) => (
                      <button key={fmt} type="button" onClick={() => { onExport(fmt); setExportOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-accent capitalize cursor-pointer">
                        Export {fmt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {actions}
        {children}
      </div>
    </div>
  );
}

export const PageHeader = EnterprisePageHeader;

