import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBox } from "./SearchBox";
import { SmartAlertsDropdown } from "./SmartAlertsDropdown";
import type {
  HealthEvent,
  InventoryItem,
  LoanDueAlert,
  InsuranceAlert,
  UnweighedAlert,
} from "./SmartAlertsDropdown";

export async function TopBar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const todayISO        = now.toISOString().slice(0, 10);
  const in7DaysISO      = new Date(now.getTime() +  7 * 86400000).toISOString().slice(0, 10);
  const in30DaysISO     = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgoISO = new Date(now.getTime() -  7 * 86400000).toISOString().slice(0, 10);

  const [{ data: bizData }, { data: profileData }] = await Promise.all([
    supabase.from("businesses").select("id, name, logo_url").eq("owner_id", user?.id ?? "").maybeSingle(),
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

  const email   = user?.email ?? "";
  const bizName = bizData?.name ?? "Chowdhury Agro";
  const bizLogo = bizData?.logo_url;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/50 bg-background/95 backdrop-blur-md px-4 md:px-5">

      {/* Mobile: Logo + name */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary overflow-hidden shrink-0">
          {bizLogo ? (
            <Image src={bizLogo} alt={bizName} fill className="object-cover" />
          ) : (
            <span className="text-sm leading-none">🌿</span>
          )}
        </div>
        <span className="text-sm font-bold text-foreground truncate max-w-[140px]">{bizName}</span>
      </div>

      {/* Desktop: Search bar */}
      <div className="hidden md:flex flex-1 max-w-xl">
        <SearchBox />
      </div>

      {/* Mobile spacer */}
      <div className="flex-1 md:hidden" />

      {/* Right: Alerts · Theme · User — 3 items only */}
      <div className="flex items-center gap-1 ml-auto">
        <SmartAlertsDropdown
          overdueHealth={overdueHealth}
          upcomingHealth={upcomingHealth}
          lowStockItems={lowStockItems}
          loansDue={loansDue}
          insuranceExpiring={insuranceExpiring}
          unweighedCattle={unweighedCattle}
        />
        <ThemeToggle compact />
        <div className="w-px h-4 bg-border/50 mx-1" />
        <UserMenu email={email} profile={profileData} />
      </div>
    </header>
  );
}
