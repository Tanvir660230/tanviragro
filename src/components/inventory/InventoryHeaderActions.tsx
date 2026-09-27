"use client";

import { useState } from "react";
import Link from "next/link";
import { Blend, Plus, Receipt } from "lucide-react";
import { AddItemDialog } from "./AddItemDialog";
import { VIEW_TEXT, type ViewLang } from "./inventory-view-text";

/**
 * The page's three buttons: Buy, Make a mix, Add item (each only for someone allowed to).
 * The section's other pages are in the tab row above every stock page, so they are not repeated.
 */
export function InventoryHeaderActions({ lang, perms, openAdd }: {
  lang: ViewLang;
  perms: { purchase: boolean; mix: boolean; create: boolean };
  /** ?open=add: the Add item dialog opens with the page */
  openAdd: boolean;
}) {
  const t = VIEW_TEXT[lang];
  const [adding, setAdding] = useState(openAdd && perms.create);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {perms.purchase && (
        <Link href="/dashboard/inventory/purchase"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
          <Receipt className="h-4 w-4" aria-hidden />{t.buy}
        </Link>
      )}
      {perms.mix && (
        <Link href="/dashboard/inventory/mix"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10">
          <Blend className="h-4 w-4" aria-hidden />{t.mix}
        </Link>
      )}
      {perms.create && (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
          <Plus className="h-4 w-4" aria-hidden />{t.add_item}
        </button>
      )}
      {adding && <AddItemDialog open onOpenChange={(o) => { if (!o) setAdding(false); }} />}
    </div>
  );
}
