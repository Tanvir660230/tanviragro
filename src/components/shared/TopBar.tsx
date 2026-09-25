import { createClient } from "@/lib/supabase/server";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import type {
  HealthEvent,
  InventoryItem,
  LoanDueAlert,
  InsuranceAlert,
  UnweighedAlert,
} from "./SmartAlertsDropdown";
import { getCachedBusinessId } from "@/lib/supabase/cached";

export async function TopBar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const todayISO        = now.toISOString().slice(0, 10);
  const in7DaysISO      = new Date(now.getTime() +  7 * 86400000).toISOString().slice(0, 10);
  const in30DaysISO     = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgoISO = new Date(now.getTime() -  7 * 86400000).toISOString().slice(0, 10);

  const [{ data: bizData }, { data: profileData }] = await Promise.all([
    supabase.from("businesses").select("id, name, logo_url").eq("id", (await getCachedBusinessId()) ?? "").maybeSingle(),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user?.id ?? "").maybeSingle(),
  ]);

  const bizId = bizData?.id ?? "";

  const alerts = await getCachedTopBarAlerts(bizId, todayISO, in7DaysISO, in30DaysISO, sevenDaysAgoISO);

  const allLookupIds = [...new Set([...alerts.allCattleIds, ...alerts.unweighedCattleIds])];
  const { data: cattleRows } = allLookupIds.length
    ? await supabase.from("cattle").select("id, tag_id").in("id", allLookupIds)
    : { data: [] as { id: string; tag_id: string }[] };
  const cattleTagMap: Record<string, string> = {};
  for (const c of (cattleRows ?? [])) cattleTagMap[c.id] = c.tag_id;

  const toHealthEvent = (h: { id: string; title: string; scheduled_at: string; cattle_id: string }): HealthEvent => ({
    id: h.id,
    title: h.title,
    scheduled_at: h.scheduled_at,
    cattle_id: h.cattle_id,
    cattle: h.cattle_id ? { tag_id: cattleTagMap[h.cattle_id] ?? null } : null,
  });

  const overdueHealth: HealthEvent[]        = alerts.overdueHealth.map(toHealthEvent);
  const upcomingHealth: HealthEvent[]       = alerts.upcomingHealth.map(toHealthEvent);
  const lowStockItems: InventoryItem[]      = alerts.lowStockItems;
  const loansDue: LoanDueAlert[]            = alerts.loansDue;
  const insuranceExpiring: InsuranceAlert[] = alerts.insuranceExpiring;
  const unweighedCattle: UnweighedAlert[]   = alerts.unweighedCattleIds.map((id) => ({
    id,
    tag_id: cattleTagMap[id] ?? id.slice(0, 6),
  }));

  return (
    <DashboardHeader
      business={bizData}
      user={user}
      profile={profileData}
      alerts={{
        overdueHealth,
        upcomingHealth,
        lowStockItems,
        loansDue,
        insuranceExpiring,
        unweighedCattle,
      }}
    />
  );
}

