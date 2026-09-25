"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Calendar, CheckCheck, CheckCircle2, Clock, Plus, Search, Syringe, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { giveVaccineAction } from "@/app/dashboard/(app)/cattle/vaccination-actions";
import { completeHealthEventHub, deleteHealthEventHub } from "@/app/dashboard/(app)/cattle/health/actions";
import { useL } from "@/i18n/text";

export interface CattleLite {
  id: string;
  tag_id: string;
  breed?: string | null;
  status?: string | null;
}

/** medicine/vaccine stock (from the stock ledger) */
export interface VaccineInventoryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

export interface HubEventItem {
  id: string;
  cattle_id: string;
  title: string;
  event_type: "vaccine" | "checkup" | "deworming" | "treatment" | "other";
  scheduled_at: string;
  notes: string | null;
  cattle: { tag_id: string; breed: string | null } | null;
}

interface Props {
  events: HubEventItem[];
  allCattle: CattleLite[];
  inventoryItems: VaccineInventoryItem[];
  todayISO: string;
  in7ISO: string;
  stats: { overdue: number; thisWeek: number; completedThisMonth: number };
}

type Filter = "all" | "overdue" | "today" | "upcoming";

/**
 * Vaccines & tasks: the list of health tasks waiting to be done, with "Done" for a quick tick and
 * "Give vaccine" to record details (dose, stock used, follow-up) for one or several animals.
 */
export function VaccinationPlatformWorkspace({ events, allCattle, inventoryItems, todayISO, in7ISO, stats }: Props) {
  const L = useL();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ event: HubEventItem | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => events.filter((e) => !removed.has(e.id)), [events, removed]);
  const overdue = visible.filter((e) => e.scheduled_at < todayISO);
  const today = visible.filter((e) => e.scheduled_at === todayISO);
  const upcoming = visible.filter((e) => e.scheduled_at > todayISO && e.scheduled_at <= in7ISO);

  const list = useMemo(() => {
    const base = filter === "overdue" ? overdue : filter === "today" ? today : filter === "upcoming" ? upcoming : visible;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => e.title.toLowerCase().includes(q) || (e.cattle?.tag_id ?? "").toLowerCase().includes(q) || (e.notes ?? "").toLowerCase().includes(q));
  }, [filter, query, visible, overdue, today, upcoming]);

  function undoRemove(id: string) {
    setRemoved((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }
  function markDone(id: string) {
    setRemoved((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const res = await completeHealthEventHub(id);
      if (res?.error) { toast.error(res.error); undoRemove(id); } else toast.success(L("হয়ে গেছে হিসেবে রাখা হলো", "Marked as done"));
    });
  }
  function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    setRemoved((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const res = await deleteHealthEventHub(id);
      if (res?.error) { toast.error(res.error); undoRemove(id); } else toast.success(L("কাজটি মুছে ফেলা হলো", "Task deleted"));
    });
  }

  const tiles = [
    { label: L("সময় পেরিয়েছে", "Overdue"), value: overdue.length, icon: AlertTriangle, tone: "text-red-600 dark:text-red-400", alert: true },
    { label: L("আজ", "Today"), value: today.length, icon: Clock, tone: "text-blue-600 dark:text-blue-400" },
    { label: L("আগামী ৭ দিন", "Next 7 days"), value: upcoming.length, icon: Calendar, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: L("এই মাসে শেষ", "Done this month"), value: stats.completedThisMonth, icon: CheckCheck, tone: "text-primary" },
  ];
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: L("সব", "All"), count: visible.length },
    { id: "overdue", label: L("সময় পেরিয়েছে", "Overdue"), count: overdue.length },
    { id: "today", label: L("আজ", "Today"), count: today.length },
    { id: "upcoming", label: L("৭ দিনে", "Next 7 days"), count: upcoming.length },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <t.icon className={cn("h-4 w-4", t.tone)} />{t.label}
            </div>
            <p className={cn("mt-2 text-2xl font-bold tracking-tight", "alert" in t && t.value > 0 ? t.tone : "text-foreground")}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={cn("rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
                filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted")}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={L("ট্যাগ, টিকা বা নোট খুঁজুন…", "Search tag, vaccine, notes…")} value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" />
          </div>
          <Button size="sm" onClick={() => setDialog({ event: null })} className="h-8 shrink-0 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />{L("টিকা দিন", "Give vaccine")}
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-semibold text-foreground">{L("কোনো কাজ বাকি নেই", "Nothing waiting")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{L("সব কাজ হয়ে গেছে, বা এই ফিল্টারে কিছু নেই।", "Everything is done, or nothing matches this filter.")}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          {list.map((item) => {
            const isOverdue = item.scheduled_at < todayISO;
            const isToday = item.scheduled_at === todayISO;
            return (
              <div key={item.id} className={cn("flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center", isOverdue && "bg-red-50/30 dark:bg-red-950/10")}>
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 shrink-0 rounded-xl p-2.5",
                    isOverdue ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : isToday ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-muted text-muted-foreground")}>
                    <Syringe className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/cattle/${item.cattle_id}`} className="text-sm font-bold text-foreground hover:underline">#{item.cattle?.tag_id ?? "?"}</Link>
                      {item.cattle?.breed && <span className="text-xs text-muted-foreground">({item.cattle.breed})</span>}
                      <Badge variant={isOverdue ? "destructive" : isToday ? "default" : "secondary"} className="px-2 py-0.5 text-[10px]">
                        {isOverdue ? L("সময় পেরিয়েছে", "Overdue") : isToday ? L("আজ", "Today") : L("নির্ধারিত", "Scheduled")}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    {item.notes && <p className="line-clamp-1 text-xs text-muted-foreground">{item.notes}</p>}
                    <p className="font-mono text-[11px] text-muted-foreground">{L("তারিখ", "Due")}: {item.scheduled_at}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  <Button size="sm" variant="outline" onClick={() => setDialog({ event: item })} className="h-8 gap-1.5 text-xs">
                    <Syringe className="h-3.5 w-3.5 text-blue-600" />{L("বিস্তারিত লিখুন", "Record details")}
                  </Button>
                  <Button size="sm" onClick={() => markDone(item.id)} disabled={isPending} className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />{L("হয়ে গেছে", "Done")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingDelete(item.id)} aria-label={L("মুছুন", "Delete")} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <GiveVaccineDialog
          key={dialog.event?.id ?? "new"}
          event={dialog.event}
          allCattle={allCattle}
          stock={inventoryItems}
          todayISO={todayISO}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); router.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onCancel={() => setPendingDelete(null)}
        title={L("কাজটি মুছবেন?", "Delete this task?")}
        description={L("এটি স্বাস্থ্য তালিকা থেকে সরে যাবে (ট্র্যাশে থাকবে)।", "It will be removed from the health list.")}
        confirmLabel={L("মুছুন", "Delete")}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/** Record a vaccine for one animal (from a task) or several at once. */
function GiveVaccineDialog({ event, allCattle, stock, todayISO, onClose, onSaved }: {
  event: HubEventItem | null;
  allCattle: CattleLite[];
  stock: VaccineInventoryItem[];
  todayISO: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const L = useL();
  // state is set from the tapped task each time the dialog opens (keyed by the task)
  const [cattleIds, setCattleIds] = useState<string[]>(event ? [event.cattle_id] : []);
  const [name, setName] = useState(event?.title ?? "");
  const [givenAt, setGivenAt] = useState(todayISO);
  const [doseMl, setDoseMl] = useState("");
  const [givenBy, setGivenBy] = useState("");
  const [notes, setNotes] = useState("");
  const [stockItemId, setStockItemId] = useState("");
  const [stockQty, setStockQty] = useState("1");
  const [booster, setBooster] = useState("");
  const [saving, setSaving] = useState(false);
  const item = stock.find((s) => s.id === stockItemId);

  const toggle = (id: string) => setCattleIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error(L("টিকার নাম লিখুন", "Enter the vaccine name"));
    if (!cattleIds.length) return toast.error(L("অন্তত একটি গরু বাছুন", "Select at least one animal"));
    setSaving(true);
    const res = await giveVaccineAction({
      cattleIds, vaccineName: name, givenAt,
      doseMl: doseMl ? Number(doseMl) : null, givenBy, notes,
      scheduledEventId: event?.id ?? null,
      stockItemId: stockItemId || null, stockQtyPerAnimal: stockItemId ? Number(stockQty) || 0 : null,
      boosterDays: booster ? Number(booster) : null,
    });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success(L(`${res.count}টি গরুর টিকা লেখা হলো`, `Vaccine recorded for ${res.count} animal(s)`));
    onSaved();
  }

  const field = "w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[540px]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Syringe className="h-5 w-5 text-blue-600" />{L("টিকা দিন", "Give vaccine")}</DialogTitle>
            <DialogDescription className="text-xs">
              {L("যে কাজটি বাকি ছিল সেটিই \"হয়ে গেছে\" হবে — আলাদা কপি তৈরি হবে না।", "The waiting task is marked done — no second copy is created.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground"><Users className="mr-1 inline h-3.5 w-3.5" />{L(`গরু (${cattleIds.length}টি বাছাই)`, `Animals (${cattleIds.length} selected)`)}</label>
                {!event && (
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setCattleIds(allCattle.map((c) => c.id))}>{L(`সব (${allCattle.length})`, `All (${allCattle.length})`)}</Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground" onClick={() => setCattleIds([])}>{L("মুছুন", "Clear")}</Button>
                  </div>
                )}
              </div>
              <div className="grid max-h-36 grid-cols-3 gap-1.5 overflow-y-auto rounded-lg border bg-muted/20 p-2">
                {allCattle.map((c) => {
                  const on = cattleIds.includes(c.id);
                  return (
                    <label key={c.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded border p-1.5 text-xs", on ? "border-primary/40 bg-primary/10 font-semibold" : "bg-background")}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="rounded" />
                      <span className="truncate">#{c.tag_id}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{L("টিকার নাম", "Vaccine")}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={L("যেমন FMD টিকা", "e.g. FMD vaccine")} className="h-9 text-xs" required />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{L("তারিখ", "Date")}</label>
                <Input type="date" value={givenAt} max={todayISO} onChange={(e) => setGivenAt(e.target.value)} className="h-9 text-xs" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{L("ডোজ (ml, ঐচ্ছিক)", "Dose (ml, optional)")}</label>
                <Input type="number" step="0.1" min="0" value={doseMl} onChange={(e) => setDoseMl(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{L("কে দিয়েছেন (ঐচ্ছিক)", "Given by (optional)")}</label>
                <Input value={givenBy} onChange={(e) => setGivenBy(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
              <label className="font-semibold text-foreground">{L("স্টক থেকে কমবে (ঐচ্ছিক)", "Take from stock (optional)")}</label>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} className={field}>
                  <option value="">{L("স্টক থেকে কমাবেন না", "Don't reduce stock")}</option>
                  {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.qty} {s.unit})</option>)}
                </select>
                <Input type="number" step="0.01" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} disabled={!stockItemId} className="h-9 text-xs" aria-label={L("প্রতি গরু", "Per animal")} />
              </div>
              {item && (
                <p className="text-[11px] text-muted-foreground">
                  {L(`প্রতি গরু ${stockQty || 0} ${item.unit} × ${cattleIds.length} = মোট ${(Number(stockQty) || 0) * cattleIds.length} ${item.unit}`,
                    `${stockQty || 0} ${item.unit} per animal × ${cattleIds.length} = ${(Number(stockQty) || 0) * cattleIds.length} ${item.unit}`)}
                </p>
              )}
              {stock.length === 0 && <p className="text-[11px] text-muted-foreground">{L("স্টকে কোনো ওষুধ/টিকা নেই।", "No medicine or vaccine in stock.")}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{L("পরের ডোজ কত দিন পরে (ঐচ্ছিক)", "Next dose in days (optional)")}</label>
                <Input type="number" min="1" value={booster} onChange={(e) => setBooster(e.target.value)} placeholder={L("যেমন ২৮", "e.g. 28")} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{L("নোট (ঐচ্ছিক)", "Notes (optional)")}</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>{L("বাতিল", "Cancel")}</Button>
            <Button type="submit" size="sm" disabled={saving} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
              <Syringe className="h-3.5 w-3.5" />{saving ? L("সেভ হচ্ছে…", "Saving…") : L("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
