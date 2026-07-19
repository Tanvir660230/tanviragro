import Link from "next/link";
import { PlusCircle, Scale, Receipt, Package } from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";

interface Props {
  t: Dictionary;
  compact?: boolean;
}

const ACTIONS = [
  {
    key: "qa_add_cattle" as const,
    descKey: "qa_add_cattle_desc" as const,
    icon: PlusCircle,
    href: "/dashboard/cattle",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/50 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60",
    ring: "hover:border-emerald-200 dark:hover:border-emerald-800",
  },
  {
    key: "qa_log_weight" as const,
    descKey: "qa_log_weight_desc" as const,
    icon: Scale,
    href: "/dashboard/cattle?open=bulk-weigh",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/50 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60",
    ring: "hover:border-blue-200 dark:hover:border-blue-800",
  },
  {
    key: "qa_record_cost" as const,
    descKey: "qa_record_cost_desc" as const,
    icon: Receipt,
    href: "/dashboard/finance",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-950/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/60",
    ring: "hover:border-orange-200 dark:hover:border-orange-800",
  },
  {
    key: "qa_add_stock" as const,
    descKey: "qa_add_stock_desc" as const,
    icon: Package,
    href: "/dashboard/inventory",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-950/50 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60",
    ring: "hover:border-purple-200 dark:hover:border-purple-800",
  },
] as const;

export function QuickActionsBar({ t, compact }: Props) {
  const de = t.dashboard_extra;

  return (
    <div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {ACTIONS.map(({ key, descKey, icon: Icon, href, color, bg, ring }) => (
          <Link
            key={key}
            href={href}
            className={`group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card transition-all hover:shadow-card-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${ring}`}
            title={de[descKey]}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{de[key]}</p>
              <p className="hidden sm:block text-xs text-muted-foreground truncate">{de[descKey]}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
