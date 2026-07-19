import type { Metadata } from "next";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { VendorList } from "@/components/vendors/VendorList";
import type { Vendor } from "@/types/database";
import { cookies } from "next/headers";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Vendors" };

function VendorListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="h-10 w-32 rounded-md animate-shimmer overflow-hidden" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 rounded-xl animate-shimmer overflow-hidden" />
        ))}
      </div>
    </div>
  );
}

async function VendorSection({ t }: { t: Dictionary }) {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  // Vendors with cattle & inventory counts
  const [{ data: vendorsData }, { data: cattleData }, { data: itemsData }] =
    await Promise.all([
      supabase
        .from("vendors")
        .select("*")
        .eq("business_id", businessId ?? "")
        .order("created_at", { ascending: false }),
      businessId
        ? supabase
            .from("cattle")
            .select("vendor_id, purchase_price, id")
            .eq("business_id", businessId)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
      businessId
        ? supabase
            .from("inventory_items")
            .select("vendor_id, id")
            .eq("business_id", businessId)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
    ]);

  const vendors = (vendorsData ?? []) as Vendor[];
  const cattle = (cattleData ?? []) as { vendor_id: string | null; purchase_price: number; id: string }[];
  const items = (itemsData ?? []) as { vendor_id: string | null; id: string }[];

  // Build stats per vendor
  type VendorStats = {
    cattleCount: number;
    totalPurchase: number;
    itemCount: number;
  };
  const statsMap: Record<string, VendorStats> = {};
  for (const c of cattle) {
    if (!c.vendor_id) continue;
    if (!statsMap[c.vendor_id]) statsMap[c.vendor_id] = { cattleCount: 0, totalPurchase: 0, itemCount: 0 };
    statsMap[c.vendor_id].cattleCount++;
    statsMap[c.vendor_id].totalPurchase += Number(c.purchase_price);
  }
  for (const item of items) {
    if (!item.vendor_id) continue;
    if (!statsMap[item.vendor_id]) statsMap[item.vendor_id] = { cattleCount: 0, totalPurchase: 0, itemCount: 0 };
    statsMap[item.vendor_id].itemCount++;
  }

  const enrichedVendors = vendors.map((v) => ({
    ...v,
    ...(statsMap[v.id] ?? { cattleCount: 0, totalPurchase: 0, itemCount: 0 }),
  }));

  return <VendorList vendors={enrichedVendors} />;
}

export default async function VendorsPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");

  return (
    <div className="space-y-4">
      <PageHeader title={t.vendors.title} subtitle={t.vendors.subtitle} />
      
      <ErrorBoundary fallbackMessage="Failed to load vendors">
        <Suspense fallback={<VendorListSkeleton />}>
          <VendorSection t={t} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
