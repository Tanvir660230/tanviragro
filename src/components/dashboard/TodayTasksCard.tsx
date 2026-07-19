import Link from "next/link";
import { AlertTriangle, Scale, Package, Heart, ChevronRight, CheckCircle2 } from "lucide-react";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { getCachedBusinessId } from "@/lib/supabase/cached";

export async function TodayTasksCard() {
  const businessId = await getCachedBusinessId();
  if (!businessId) return null;

  const now = new Date();
  const todayISO        = now.toISOString().slice(0, 10);
  const in7DaysISO      = new Date(now.getTime() +  7 * 86400000).toISOString().slice(0, 10);
  const in30DaysISO     = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgoISO = new Date(now.getTime() -  7 * 86400000).toISOString().slice(0, 10);

  const alerts = await getCachedTopBarAlerts(businessId, todayISO, in7DaysISO, in30DaysISO, sevenDaysAgoISO);

  const overdueCount   = alerts.overdueHealth.length;
  const unweighedCount = alerts.unweighedCattleIds.length;
  const lowStockCount  = alerts.lowStockItems.length;

  const total = overdueCount + unweighedCount + lowStockCount;

  // All clear — show a minimal success strip
  if (total === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 px-5 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          সব ঠিক আছে — আজ কোনো জরুরি কাজ নেই
        </p>
      </div>
    );
  }

  const tasks = [
    overdueCount > 0 && {
      icon: Heart,
      label: `${overdueCount}টি স্বাস্থ্য ইভেন্ট overdue`,
      sublabel: "টিকা বা চিকিৎসার তারিখ পার হয়ে গেছে",
      href: "/dashboard/compliance",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      urgent: true,
    },
    unweighedCount > 0 && {
      icon: Scale,
      label: `${unweighedCount}টি গরুর ওজন ৭ দিনের বেশি নেওয়া হয়নি`,
      sublabel: "ওজন না নিলে ADG ও profit forecast ভুল হবে",
      href: "/dashboard/cattle",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      urgent: false,
    },
    lowStockCount > 0 && {
      icon: Package,
      label: `${lowStockCount}টি inventory item কম আছে`,
      sublabel: alerts.lowStockItems.slice(0, 2).map(i => i.name).join(", ") + (lowStockCount > 2 ? ` + আরও ${lowStockCount - 2}টি` : ""),
      href: "/dashboard/inventory",
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10",
      urgent: false,
    },
  ].filter(Boolean) as {
    icon: React.ElementType;
    label: string;
    sublabel: string;
    href: string;
    color: string;
    bg: string;
    urgent: boolean;
  }[];

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold">আজকের কাজ</p>
        </div>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
          {total}
        </span>
      </div>

      {/* Task list */}
      <div className="divide-y divide-border/50">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <Link
              key={task.href}
              href={task.href}
              className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.bg}`}>
                <Icon className={`h-4 w-4 ${task.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${task.urgent ? task.color : "text-foreground"}`}>
                  {task.label}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{task.sublabel}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
