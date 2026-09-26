import { todayDhaka } from "@/lib/dates";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { getBusinessContext } from "@/lib/context/business-context";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import type { HealthEvent, UnweighedAlert } from "./SmartAlertsDropdown";

/**
 * The header: the farm and the user from the request's one business context, and the alerts
 * (read in one go, with the tags) — no queries of its own before them.
 */
export async function TopBar() {
  const ctx = await getBusinessContext().catch(() => null);
  const alerts = await getCachedTopBarAlerts(ctx?.businessId ?? "", todayDhaka());
  const tag = (id: string) => alerts.tagById[id] ?? null;

  const toHealthEvent = (h: { id: string; title: string; scheduled_at: string; cattle_id: string }): HealthEvent => ({
    id: h.id, title: h.title, scheduled_at: h.scheduled_at, cattle_id: h.cattle_id,
    cattle: h.cattle_id ? { tag_id: tag(h.cattle_id) } : null,
  });
  const unweighedCattle: UnweighedAlert[] = alerts.unweighedCattleIds.map((id) => ({ id, tag_id: tag(id) ?? id.slice(0, 6) }));
  const biz = ctx?.business as { id: string; name?: string | null; logo_url?: string | null } | undefined;

  return (
    <DashboardHeader
      business={biz ? { id: biz.id, name: biz.name ?? undefined, logo_url: biz.logo_url ?? null } : null}
      user={ctx ? { email: ctx.user.email } : null}
      profile={ctx?.user.profile ? { full_name: ctx.user.profile.full_name, avatar_url: ctx.user.profile.avatar_url } : null}
      alerts={{
        overdueHealth: alerts.overdueHealth.map(toHealthEvent),
        upcomingHealth: alerts.upcomingHealth.map(toHealthEvent),
        lowStockItems: alerts.lowStockItems,
        loansDue: alerts.loansDue,
        insuranceExpiring: alerts.insuranceExpiring,
        unweighedCattle,
      }}
    />
  );
}
