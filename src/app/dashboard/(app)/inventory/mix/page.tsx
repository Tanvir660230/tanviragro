import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Blend } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { loadFeedData } from "@/lib/feed/feed-data";
import { undonePurchaseIds } from "@/lib/inventory/purchase-rows";
import { buildPurchaseContext, type PurchaseRow } from "@/lib/inventory/purchase-memo";
import { buildMixHistory, type MixBatchRow, type MixInputRow } from "@/lib/inventory/mix-history";
import { MixClient, type MixPageData } from "@/components/inventory/MixClient";
import { MIX_TEXT } from "@/components/inventory/mix-text";
import { selectAll } from "@/lib/supabase/select-all";

export const metadata: Metadata = { title: "Feed mix" };

type RecipeRow = {
  id: string; name: string; active_from: string | null; active_until: string | null; created_at: string; deleted_at: string | null;
  recipe_ingredients: { item_id: string; qty_per_batch: number | string }[] | null;
};

export default async function FeedMixPage() {
  const ctx = await requirePagePermission(PERMISSIONS.INVENTORY_VIEW);
  const supabase = await createClient();
  const lang = (await cookies()).get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const feed = await loadFeedData(supabase, ctx.businessId);
  const itemIds = feed.items.map((i) => i.id);

  const [{ data: batchData }, { data: inputData }, { data: purchaseData }, { data: recipeData }] = await Promise.all([
    supabase.from("feed_mix_batches").select("id, mix_date, output_item_id, output_qty, input_qty, total_cost, note, created_at, undone_at, undo_reason")
      .eq("business_id", ctx.businessId).order("mix_date", { ascending: false }),
    itemIds.length
      ? selectAll(() => supabase.from("inventory_transactions").select("id, item_id, qty, unit_cost, idempotency_key").in("item_id", itemIds).eq("movement_type", "feed_mix_input").like("idempotency_key", "feed-mix:%").order("id")).then((data) => ({ data }))
      : Promise.resolve({ data: [] }),
    selectAll(() => supabase.from("inventory_transactions")
      .select("id, item_id, qty, unit_cost, recorded_at, created_at, notes, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", ctx.businessId).eq("movement_type", "purchase").order("id")).then((data) => ({ data })),
    supabase.from("feed_recipes").select("id, name, active_from, active_until, created_at, deleted_at, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", ctx.businessId).order("created_at", { ascending: false }),
  ]);

  const itemInfo = Object.fromEntries(feed.items.map((i) => [i.id, { name: i.name, unit: i.unit, kgPerUnit: i.kgPerUnit }]));
  const history = buildMixHistory((batchData ?? []) as MixBatchRow[], (inputData ?? []) as MixInputRow[], itemInfo);

  const rows = (purchaseData ?? []) as unknown as PurchaseRow[];
  const undone = await undonePurchaseIds(supabase, rows.map((r) => r.id));
  const purchases = buildPurchaseContext({ rows: rows.filter((r) => !undone.has(r.id)), recentLimit: 3 });

  const data: MixPageData = {
    asOf: feed.asOf,
    canEdit: hasPermission(ctx, PERMISSIONS.FEED_MIX),
    items: feed.items.map((i) => ({
      id: i.id, name: i.name, unit: i.unit, kgPerUnit: i.kgPerUnit, category: i.category, role: i.role, discontinued: i.discontinued,
      stockQty: i.stockQty, wac: i.wac, daysLeft: i.daysLeft, inUse: !!i.openPeriodId,
    })),
    history,
    memos: purchases.recentMemos.map((m) => ({ key: m.key, date: m.date, supplier: m.supplier, lines: purchases.memoLines[m.key] ?? [] })),
    oldRecipes: ((recipeData ?? []) as RecipeRow[]).map((r) => {
      const ing = r.recipe_ingredients ?? [];
      const total = ing.reduce((s, x) => s + Number(x.qty_per_batch), 0);
      return {
        id: r.id, name: r.name, from: r.active_from ?? r.created_at.slice(0, 10), until: r.active_until?.slice(0, 10) ?? null, deleted: !!r.deleted_at,
        lines: ing.map((x) => ({ name: itemInfo[x.item_id]?.name ?? "—", qty: Number(x.qty_per_batch), pct: total > 0 ? (Number(x.qty_per_batch) / total) * 100 : 0 }))
          .sort((a, b) => b.qty - a.qty),
      };
    }),
  };
  const t = MIX_TEXT[lang];

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 pb-12">
      <PageHeader title={t.title} subtitle={t.subtitle} icon={Blend} back="/dashboard/inventory" />
      <MixClient data={data} lang={lang} />
    </div>
  );
}
