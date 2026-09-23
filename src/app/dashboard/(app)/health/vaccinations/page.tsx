import type { Metadata } from "next";
import { Suspense } from "react";
import { Syringe } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  VaccinationPlatformWorkspace,
  type HubEventItem,
  type CattleLite,
  type VaccineInventoryItem,
} from "@/components/cattle/VaccinationPlatformWorkspace";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = {
  title: "Vaccinations | Health EHR",
};

export default function HealthVaccinationsPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="space-y-4 animate-fade-in-up"><div className="h-10 w-56 animate-shimmer rounded" /><div className="grid grid-cols-4 gap-4">{[0,1,2,3].map(i=><div key={i} className="h-24 animate-shimmer rounded-xl"/>)}</div><div className="h-[450px] animate-shimmer rounded-xl"/></div>}>
        <VaccinationSection />
      </Suspense>
    </div>
  );
}

async function VaccinationSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Syringe} title="No business found" />;

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const in7ISO = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [{ data: rawEvents }, { count: completedThisMonth }, { data: allCattleRaw }, { data: inventoryRaw }, { data: txnsRaw }] = await Promise.all([
    supabase.from("health_events").select("id, cattle_id, title, event_type, scheduled_at, notes").eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).order("scheduled_at", { ascending: true }).limit(500),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("completed_at", firstOfMonth).is("deleted_at", null),
    supabase.from("cattle").select("id, tag_id, breed, status").eq("business_id", businessId).is("deleted_at", null).order("tag_id", { ascending: true }),
    supabase.from("inventory_items").select("id, name, unit, category, low_stock_threshold").eq("business_id", businessId).is("deleted_at", null).order("name", { ascending: true }),
    supabase.from("inventory_transactions").select("item_id, type, qty, inventory_items!inner(business_id)").eq("inventory_items.business_id", businessId),
  ]);

  const stockMap: Record<string, number> = {};
  for (const txn of txnsRaw ?? []) {
    const q = Number(txn.qty) || 0;
    stockMap[txn.item_id] = (stockMap[txn.item_id] ?? 0) + (txn.type === "purchase" ? q : -q);
  }

  const cattleList: CattleLite[] = (allCattleRaw ?? []).map((c) => ({ id: c.id, tag_id: c.tag_id, breed: c.breed ?? undefined, status: c.status ?? undefined }));
  const cattleMap: Record<string, CattleLite> = {};
  for (const c of cattleList) cattleMap[c.id] = c;

  const events: HubEventItem[] = (rawEvents ?? []).map((e) => ({
    id: e.id, cattle_id: e.cattle_id, title: e.title,
    event_type: e.event_type as HubEventItem["event_type"],
    scheduled_at: e.scheduled_at, notes: e.notes,
    cattle: cattleMap[e.cattle_id] ? { tag_id: cattleMap[e.cattle_id].tag_id, breed: cattleMap[e.cattle_id].breed ?? null } : null,
  }));

  const overdueCount = events.filter((e) => e.scheduled_at < todayISO).length;
  const thisWeekCount = events.filter((e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO).length;

  const vaccineInventory: VaccineInventoryItem[] = (inventoryRaw ?? [])
    .filter((item) => {
      const n = (item.name || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      return cat.includes("med") || cat.includes("vaccine") || n.includes("vaccine") || n.includes("fmd") || n.includes("dose") || n.includes("anthrax") || n.includes("lsd");
    })
    .map((item) => ({ id: item.id, name: item.name, qty: Math.max(0, stockMap[item.id] ?? 0), unit: item.unit || "doses", min_threshold: item.low_stock_threshold ? Number(item.low_stock_threshold) : 5 }));

  return (
    <>
      <PageHeader title="Vaccination Platform" subtitle="Multi-dose protocols, mass campaigns, inventory FIFO, adverse registers" icon={Syringe} back="/dashboard/health" badge={overdueCount || undefined} badgeVariant="destructive" />
      <VaccinationPlatformWorkspace events={events} allCattle={cattleList} inventoryItems={vaccineInventory} todayISO={todayISO} in7ISO={in7ISO} stats={{ overdue: overdueCount, thisWeek: thisWeekCount, completedThisMonth: completedThisMonth ?? 0 }} />
    </>
  );
}
