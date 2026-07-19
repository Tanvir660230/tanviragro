import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import {
  Bell, CheckCircle2, AlertCircle, AlertTriangle, Info,
  HeartPulse, Package, Landmark, Shield, Scale, ChevronRight,
} from "lucide-react";

export const metadata: Metadata = { title: "Notifications" };

function fmtDate(iso: string) {
  return new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-BD", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

type Severity = "critical" | "warning" | "info";

type AlertItem = {
  id: string;
  severity: Severity;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  href: string;
};

const SEV_STYLES: Record<Severity, { row: string; icon: string; dot: string }> = {
  critical: {
    row: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  warning: {
    row: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  info: {
    row: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
};

const SEV_HEADER: Record<Severity, { label: string; labelBn: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { label: "Critical", labelBn: "জরুরি", icon: AlertCircle },
  warning:  { label: "Warning",  labelBn: "সতর্কতা", icon: AlertTriangle },
  info:     { label: "Info",     labelBn: "তথ্য", icon: Info },
};

function AlertRow({ item }: { item: AlertItem }) {
  const s = SEV_STYLES[item.severity];
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 hover:opacity-80 transition-opacity",
        s.row
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", s.icon)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
    </Link>
  );
}

function Section({ severity, items }: { severity: Severity; items: AlertItem[] }) {
  if (items.length === 0) return null;
  const { label, labelBn, icon: HIcon } = SEV_HEADER[severity];
  const { dot } = SEV_STYLES[severity];
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60 bg-muted/20">
        <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
        <HIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{labelBn} <span className="text-muted-foreground font-normal">· {label}</span></h2>
        <span className="ml-auto text-xs font-medium text-muted-foreground">{items.length}টি</span>
      </div>
      <div className="p-4 space-y-2">
        {items.map((item) => <AlertRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const bizId = bizData?.id ?? "";
  const now = new Date();
  const todayISO    = now.toISOString().slice(0, 10);
  const in7DaysISO  = new Date(now.getTime() +  7 * 86_400_000).toISOString().slice(0, 10);
  const in30DaysISO = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const sevenDaysAgoISO = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  const alerts = await getCachedTopBarAlerts(bizId, todayISO, in7DaysISO, in30DaysISO, sevenDaysAgoISO);

  // Resolve cattle tag_ids
  const lookupIds = [
    ...new Set([...alerts.allCattleIds, ...alerts.unweighedCattleIds]),
  ];
  const { data: cattleRows } = lookupIds.length
    ? await supabase.from("cattle").select("id, tag_id").in("id", lookupIds)
    : { data: [] as { id: string; tag_id: string }[] };
  const tagMap: Record<string, string> = {};
  for (const c of (cattleRows ?? [])) tagMap[c.id] = c.tag_id;

  // Build alert items
  const critical: AlertItem[] = [];
  const warning:  AlertItem[] = [];
  const info:     AlertItem[] = [];

  // Overdue health events → critical
  for (const h of alerts.overdueHealth) {
    const tag = tagMap[h.cattle_id] ?? h.cattle_id.slice(0, 6);
    critical.push({
      id: `health-${h.id}`,
      severity: "critical",
      icon: HeartPulse,
      title: `#${tag} — ${h.title}`,
      subtitle: `মেয়াদ: ${fmtDate(h.scheduled_at)} (overdue)`,
      href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
    });
  }

  // Out-of-stock items → critical
  for (const item of alerts.lowStockItems.filter((i) => i.stock <= 0)) {
    critical.push({
      id: `outstock-${item.id}`,
      severity: "critical",
      icon: Package,
      title: `${item.name} — স্টক শেষ`,
      subtitle: "এখনই কিনুন",
      href: "/dashboard/inventory",
    });
  }

  // Unweighed cattle → warning
  for (const id of alerts.unweighedCattleIds) {
    const tag = tagMap[id] ?? id.slice(0, 6);
    warning.push({
      id: `unweighed-${id}`,
      severity: "warning",
      icon: Scale,
      title: `#${tag} — ৭+ দিন ওজন নেওয়া হয়নি`,
      subtitle: "ওজন লগ করুন",
      href: `/dashboard/cattle/${id}`,
    });
  }

  // Low stock (above 0 but below threshold) → warning
  for (const item of alerts.lowStockItems.filter((i) => i.stock > 0)) {
    warning.push({
      id: `lowstock-${item.id}`,
      severity: "warning",
      icon: Package,
      title: `${item.name} কম আছে`,
      subtitle: `স্টক: ${item.stock.toFixed(1)} ${item.unit} (সীমা ${item.low_stock_threshold} ${item.unit})`,
      href: "/dashboard/inventory",
    });
  }

  // Upcoming health events (next 7 days) → warning
  for (const h of alerts.upcomingHealth) {
    const tag = tagMap[h.cattle_id] ?? h.cattle_id.slice(0, 6);
    warning.push({
      id: `upcoming-${h.id}`,
      severity: "warning",
      icon: HeartPulse,
      title: `#${tag} — ${h.title}`,
      subtitle: `নির্ধারিত: ${fmtDate(h.scheduled_at)}`,
      href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
    });
  }

  // Loans due within 30 days → info
  for (const loan of alerts.loansDue) {
    info.push({
      id: `loan-${loan.id}`,
      severity: "info",
      icon: Landmark,
      title: `${loan.lender_name} — ঋণের সময়সীমা`,
      subtitle: `পরিশোধ করুন: ${fmtDate(loan.due_date)} · ৳${loan.principal_amount.toLocaleString("en-IN")}`,
      href: "/dashboard/finance/loans",
    });
  }

  // Insurance expiring → info
  for (const ins of alerts.insuranceExpiring) {
    info.push({
      id: `ins-${ins.id}`,
      severity: "info",
      icon: Shield,
      title: `#${ins.tag_id} — বীমার মেয়াদ শেষ হচ্ছে`,
      subtitle: `মেয়াদ: ${fmtDate(ins.insurance_expiry)}`,
      href: `/dashboard/cattle/${ins.id}`,
    });
  }

  const total = critical.length + warning.length + info.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notification Center"
        subtitle={
          total === 0
            ? "সব ঠিক আছে — কোনো সতর্কতা নেই"
            : `${total}টি সতর্কতা আছে`
        }
        icon={Bell}
        badge={total || undefined}
      />

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">সব ঠিক আছে!</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              কোনো overdue ইভেন্ট, কম স্টক, বা জরুরি সতর্কতা নেই।
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link
              href="/dashboard/cattle/health"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <HeartPulse className="h-4 w-4" />
              Health Hub
            </Link>
            <Link
              href="/dashboard/inventory"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Package className="h-4 w-4" />
              Inventory
            </Link>
          </div>
        </div>
      ) : (
        <>
          <Section severity="critical" items={critical} />
          <Section severity="warning"  items={warning} />
          <Section severity="info"     items={info} />
        </>
      )}
    </div>
  );
}
