import type { Metadata } from "next";
import { siteTitle } from "@/components/navigation/site-map";
import { CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { loadFeedData } from "@/lib/feed/feed-data";
import { feedCostBetween } from "@/lib/feed/usage-engine";
import { measuredGrowth } from "@/lib/growth/baseline";
import { FeedUsageClient, type UsagePageData } from "@/components/inventory/FeedUsageClient";
import { getL } from "@/i18n/server-text";

export const metadata: Metadata = { title: "খাবার ব্যবহার" };

export default async function FeedUsagePage() {
  const L = await getL();
  const ctx = await requirePagePermission(PERMISSIONS.INVENTORY_VIEW);
  const supabase = await createClient();
  const data = await loadFeedData(supabase, ctx.businessId);
  const { snapshot, periods, animals, items, asOf } = data;

  const thisMonth = asOf.slice(0, 7);
  const cattle = animals
    .filter((a) => a.to == null || a.to >= `${thisMonth}-01`)
    .map((a) => {
      const f = snapshot.perAnimal[a.id];
      const growth = measuredGrowth(
        { initial_weight_kg: a.initialWeightKg, initial_weight_type: a.initialWeightType, purchase_date: a.from },
        a.logs.map((l) => ({ weight_kg: l.kg, recorded_at: l.date, weight_type: l.type }))
      );
      return {
        id: a.id, tag: a.tag, actual: f?.actual ?? 0, estimated: f?.estimated ?? 0,
        gainKg: growth?.gainKg ?? null,
        // feed over the SAME days as the measured gain (not feed to today ÷ gain to the last weighing)
        costPerKgGain: growth && growth.gainKg > 0 && f ? feedCostBetween(f, growth.baseline.date, growth.latestDate) / growth.gainKg : null,
      };
    })
    .sort((x, y) => x.tag.localeCompare(y.tag));

  const pageData: UsagePageData = {
    asOf,
    canEdit: hasPermission(ctx, PERMISSIONS.INVENTORY_EDIT),
    periods: periods.map((p) => ({ ...p, lines: p.lines.map(({ posted: _posted, ...l }) => ({ ...l })) })).reverse(),
    lines: snapshot.lines,
    items,
    // recipes are no longer a feeding target: the dated mix item is fed instead (old recipe periods still show)
    recipes: [] as { id: string; name: string }[],
    chartTargets: [...new Set(data.charts.map((c) => `${c.targetType}:${c.targetId}`))],
    totals: {
      actualThisMonth: snapshot.byMonth[thisMonth]?.actual ?? 0,
      estimatedThisMonth: snapshot.byMonth[thisMonth]?.estimated ?? 0,
      actualAll: snapshot.totals.actual,
      estimatedAll: snapshot.totals.estimated,
      unreconciledLines: snapshot.totals.unreconciledLines,
      recordedMissingCost: snapshot.totals.recordedMissingCost,
      stockValue: items.reduce((s, i) => s + i.stockValue, 0),
      unallocated: snapshot.unallocated,
    },
    byMonth: Object.entries(snapshot.byMonth).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12),
    byItem: Object.entries(snapshot.byItem).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.actualValue - a.actualValue),
    cattle,
  };

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title={siteTitle(L, "/dashboard/inventory/usage", "Feed Usage")}
        subtitle={L("খাওয়ানো শুরু হলে চালু করুন, শেষ হলে শেষ করুন। প্রতিদিনের খরচ সিস্টেম নিজে হিসাব করে — রোজ লিখতে হয় না।", "Start a feed when you begin using it, end it when it finishes. The system works out daily use and cost — no daily entry needed.")}
        icon={CalendarRange}
        back="/dashboard/inventory"
      />
      <FeedUsageClient data={pageData} />
    </div>
  );
}
