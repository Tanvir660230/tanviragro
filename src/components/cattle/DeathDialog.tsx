"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Skull, ShieldX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markAsDeceased } from "@/app/dashboard/(app)/cattle/actions";
import { todayDhaka } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CATTLE_TEXT, fillC, type CattleLang } from "./cattle-view-text";

/**
 * The one "left without a sale" form (a card, a table row, several selected, the profile):
 * died, or stolen / went missing — with the date and the cause or details. Both are saved as
 * the animal's dated record, so the feed split, Money and partners use that day, and both
 * count its cost as a loss.
 */
export function DeathDialog({ animals, lang, onClose, onDone, initialKind = "dead" }: {
  animals: { id: string; tag: string }[];
  lang: CattleLang;
  onClose: () => void;
  onDone?: () => void;
  initialKind?: "dead" | "stolen";
}) {
  const t = CATTLE_TEXT[lang];
  const router = useRouter();
  const today = todayDhaka();
  const [kind, setKind] = useState<"dead" | "stolen">(initialKind);
  const [date, setDate] = useState(today);
  const [cause, setCause] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const many = animals.length > 1;
  const stolen = kind === "stolen";

  const submit = () => start(async () => {
    const failed: string[] = [];
    let done = 0;
    for (const a of animals) {
      const res = await markAsDeceased(a.id, { kind, date, cause, notes }).catch(() => ({ error: t.failed }));
      if (res?.error) failed.push(`${a.tag}: ${res.error}`); else done++;
    }
    if (done) toast.success(fillC(stolen ? t.s_ok : t.d_ok, { n: done }));
    if (failed.length) toast.error(fillC(t.d_failed, { n: failed.length }), { description: failed.join("\n") });
    router.refresh();
    if (!failed.length) { onDone?.(); onClose(); }
  });

  const title = stolen
    ? (many ? fillC(t.s_title_many, { n: animals.length }) : `${t.s_title} · ${animals[0]?.tag ?? ""}`)
    : (many ? fillC(t.d_title_many, { n: animals.length }) : `${t.d_title} · ${animals[0]?.tag ?? ""}`);

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{title}</DialogTitle>
          <DialogDescription>{stolen ? t.s_note : t.d_note}</DialogDescription>
        </DialogHeader>
        {many && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{animals.map((a) => a.tag).join(", ")}</p>}

        {/* what happened */}
        <div role="radiogroup" aria-label={t.m_dead_or} className="grid grid-cols-2 gap-2">
          {([["dead", t.k_dead, Skull], ["stolen", t.k_stolen, ShieldX]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-medium",
                kind === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 truncate">{label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <label className="grid gap-1 text-sm font-medium">{stolen ? t.s_date : t.d_date} *
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required
              className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm" />
          </label>
          <div className="grid gap-1.5 text-sm font-medium">
            {stolen ? t.s_details : t.d_cause}
            {!stolen && (
              <div className="flex flex-wrap gap-1.5">
                {t.causes.map((c) => (
                  <button key={c} type="button" onClick={() => setCause(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${cause === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <input value={cause} onChange={(e) => setCause(e.target.value)} placeholder={stolen ? t.s_details_ph : t.d_cause_ph} maxLength={200}
              className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
          </div>
          <label className="grid gap-1 text-sm font-medium">{t.d_notes}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
              className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t.cancel}</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || !date}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{stolen ? t.s_go : t.d_go}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
