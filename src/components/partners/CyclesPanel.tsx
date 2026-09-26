"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck2, ChevronDown, ChevronRight, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { closeCycle, previewCycleClose, reopenLastCycle, type CyclePreview } from "@/app/dashboard/(app)/partners/actions";
import type { CycleResult } from "@/lib/partners/position";

interface Props {
  cycles: CycleResult[];
  notes: Record<string, string | null>;
  names: Record<string, string>;
  openCycleFrom: string | null;
  openRealized: number;
  estimate: number;
  today: string;
  enabled: boolean;
  canManage: boolean;
}

const taka = (n: number) => `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const signed = (n: number) => (Math.round(n) === 0 ? "৳0" : `${n > 0 ? "+" : "−"}${taka(n)}`);
const tone = (n: number) => (Math.round(n) > 0 ? "text-emerald-600 dark:text-emerald-400" : Math.round(n) < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground");

/**
 * Settlement cycles: the owner closes a cycle on a date of their choice. Everything that became
 * final by then is settled on its net and does not change; animals still on the farm roll over.
 */
export function CyclesPanel({ cycles, notes, names, openCycleFrom, openRealized, estimate, today, enabled, canManage }: Props) {
  const L = useL();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<CyclePreview | null>(null);
  const [showId, setShowId] = useState<string | null>(null);
  const minDate = openCycleFrom ?? "2000-01-01";
  const list = [...cycles].reverse();

  function look() {
    start(async () => {
      const res = await previewCycleClose(date);
      if (res.error) { toast.error(res.error); setPreview(null); return; }
      setPreview(res.preview ?? null);
    });
  }
  function close() {
    start(async () => {
      const res = await closeCycle(date, note);
      if (res.error) { toast.error(res.error); return; }
      toast.success(L(`চক্র ${date}-এ বন্ধ হলো`, `Cycle closed on ${date}`));
      setOpen(false); setPreview(null); setNote(""); router.refresh();
    });
  }
  function reopen() {
    start(async () => {
      const res = await reopenLastCycle();
      if (res.error) toast.error(res.error); else { toast.success(L("শেষ চক্র আবার খোলা হলো", "Last cycle reopened")); router.refresh(); }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-card" aria-label={L("হিসাবের চক্র", "Cycles")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck2 className="h-4 w-4 text-muted-foreground" />{L("হিসাবের চক্র", "Cycles")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {L("চক্র বন্ধ করলে ওই দিন পর্যন্ত বিক্রি বা মারা যাওয়া সব গরুর লাভ-ক্ষতি মিলিয়ে (নিট) ভাগ হয় আর স্থায়ী হয়; হিসাব ওই দিন পর্যন্ত বন্ধ হয়। খামারে থাকা গরু পরের চক্রে যায়।",
               "Closing a cycle settles the net result of every animal sold or dead up to that day, for good; the books are locked to that day. Animals still on the farm roll into the next cycle.")}
          </p>
        </div>
        {enabled && canManage && !open && (
          <Button size="sm" onClick={() => { setOpen(true); setDate(today < minDate ? minDate : today); }}>{L("চক্র বন্ধ করুন", "Close a cycle")}</Button>
        )}
      </div>

      {!enabled && (
        <p className="px-5 py-3 text-xs text-amber-700 dark:text-amber-400">
          {L("চক্র চালু হবে database আপডেটের পরে (migration 20260927100000)।", "Cycles start after the database update (migration 20260927100000).")}
        </p>
      )}

      {/* the open cycle */}
      <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{L("চলতি চক্র", "Open cycle")}</p>
          <p className="font-semibold">{openCycleFrom ? L(`${openCycleFrom} থেকে`, `from ${openCycleFrom}`) : L("শুরু থেকে", "since the start")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{L("এই চক্রে পাকা ফল", "Final so far")}</p>
          <p className={cn("font-semibold tabular-nums", tone(openRealized))}>{signed(openRealized)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{L("খামারের গরু আজ বিক্রি করলে", "Animals on the farm, if sold today")}</p>
          <p className={cn("font-semibold tabular-nums", tone(estimate))}>{signed(estimate)} <span className="text-[11px] font-normal text-muted-foreground">{L("আনুমানিক", "estimate")}</span></p>
        </div>
      </div>

      {/* close form */}
      {open && (
        <div className="space-y-3 border-t border-border/60 bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-date">{L("কোন দিন পর্যন্ত", "Up to which day")}</Label>
              <Input id="cycle-date" type="date" min={minDate} max={today} value={date} onChange={(e) => { setDate(e.target.value); setPreview(null); }} className="w-44" />
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label htmlFor="cycle-note">{L("নোট (ঐচ্ছিক)", "Note (optional)")}</Label>
              <Input id="cycle-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={L("যেমন: কোরবানি ২০২৬", "e.g. Eid 2026")} />
            </div>
            <Button variant="outline" onClick={look} disabled={pending}>{pending && !preview ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{L("হিসাব দেখুন", "See the result")}</Button>
          </div>

          {preview && (
            <div className="rounded-lg border bg-card px-4 py-3 text-sm">
              <p className="font-medium">
                {L(`${preview.from ? `${preview.from} থেকে ` : ""}${preview.closedOn} পর্যন্ত: ${preview.items}টি পাকা ফল, নিট `, `${preview.from ? `${preview.from} – ` : "Up to "}${preview.closedOn}: ${preview.items} final result(s), net `)}
                <span className={tone(preview.net)}>{signed(preview.net)}</span>
                {preview.fee > 0 && L(` (ফি ${taka(preview.fee)})`, ` (fee ${taka(preview.fee)})`)}
              </p>
              {preview.items === 0 && <p className="mt-1 text-xs text-muted-foreground">{L("এই সময়ে কোনো গরু বিক্রি বা মারা যায়নি — চক্রে ভাগ করার মতো কিছু নেই।", "No animal was sold or died in this period — nothing to settle.")}</p>}
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                {preview.shares.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3"><span>{s.name}</span><span className={cn("tabular-nums", tone(s.amount))}>{signed(s.amount)}</span></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {L(`${preview.stillOnFarm}টি গরু পরের চক্রে যাবে। বন্ধ করলে ${preview.closedOn} পর্যন্ত হিসাব lock হবে — সেই দিন বা আগের তারিখে আর কিছু লেখা যাবে না।`,
                   `${preview.stillOnFarm} animal(s) roll into the next cycle. Closing locks the books up to ${preview.closedOn} — nothing can be entered on or before it.`)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setPreview(null); }} disabled={pending}>{L("বাতিল", "Cancel")}</Button>
            <Button onClick={close} disabled={pending || !preview}>{L("চক্র বন্ধ করুন", "Close the cycle")}</Button>
          </div>
        </div>
      )}

      {/* closed cycles */}
      {list.length > 0 && (
        <ol className="divide-y divide-border/50 border-t border-border/60">
          {list.map((c, i) => (
            <li key={c.id}>
              <button type="button" onClick={() => setShowId(showId === c.id ? null : c.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left text-sm hover:bg-muted/30">
                <span className="flex items-center gap-1.5 font-medium">
                  {showId === c.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {L(`${c.from ? `${c.from} – ` : "শুরু – "}${c.closedOn}`, `${c.from ? `${c.from} – ` : "Start – "}${c.closedOn}`)}
                  {notes[c.id] && <span className="font-normal text-muted-foreground">· {notes[c.id]}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{L(`${c.items}টি ফল`, `${c.items} result(s)`)} · <span className={cn("font-semibold", tone(c.net))}>{signed(c.net)}</span></span>
              </button>
              {showId === c.id && (
                <div className="px-5 pb-3">
                  <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    {Object.entries(c.shares).filter(([, v]) => Math.abs(v) >= 0.01).map(([id, v]) => (
                      <li key={id} className="flex justify-between gap-3"><span>{names[id] ?? "—"}</span><span className={cn("tabular-nums", tone(v))}>{signed(v)}</span></li>
                    ))}
                  </ul>
                  {i === 0 && canManage && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={reopen} className="mt-2 gap-1.5 text-xs"><Undo2 className="h-3.5 w-3.5" />{L("এই চক্র আবার খুলুন", "Reopen this cycle")}</Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
