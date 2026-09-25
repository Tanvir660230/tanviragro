import { todayDhaka, addDays } from "@/lib/dates";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { PageHeader } from "@/components/shared/PageHeader";
import { Bell } from "lucide-react";
import { NotificationCenterClient } from "@/components/notifications/NotificationCenterClient";
import { NotificationItem } from "@/lib/notifications/types";
import { getCachedBusinessId } from "@/lib/supabase/cached";
import { getL, getLocale } from "@/i18n/server-text";

export const metadata: Metadata = { title: "নোটিফিকেশন" };

function fmtDate(iso: string, locale?: string) {
  return new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString(locale === "bn" ? "bn-BD-u-nu-latn" : "en-GB", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

export default async function NotificationsPage() {
  const L = await getL();
  const lang = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", (await getCachedBusinessId()) ?? "")
    .maybeSingle();

  const bizId = bizData?.id ?? "";
  // the farm's calendar (Dhaka), not the server's UTC date
  const todayISO    = todayDhaka();
  const in7DaysISO  = addDays(todayISO, 7);
  const in30DaysISO = addDays(todayISO, 30);
  const sevenDaysAgoISO = addDays(todayISO, -7);

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
      subtitle: L(`তারিখ ছিল ${fmtDate(h.scheduled_at, lang)} — সময় পেরিয়েছে`, `Was due ${fmtDate(h.scheduled_at, lang)} — overdue`),
      category: "cattle",
      severity: "critical",
      iconKey: "heart",
      timestamp: h.scheduled_at,
      href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("টিকা ও কাজ", "Vaccines & tasks"),
    });
  }

  // Out-of-stock items → Critical priority
  for (const item of alerts.lowStockItems.filter((i) => i.stock <= 0)) {
    notificationItems.push({
      id: `outstock-${item.id}`,
      title: L(`${item.name} — স্টক শেষ`, `${item.name} — out of stock`),
      subtitle: L(`স্টকে ০ ${item.unit}। কিনতে হবে।`, `Stock is 0 ${item.unit}. Buy more.`),
      category: "inventory",
      severity: "critical",
      iconKey: "package",
      timestamp: new Date().toISOString(),
      href: "/dashboard/inventory",
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("কিনুন", "Buy"),
    });
  }

  // Unweighed cattle (7+ days) → High priority
  for (const id of alerts.unweighedCattleIds) {
    const tag = tagMap[id] ?? id.slice(0, 6);
    notificationItems.push({
      id: `unweighed-${id}`,
      title: `#${tag} — ৭+ দিন ওজন নেওয়া হয়নি`,
      subtitle: L("৭ দিনের বেশি ওজন নেওয়া হয়নি। বৃদ্ধি দেখতে ওজন লিখুন।", "No weight in over 7 days. Record one to track growth."),
      category: "cattle",
      severity: "high",
      iconKey: "scale",
      timestamp: sevenDaysAgoISO,
      href: `/dashboard/cattle/${id}`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("ওজন লিখুন", "Record weight"),
    });
  }

  // Low stock (above 0 but below threshold) → Medium priority
  for (const item of alerts.lowStockItems.filter((i) => i.stock > 0)) {
    notificationItems.push({
      id: `lowstock-${item.id}`,
      title: L(`${item.name} কম আছে`, `${item.name} is low`),
      subtitle: L(`স্টকে ${item.stock.toFixed(1)} ${item.unit} (সীমা ${item.low_stock_threshold} ${item.unit})।`, `Stock ${item.stock.toFixed(1)} ${item.unit} (alert at ${item.low_stock_threshold} ${item.unit}).`),
      category: "inventory",
      severity: "medium",
      iconKey: "package",
      timestamp: new Date().toISOString(),
      href: "/dashboard/inventory",
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("স্টক দেখুন", "View stock"),
    });
  }

  // Upcoming health events (next 7 days) → Medium priority
  for (const h of alerts.upcomingHealth) {
    const tag = tagMap[h.cattle_id] ?? h.cattle_id.slice(0, 6);
    notificationItems.push({
      id: `upcoming-${h.id}`,
      title: `#${tag} — ${h.title}`,
      subtitle: L(`তারিখ ${fmtDate(h.scheduled_at, lang)} — টিকা/ওষুধ তৈরি রাখুন।`, `Due ${fmtDate(h.scheduled_at, lang)} — have the vaccine/medicine ready.`),
      category: "cattle",
      severity: "medium",
      iconKey: "heart",
      timestamp: h.scheduled_at,
      href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("সূচি দেখুন", "View schedule"),
    });
  }

  // Loans due within 30 days → High priority
  for (const loan of alerts.loansDue) {
    notificationItems.push({
      id: `loan-${loan.id}`,
      title: L(`${loan.lender_name} — ঋণ শোধের সময়`, `${loan.lender_name} — loan due`),
      subtitle: L(`শোধের তারিখ ${fmtDate(loan.due_date, lang)} · আসল ৳${loan.principal_amount.toLocaleString("en-IN")}`, `Due ${fmtDate(loan.due_date, lang)} · principal ৳${loan.principal_amount.toLocaleString("en-IN")}`),
      category: "finance",
      severity: "high",
      iconKey: "landmark",
      timestamp: loan.due_date,
      href: "/dashboard/finance/loans",
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("ঋণ", "Loans"),
    });
  }

  // Insurance expiring → Low priority / Notice
  for (const ins of alerts.insuranceExpiring) {
    notificationItems.push({
      id: `ins-${ins.id}`,
      title: L(`#${ins.tag_id} — বীমার মেয়াদ শেষ হচ্ছে`, `#${ins.tag_id} — insurance renewal`),
      subtitle: L(`মেয়াদ শেষ ${fmtDate(ins.insurance_expiry, lang)} — নবায়ন করুন।`, `Expires ${fmtDate(ins.insurance_expiry, lang)} — renew it.`),
      category: "compliance",
      severity: "low",
      iconKey: "shield",
      timestamp: ins.insurance_expiry,
      href: `/dashboard/cattle/${ins.id}`,
      isRead: false,
      isPinned: false,
      isArchived: false,
      actionLabel: L("দেখুন", "View"),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={L("নোটিফিকেশন", "Notifications")}
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
