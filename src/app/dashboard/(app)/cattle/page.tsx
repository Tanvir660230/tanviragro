import type { Metadata } from "next";
import { Beef } from "lucide-react";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/shared/PageHeader";
import { AddCattleDialog } from "@/components/cattle/AddCattleDialog";
import { CattleBoard, type CattlePerms } from "@/components/cattle/CattleBoard";
import { CATTLE_TEXT } from "@/components/cattle/cattle-view-text";
import { loadCattleBoard } from "@/lib/cattle/board-data";
import { todayDhaka } from "@/lib/dates";
import { getDictionary } from "@/i18n/getDictionary";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";

export const metadata: Metadata = { title: "Livestock" };

/**
 * The cattle list. Every figure (cards, table, CSV) comes from ONE calculation — the central
 * board (lib/cattle/board.ts → the homepage model and the feed engine) — so the homepage, this
 * list and each animal's page never disagree. The page only reads it and who may do what.
 */
export default async function CattlePage(props: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await props.searchParams;
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const t = await getDictionary(locale);
  const tc = CATTLE_TEXT[locale];

  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  const today = todayDhaka();

  const [board, ctx] = businessId
    ? await Promise.all([loadCattleBoard(supabase, businessId, today), getBusinessContext(supabase).catch(() => null)])
    : [null, null];
  const can = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) => (ctx ? hasPermission(ctx, p) : false);
  const perms: CattlePerms = {
    create: can(PERMISSIONS.CATTLE_CREATE),
    edit: can(PERMISSIONS.CATTLE_EDIT),
    weigh: can(PERMISSIONS.WEIGHT_LOG),
    health: can(PERMISSIONS.HEALTH_MANAGE),
    cost: can(PERMISSIONS.COST_ENTRY_CREATE),
    export: can(PERMISSIONS.CATTLE_EXPORT),
    sell: can(PERMISSIONS.CATTLE_SELL),
  };

  if (!board || board.animals.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title={t.cattle.title} icon={Beef} />
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/50">
            <Beef className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">{tc.none}</h2>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{tc.none_sub}</p>
          </div>
          {perms.create && <AddCattleDialog existingTagIds={[]} existingBreeds={[]} defaultOpen={open === "add"} />}
        </div>
      </div>
    );
  }

  const allBreeds = [...new Set(board.animals.map((a) => a.breed).filter(Boolean) as string[])].sort();
  const existingTagIds = board.animals.map((a) => a.tag);

  return (
    <CattleBoard
      board={board}
      existingTagIds={existingTagIds}
      allBreeds={allBreeds}
      today={today}
      openWeigh={open === "bulk-weigh"}
      openAdd={open === "add"}
      perms={perms}
      lang={locale}
      tb={t.cattle_board}
      th={t.home}
    />
  );
}
