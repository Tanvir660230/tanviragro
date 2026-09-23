"use client";

import Link from "next/link";
import { PlusCircle, Scale, Receipt, DollarSign, Wheat, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";
import type { DashboardRole } from "./engine/widget-types";

interface Props {
  t: Dictionary;
  role?: DashboardRole;
  compact?: boolean;
  onOpenModal?: (modal: "expense" | "sale" | "feed" | "weight") => void;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: typeof PlusCircle;
  href?: string;
  modal?: "expense" | "sale" | "feed" | "weight";
  color: string;
  bg: string;
  ring: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: "add_cattle",
    label: "Add Cattle",
    description: "Register new livestock",
    icon: PlusCircle,
    href: "/dashboard/cattle",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/50 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60",
    ring: "hover:border-emerald-200 dark:hover:border-emerald-800",
  },
  {
    id: "log_weight",
    label: "Log Weight",
    description: "Record livestock scale weight",
    icon: Scale,
    modal: "weight",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/50 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60",
    ring: "hover:border-blue-200 dark:hover:border-blue-800",
  },
  {
    id: "record_expense",
    label: "Record Expense",
    description: "Post cost entry to ledger",
    icon: Receipt,
    modal: "expense",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/60",
    ring: "hover:border-orange-200 dark:hover:border-orange-800",
  },
  {
    id: "record_sale",
    label: "Record Sale",
    description: "Log animal sale & invoice",
    icon: DollarSign,
    modal: "sale",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-950/50 group-hover:bg-green-200 dark:group-hover:bg-green-900/60",
    ring: "hover:border-green-200 dark:hover:border-green-800",
  },
  {
    id: "log_feed",
    label: "Log Feeding",
    description: "Dispense daily feed rations",
    icon: Wheat,
    modal: "feed",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/50 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/60",
    ring: "hover:border-amber-200 dark:hover:border-amber-800",
  },
  {
    id: "ai_insights",
    label: "AI Insights",
    description: "Smart farm recommendations",
    icon: Sparkles,
    href: "/dashboard/ai",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-950/50 group-hover:bg-rose-200 dark:group-hover:bg-rose-900/60",
    ring: "hover:border-rose-200 dark:hover:border-rose-800",
  },
];

export function QuickActionsBar({ t, role, compact, onOpenModal }: Props) {
  return (
    <div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6"}`}>
        {ACTIONS.map(({ id, label, description, icon: Icon, href, modal, color, bg, ring }) => {
          const content = (
            <div
              key={id}
              onClick={() => {
                if (modal && onOpenModal) {
                  onOpenModal(modal);
                }
              }}
              className={`group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card transition-all hover:shadow-card-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none cursor-pointer ${ring}`}
              title={description}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                <p className="hidden sm:block text-xs text-muted-foreground truncate">{description}</p>
              </div>
            </div>
          );

          if (href && !modal) {
            return (
              <Link key={id} href={href} className="contents">
                {content}
              </Link>
            );
          }

          return content;
        })}
      </div>
    </div>
  );
}

