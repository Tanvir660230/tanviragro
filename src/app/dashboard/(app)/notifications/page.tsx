import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { PageHeader } from "@/components/shared/PageHeader";
import { Bell } from "lucide-react";
import { NotificationCenterClient } from "@/components/notifications/NotificationCenterClient";
import { NotificationItem } from "@/lib/notifications/types";
import { getCachedBusinessId } from "@/lib/supabase/cached";

export const metadata: Metadata = { title: "Notifications & Automation" };

function fmtDate(iso: string) {
  return new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-BD", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", (await getCachedBusinessId()) ?? "")
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

  const notificationItems: NotificationItem[] = [];

  // Overdue health events → Critical priority
  for (const h of alerts.overdueHealth) {
    const tag = tagMap[h.cattle_id] ?? h.cattle_id.slice(0, 6);
    notificationItems.push({
      id: `health-${h.id}`,
      title: `#${tag} — ${h.title}`,
      subtitle: `মেয়াদ: ${fmtDate(h.scheduled_at)} (Overdue vaccination/treatment)`,
      category: "cattle",
      severity: "critical",
      iconKey: "heart",
      timestamp: h.scheduled_at,
      href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "Health Hub",
    });
  }

  // Out-of-stock items → Critical priority
  for (const item of alerts.lowStockItems.filter((i) => i.stock <= 0)) {
    notificationItems.push({
      id: `outstock-${item.id}`,
      title: `${item.name} — স্টক শেষ (Out of Stock)`,
      subtitle: `Current balance is 0.0 ${item.unit}. Immediate re-order required.`,
      category: "inventory",
      severity: "critical",
      iconKey: "package",
      timestamp: now.toISOString(),
      href: "/dashboard/inventory",
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "Restock",
    });
  }

  // Unweighed cattle (7+ days) → High priority
  for (const id of alerts.unweighedCattleIds) {
    const tag = tagMap[id] ?? id.slice(0, 6);
    notificationItems.push({
      id: `unweighed-${id}`,
      title: `#${tag} — ৭+ দিন ওজন নেওয়া হয়নি`,
      subtitle: "Weekly weight record missing. Log current weight to monitor ADG growth.",
      category: "cattle",
      severity: "high",
      iconKey: "scale",
      timestamp: sevenDaysAgoISO,
      href: `/dashboard/cattle/${id}`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "Log Weight",
    });
  }

  // Low stock (above 0 but below threshold) → Medium priority
  for (const item of alerts.lowStockItems.filter((i) => i.stock > 0)) {
    notificationItems.push({
      id: `lowstock-${item.id}`,
      title: `${item.name} কম আছে (Low Stock)`,
      subtitle: `Current stock: ${item.stock.toFixed(1)} ${item.unit} (Threshold: ${item.low_stock_threshold} ${item.unit}).`,
      category: "inventory",
      severity: "medium",
      iconKey: "package",
      timestamp: now.toISOString(),
      href: "/dashboard/inventory",
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "View Stock",
    });
  }

  // Upcoming health events (next 7 days) → Medium priority
  for (const h of alerts.upcomingHealth) {
    const tag = tagMap[h.cattle_id] ?? h.cattle_id.slice(0, 6);
    notificationItems.push({
      id: `upcoming-${h.id}`,
      title: `#${tag} — ${h.title} (Upcoming)`,
      subtitle: `Scheduled for: ${fmtDate(h.scheduled_at)}. Prepare required vaccines/medicines.`,
      category: "cattle",
      severity: "medium",
      iconKey: "heart",
      timestamp: h.scheduled_at,
      href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "View Schedule",
    });
  }

  // Loans due within 30 days → High priority
  for (const loan of alerts.loansDue) {
    notificationItems.push({
      id: `loan-${loan.id}`,
      title: `${loan.lender_name} — ঋণের সময়সীমা (Loan Due)`,
      subtitle: `Due on ${fmtDate(loan.due_date)} · Principal: ৳${loan.principal_amount.toLocaleString("en-IN")}.`,
      category: "finance",
      severity: "high",
      iconKey: "landmark",
      timestamp: loan.due_date,
      href: "/dashboard/finance/loans",
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "Loan Ledger",
    });
  }

  // Insurance expiring → Low priority / Notice
  for (const ins of alerts.insuranceExpiring) {
    notificationItems.push({
      id: `ins-${ins.id}`,
      title: `#${ins.tag_id} — বীমার মেয়াদ শেষ হচ্ছে (Insurance Renewal)`,
      subtitle: `Policy expires: ${fmtDate(ins.insurance_expiry)}. Review terms and renew coverage.`,
      category: "compliance",
      severity: "low",
      iconKey: "shield",
      timestamp: ins.insurance_expiry,
      href: `/dashboard/cattle/${ins.id}`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: "View Policy",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification & Automation Hub"
        subtitle={
          notificationItems.length === 0
            ? "সব ঠিক আছে — কোনো সক্রিয় সতর্কতা নেই"
            : `${notificationItems.length}টি সক্রিয় সতর্কতা ও অটোমেশন নোটিশ আছে`
        }
        icon={Bell}
        badge={notificationItems.length || undefined}
      />

      <NotificationCenterClient initialNotifications={notificationItems} />
    </div>
  );
}
