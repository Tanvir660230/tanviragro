"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { revertSaleGroup } from "@/app/dashboard/(app)/cattle/group-actions";
import { revertSale } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { GROUP_TEXT, fillG, type GroupLang } from "./group-text";

const TEXT = {
  en: { undo: "Undo sale", q: "Undo the sale of {tag}?", note: "It goes back on the farm and its cancelled health tasks come back.", ok: "Sale undone — {tag} is back on the farm", failed: "Something went wrong — nothing changed" },
  bn: { undo: "বিক্রি বাতিল", q: "{tag}-এর বিক্রি বাতিল করবেন?", note: "গরুটি খামারে ফিরবে, বাতিল হওয়া স্বাস্থ্য কাজও ফিরবে।", ok: "বিক্রি বাতিল — {tag} খামারে ফিরল", failed: "সমস্যা হয়েছে — কিছু বদলায়নি" },
} as const;

/**
 * Undo a sale from the animal's page. A sale of several at one price is undone whole
 * (one animal alone would leave the others' shares wrong); a sale recorded before sale
 * groups existed is undone on its own. A locked accounting period refuses both (server).
 */
export function UndoSaleControl({ cattleId, tag, groupId, tags, lang }: {
  cattleId: string; tag: string; groupId: string | null; tags: string[]; lang: GroupLang;
}) {
  const t = TEXT[lang];
  const g = GROUP_TEXT[lang];
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const many = tags.length > 1;

  const undo = () => start(async () => {
    const res = groupId
      ? await revertSaleGroup(groupId).then((r) => (r.ok ? null : r.error)).catch(() => t.failed)
      : await revertSale(cattleId).then((r) => r.error ?? null).catch(() => t.failed);
    if (res) { toast.error(res); return; }
    toast.success(many ? fillG(g.ok_undo, { n: tags.length }) : fillG(t.ok, { tag }));
    setAsk(false);
    router.refresh();
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAsk(true)}>
        <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />{many ? g.undo_group : t.undo}
      </Button>
      {ask && (
        <Dialog open onOpenChange={(o) => { if (!o && !pending) setAsk(false); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-6">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                {many ? fillG(g.undo_group_q, { n: tags.length }) : fillG(t.q, { tag })}
              </DialogTitle>
              <DialogDescription>{many ? `${g.undo_group_note} (${tags.join(", ")})` : t.note}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAsk(false)} disabled={pending}>{g.cancel}</Button>
              <Button variant="destructive" onClick={undo} disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{many ? g.undo_group : t.undo}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
