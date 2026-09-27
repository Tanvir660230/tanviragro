"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markAsDeceased } from "@/app/dashboard/(app)/cattle/actions";
import { todayDhaka } from "@/lib/dates";
import { CATTLE_TEXT, fillC, type CattleLang } from "./cattle-view-text";

/**
 * The one "mark dead" form (a card, a table row or several selected): the date it died and the
 * cause — saved as its death record, so the feed split, Money and partners use that day.
 */
export function DeathDialog({ animals, lang, onClose, onDone }: {
  animals: { id: string; tag: string }[];
  lang: CattleLang;
  onClose: () => void;
  onDone?: () => void;
}) {
  const t = CATTLE_TEXT[lang];
  const router = useRouter();
  const today = todayDhaka();
  const [date, setDate] = useState(today);
  const [cause, setCause] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const many = animals.length > 1;

  const submit = () => start(async () => {
    const failed: string[] = [];
    let done = 0;
    for (const a of animals) {
      const res = await markAsDeceased(a.id, { date, cause, notes }).catch(() => ({ error: t.failed }));
      if (res?.error) failed.push(`${a.tag}: ${res.error}`); else done++;
    }
    if (done) toast.success(fillC(t.d_ok, { n: done }));
    if (failed.length) toast.error(fillC(t.d_failed, { n: failed.length }), { description: failed.join("\n") });
    router.refresh();
    if (!failed.length) { onDone?.(); onClose(); }
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{many ? fillC(t.d_title_many, { n: animals.length }) : `${t.d_title} · ${animals[0]?.tag ?? ""}`}</DialogTitle>
          <DialogDescription>{t.d_note}</DialogDescription>
        </DialogHeader>
        {many && <p className="line-clamp-2 text-sm text-muted-foreground">{animals.map((a) => a.tag).join(", ")}</p>}
        <div className="space-y-3">
          <label className="grid gap-1 text-sm font-medium">{t.d_date} *
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </label>
          <div className="grid gap-1.5 text-sm font-medium">
            {t.d_cause}
            <div className="flex flex-wrap gap-1.5">
              {t.causes.map((c) => (
                <button key={c} type="button" onClick={() => setCause(c)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${cause === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {c}
                </button>
              ))}
            </div>
            <input value={cause} onChange={(e) => setCause(e.target.value)} placeholder={t.d_cause_ph} maxLength={200}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
          </div>
          <label className="grid gap-1 text-sm font-medium">{t.d_notes}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t.cancel}</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || !date}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.d_go}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
