import type { Metadata } from "next";
import { Suspense } from "react";
import { Syringe } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { selectAll } from "@/lib/supabase/select-all";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  VaccinationPlatformWorkspace,
  type HubEventItem,
  type CattleLite,
  type VaccineInventoryItem,
} from "@/components/cattle/VaccinationPlatformWorkspace";
import { EmptyState } from "@/components/shared/EmptyState";
import { getL } from "@/i18n/server-text";
import { addDays, startOfMonth, todayDhaka } from "@/lib/dates";

export const metadata: Metadata = { title: "টিকা ও কাজ" };

export default function HealthVaccinationsPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="space-y-4 animate-fade-in-up"><div className="h-10 w-56 animate-shimmer rounded" /><div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-shimmer rounded-xl" />)}</div><div className="h-[450px] animate-shimmer rounded-xl" /></div>}>
        <VaccinationSection />
      </Suspense>
    </div>
  );
}

type EventRow = { id: string; cattle_id: string; title: string; event_type: string; scheduled_at: string; notes: string | null };

async function VaccinationSection() {
  const L = await getL();
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Syringe} title={L("খামার পাওয়া যায়নি", "No business found")} />;

  // the farm calendar (Dhaka), not the server's UTC date
  const todayISO = todayDhaka();
  const in7ISO = addDays(todayISO, 7);

  const [rawEvents, { count: completedThisMonth }, { data: herd }, { data: stock }] = await Promise.all([
    selectAll<EventRow>(() => supabase.from("health_events").select("id, cattle_id, title, event_type, scheduled_at, notes")
      .eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).order("scheduled_at", { ascending: true }).order("id")),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("completed_at", startOfMonth(todayISO)).is("deleted_at", null),
    supabase.from("cattle").select("id, tag_id, breed, status").eq("business_id", businessId).is("deleted_at", null).eq("status", "active").order("tag_id", { ascending: true }),
    // medicine stock from THE stock ledger view (it used to add up raw rows with a wrong sign rule)
    supabase.from("v_inventory_balance").select("item_id, name, unit, qty_on_hand").eq("business_id", businessId).eq("category", "medicine"),
  ]);

  const cattleList: CattleLite[] = (herd ?? []).map((c) => ({ id: c.id, tag_id: c.tag_id, breed: c.breed ?? null, status: c.status ?? null }));
  const byId = new Map(cattleList.map((c) => [c.id, c]));
  const events: HubEventItem[] = rawEvents
    .filter((e) => byId.has(e.cattle_id))
    .map((e) => ({
      id: e.id, cattle_id: e.cattle_id, title: e.title,
      event_type: e.event_type as HubEventItem["event_type"],
      scheduled_at: e.scheduled_at, notes: e.notes,
      cattle: { tag_id: byId.get(e.cattle_id)!.tag_id, breed: byId.get(e.cattle_id)!.breed ?? null },
    }));
  const overdueCount = events.filter((e) => e.scheduled_at < todayISO).length;
  const thisWeekCount = events.filter((e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO).length;
  const vaccineStock: VaccineInventoryItem[] = (stock ?? [])
    .filter((s) => s.item_id && s.name)
    .map((s) => ({ id: s.item_id as string, name: s.name as string, unit: s.unit ?? "", qty: Math.max(0, Math.round(Number(s.qty_on_hand ?? 0) * 100) / 100) }));

  return (
    <>
      <PageHeader
        title={L("টিকা ও কাজ", "Vaccines & tasks")}
        subtitle={L("বাকি টিকা, কৃমিনাশক ও চেকআপ — হয়ে গেলে \"হয়ে গেছে\" চাপুন", "Vaccines, deworming and check-ups waiting — tap Done when finished")}
        icon={Syringe}
        badge={overdueCount || undefined}
        badgeVariant="destructive"
      />
      <VaccinationPlatformWorkspace
        events={events}
        allCattle={cattleList}
        inventoryItems={vaccineStock}
        todayISO={todayISO}
        in7ISO={in7ISO}
        stats={{ overdue: overdueCount, thisWeek: thisWeekCount, completedThisMonth: completedThisMonth ?? 0 }}
      />
    </>
  );
}
