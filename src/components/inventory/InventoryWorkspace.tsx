"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Blend, CheckCircle2, ClipboardCheck, PlayCircle, Receipt, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";
import type { LastMix, TodoRow } from "@/lib/inventory/stock-view";
import { EndDialog, RuleDialog, StartDialog, type UsageDialogData } from "./FeedUsageClient";
import { InventoryFeedBoard } from "./InventoryFeedBoard";
import { FinishDialog, StockList, type StockAction, type StockPerms, type StockStatus } from "./StockList";
import { LogConsumptionDialog, OwnStockDialog, type CattleOption } from "./ItemActions";
import { EditItemDialog } from "./EditItemDialog";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { archiveInventoryItem, unarchiveInventoryItem } from "@/app/dashboard/(app)/inventory/actions";
import type { InventoryRow } from "./InventoryTable";
import { VIEW_TEXT, fillText, type ViewLang } from "./inventory-view-text";

type TI = Dictionary["inventory_home"];
type TH = Dictionary["home"];

const qtyText = (n: number, unit?: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;

/** the one dialog open at a time (every button on the page opens one of these) */
type Open =
  | { kind: "start"; preset: string }
  | { kind: "end"; period: Period }
  | { kind: "check"; period: Period }
  | { kind: "rule"; period: Period }
  | { kind: "finish"; item: InventoryRow }
  | { kind: "adjust"; item: InventoryRow }
  | { kind: "own"; item: InventoryRow }
  | { kind: "use"; item: InventoryRow }
  | { kind: "edit"; item: InventoryRow }
  | { kind: "delete"; item: InventoryRow };

/**
 * The working part of the stock page: what needs doing, the feeds in use and all stock.
 * Every dialog lives here (never inside a menu, which unmounts when it closes), so the same
 * dialog opens from the to-do card, an in-use card or a stock row.
 */
export function InventoryWorkspace({ lang, asOf, perms, usage, open, lines, items, discontinued, status, todo, lowIds, lastMix, cattle, ti, th }: {
  lang: ViewLang;
  asOf: string;
  perms: StockPerms & { create: boolean; mix: boolean };
  /** feed engine data the usage dialogs need */
  usage: UsageDialogData;
  open: Period[];
  lines: LineResult[];
  items: InventoryRow[];
  discontinued: InventoryRow[];
  status: Record<string, StockStatus>;
  todo: TodoRow[];
  lowIds: string[];
  lastMix: Record<string, LastMix>;
  cattle: CattleOption[];
  ti: TI; th: TH;
}) {
  const t = VIEW_TEXT[lang];
  const router = useRouter();
  const [dlg, setDlg] = useState<Open | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => setDlg(null);

  const byId = new Map([...items, ...discontinued].map((i) => [i.id, i]));
  const periodOf = (itemId: string) => open.find((p) => p.lines.some((l) => l.itemId === itemId)) ?? null;
  const feedItems: FeedItemStatus[] = usage.items;
  const notStartedCount = todo.filter((r) => r.kind === "idle" || r.kind === "not_started").length;

  /** a count: on its feeding period when in use (so the daily deduction is corrected), else a stock count */
  const count = (itemId: string) => {
    const p = periodOf(itemId);
    if (p) { setDlg({ kind: "check", period: p }); return; }
    const it = byId.get(itemId);
    if (it) setDlg({ kind: "adjust", item: it });
  };

  const onAction = (a: StockAction, item: InventoryRow) => {
    switch (a) {
      case "own": case "use": case "edit": case "delete": case "finish": setDlg({ kind: a, item }); break;
      case "count": count(item.id); break;
      case "start": setDlg({ kind: "start", preset: `item:${item.id}` }); break;
      case "restore":
        startTransition(async () => {
          const res = await unarchiveInventoryItem(item.id);
          if (res.error) toast.error(res.error);
          else { toast.success(fillText(t.restore_ok, { name: item.name })); router.refresh(); }
        });
        break;
    }
  };

  const doDelete = (item: InventoryRow) => {
    close();
    startTransition(async () => {
      const res = await archiveInventoryItem(item.id);
      if (res.error) toast.error(res.error);
      else { toast.success(fillText(t.del_ok, { name: item.name })); router.refresh(); }
    });
  };

  return (
    <div className={cn("min-w-0 space-y-6", pending && "opacity-80 transition-opacity")}>
      <TodoCard todo={todo} t={t} perms={perms} onStart={(id) => setDlg({ kind: "start", preset: `item:${id}` })} onCount={count} />

      <InventoryFeedBoard asOf={asOf} items={feedItems} open={open} lines={lines} canEdit={perms.edit} ti={ti} th={th} lang={lang}
        notStartedCount={notStartedCount}
        onStart={() => setDlg({ kind: "start", preset: "" })}
        onCount={(p) => setDlg({ kind: "check", period: p })}
        onFinish={(p) => setDlg({ kind: "end", period: p })}
        onRule={(p) => setDlg({ kind: "rule", period: p })} />

      <StockList items={items} discontinued={discontinued} status={status} lang={lang} perms={perms} asOf={asOf}
        lowIds={lowIds} lastMix={lastMix} onAction={onAction} />

      {/* the dialogs */}
      {dlg?.kind === "start" && <StartDialog data={usage} preset={dlg.preset} onClose={close} lang={lang} />}
      {dlg?.kind === "end" && <EndDialog data={usage} period={dlg.period} onClose={close} lang={lang} />}
      {dlg?.kind === "check" && <EndDialog data={usage} period={dlg.period} checkpoint onClose={close} lang={lang} />}
      {dlg?.kind === "rule" && <RuleDialog data={usage} period={dlg.period} onClose={close} lang={lang} />}
      {dlg?.kind === "finish" && <FinishDialog items={[dlg.item]} status={status} lang={lang} asOf={asOf} onClose={close} onDone={close} />}
      {dlg?.kind === "adjust" && (
        <StockAdjustmentDialog itemId={dlg.item.id} itemName={dlg.item.name} currentStock={dlg.item.stock} unit={dlg.item.unit}
          open onOpenChange={(o) => { if (!o) close(); }} />
      )}
      {dlg?.kind === "own" && <OwnStockDialog item={dlg.item} open onOpenChange={(o) => { if (!o) close(); }} />}
      {dlg?.kind === "use" && <LogConsumptionDialog item={dlg.item} cattle={cattle} open onOpenChange={(o) => { if (!o) close(); }} />}
      {dlg?.kind === "edit" && <EditItemDialog item={dlg.item} open onOpenChange={(o) => { if (!o) close(); }} />}
      {dlg?.kind === "delete" && (
        <ConfirmDialog open title={fillText(t.del_title, { name: dlg.item.name })} description={t.del_body}
          confirmLabel={t.m_delete} cancelLabel={t.cancel} destructive onConfirm={() => doDelete(dlg.item)} onCancel={close} />
      )}
    </div>
  );
}

/** Everything that needs doing now, most urgent first, each with the one button that does it. */
function TodoCard({ todo, t, perms, onStart, onCount }: {
  todo: TodoRow[];
  t: (typeof VIEW_TEXT)[ViewLang];
  perms: StockPerms & { mix: boolean };
  onStart: (itemId: string) => void;
  onCount: (itemId: string) => void;
}) {
  const btn = "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold";
  const primary = cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90");
  const outline = cn(btn, "border border-border bg-card hover:border-primary/40 hover:bg-primary/5");

  const detail = (r: TodoRow) =>
    r.kind === "out" ? t.todo_out
      : r.kind === "negative" ? fillText(t.todo_negative, { qty: qtyText(r.qty ?? 0, r.unit) })
      : r.kind === "low" ? (r.days != null ? fillText(t.todo_low_days, { days: r.days }) : fillText(t.todo_low_level, { qty: qtyText(r.qty ?? 0, r.unit) }))
      : r.kind === "idle" ? fillText(t.todo_idle, { days: r.days ?? 0 })
      : r.kind === "not_started" ? t.todo_not_started
      : t.todo_waiting;
  const urgent = (r: TodoRow) => r.kind === "out" || r.kind === "negative" || r.kind === "low" || r.kind === "idle";

  const actions = (r: TodoRow) => {
    const buy = perms.purchase && (
      <Link key="buy" href={`/dashboard/inventory/purchase?item=${r.itemId}`} className={r.kind === "low" ? primary : outline}>
        <Receipt className="h-4 w-4" aria-hidden />{t.do_buy}
      </Link>
    );
    switch (r.kind) {
      case "out": return [perms.edit && <button key="count" type="button" onClick={() => onCount(r.itemId)} className={primary}><ClipboardCheck className="h-4 w-4" aria-hidden />{t.do_count}</button>, buy];
      case "negative": return [perms.edit && <button key="count" type="button" onClick={() => onCount(r.itemId)} className={primary}><ClipboardCheck className="h-4 w-4" aria-hidden />{t.do_count}</button>];
      case "low": return [buy];
      case "idle": case "not_started":
        return [perms.edit && <button key="start" type="button" onClick={() => onStart(r.itemId)} className={primary}><PlayCircle className="h-4 w-4" aria-hidden />{t.do_start}</button>];
      case "waiting":
        return [perms.mix && <Link key="mix" href="/dashboard/inventory/mix" className={primary}><Blend className="h-4 w-4" aria-hidden />{t.do_mix}</Link>];
    }
  };

  return (
    <section id="todo" aria-labelledby="todo-title" className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <h2 id="todo-title" className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-base font-semibold">
        {todo.length ? <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden /> : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />}
        {t.todo_title}
        {todo.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">{todo.length}</span>}
      </h2>
      {todo.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{t.todo_none}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {todo.map((r) => (
            <li key={`${r.kind}:${r.itemId}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  r.kind === "waiting" ? "bg-sky-500" : r.kind === "not_started" ? "bg-amber-500" : urgent(r) ? "bg-red-500" : "bg-amber-500")} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className={cn("text-sm", urgent(r) ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
                    {r.kind === "out" || r.kind === "negative" ? <TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> : null}{detail(r)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 pl-4 sm:pl-0">{actions(r)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
