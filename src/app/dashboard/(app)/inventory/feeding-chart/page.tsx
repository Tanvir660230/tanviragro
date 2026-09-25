import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { loadFeedData } from "@/lib/feed/feed-data";
import { FeedChartClient, type ChartTarget, type FeedChartData } from "@/components/inventory/FeedChartClient";
import { FEED_CHART_TEXT } from "@/components/inventory/feed-chart-text";

export const metadata: Metadata = { title: "Feeding chart" };

type RecipeRow = { id: string; name: string; recipe_ingredients: { item_id: string; qty_per_batch: number | string }[] | null };

export default async function FeedingChartPage() {
  const ctx = await requirePagePermission(PERMISSIONS.INVENTORY_VIEW);
  const supabase = await createClient();
  const lang = (await cookies()).get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const [feed, { data: recipes }] = await Promise.all([
    loadFeedData(supabase, ctx.businessId),
    supabase.from("feed_recipes").select("id, name, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", ctx.businessId).is("deleted_at", null).order("name"),
  ]);

  const itemById = new Map(feed.items.map((i) => [i.id, i]));
  const openSince = new Map(feed.periods.filter((p) => p.status === "open").map((p) => [`${p.targetType}:${p.targetId}`, p.startDate]));
  // recipes stay only if a chart was already made for one (the dated mix item is fed instead)
  const chartedRecipes = new Set(feed.charts.filter((c) => c.targetType === "recipe").map((c) => c.targetId));
  const targets: ChartTarget[] = [
    ...((recipes ?? []) as RecipeRow[]).filter((r) => chartedRecipes.has(r.id)).map((r): ChartTarget => {
      const ing = r.recipe_ingredients ?? [];
      const sum = ing.reduce((s, x) => s + Number(x.qty_per_batch), 0);
      return {
        key: `recipe:${r.id}`, type: "recipe", id: r.id, name: r.name, unit: "kg", kgPerUnit: 1, category: "recipe",
        inUse: openSince.has(`recipe:${r.id}`), inUseSince: openSince.get(`recipe:${r.id}`) ?? null, stockQty: null,
        ingredients: ing.map((x) => {
          const it = itemById.get(x.item_id);
          return { itemId: x.item_id, name: it?.name ?? "—", unit: it?.unit ?? "kg", kgPerUnit: it?.kgPerUnit ?? null,
            share: sum > 0 ? Number(x.qty_per_batch) / sum : 0, stockQty: it?.stockQty ?? 0 };
        }),
      };
    }),
    // the mix first, then feeds given as they are; ingredients (mixed, not fed directly) last
    ...[...feed.items].sort((x, y) => ({ mix: 0, direct: 1, ingredient: 2 })[x.role] - ({ mix: 0, direct: 1, ingredient: 2 })[y.role]).map((i): ChartTarget => ({
      key: `item:${i.id}`, type: "item", id: i.id, name: i.name, unit: i.unit, kgPerUnit: i.kgPerUnit, category: i.category,
      inUse: openSince.has(`item:${i.id}`), inUseSince: openSince.get(`item:${i.id}`) ?? null, stockQty: i.stockQty,
    })),
  ];

  const data: FeedChartData = {
    asOf: feed.asOf,
    canEdit: hasPermission(ctx, PERMISSIONS.INVENTORY_EDIT),
    targets,
    charts: feed.charts,
    animals: feed.animals,
  };
  const t = FEED_CHART_TEXT[lang];

  return (
    <div className="w-full min-w-0 space-y-4 pb-12">
      <PageHeader title={t.title} subtitle={t.sub} icon={Scale} back="/dashboard/inventory" />
      <FeedChartClient data={data} lang={lang} />
    </div>
  );
}
