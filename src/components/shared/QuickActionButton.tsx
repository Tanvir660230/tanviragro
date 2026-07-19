"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Beef, Weight, Receipt, Package, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    label: "Add Cattle",
    description: "Register a new animal",
    icon: Beef,
    href: "/dashboard/cattle",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
  },
  {
    label: "Log Weight",
    description: "Record a weight entry",
    icon: Weight,
    href: "/dashboard/cattle",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/50",
  },
  {
    label: "Record Cost",
    description: "Add a finance entry",
    icon: Receipt,
    href: "/dashboard/finance",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950/50",
  },
  {
    label: "Add Inventory",
    description: "Log stock or purchase",
    icon: Package,
    href: "/dashboard/inventory",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-950/50",
  },
] as const;

export function QuickActionButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-200",
          "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]",
          "shadow-card hover:shadow-md"
        )}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Quick Add</span>
        <ChevronDown className={cn("h-3.5 w-3.5 hidden sm:block transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden animate-scale-in">
          <div className="p-1">
            {ACTIONS.map(({ label, description, icon: Icon, href, color, bg }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors"
              >
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
