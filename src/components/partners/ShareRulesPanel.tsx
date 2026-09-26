"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, History, Loader2, LogOut, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { deleteShareRule, retirePartner, saveShareRule } from "@/app/dashboard/(app)/partners/actions";
import { checkRule, termsOn, type PositionPartner, type ShareRule } from "@/lib/partners/position";

export type RuleRow = ShareRule & { id: string; note: string | null };

interface Props {
  partner: PositionPartner;
  partners: PositionPartner[];
  rules: RuleRow[];
  today: string;
  lockedUntil: string | null;
  rulesEnabled: boolean;
  canManage: boolean;
}

const addDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/**
 * A partner's share over time: every rule with the day it starts, and a form to change it from
 * any date (not inside locked books). Checked here and again on the server.
 */
export function ShareRulesPanel({ partner, partners, rules, today, lockedUntil, rulesEnabled, canManage }: Props) {
  const L = useL();
  const router = useRouter();
  const [pending, start] = useTransition();
  const mine = useMemo(() => rules.filter((r) => r.partnerId === partner.id).sort((a, b) => a.from.localeCompare(b.from)), [rules, partner.id]);
  const nowTerms = termsOn(partners, rules, today)[partner.id];
  const current = mine.filter((r) => r.from <= today).at(-1);
  const minDate = [partner.joinedAt, lockedUntil ? addDay(lockedUntil) : ""].sort().at(-1)!;
  const isLabor = partner.partnerType === "labor";

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today < minDate ? minDate : today);
  const [mode, setMode] = useState<"auto" | "manual">(nowTerms?.shareMode ?? "auto");
  const [pct, setPct] = useState(String(nowTerms?.fixedPct ?? 0));
  const [bearsLoss, setBearsLoss] = useState(isLabor ? false : nowTerms?.bearsLoss ?? true);
  const [note, setNote] = useState("");
  const [leaveOn, setLeaveOn] = useState(today < minDate ? minDate : today);

  const planned: ShareRule = { partnerId: partner.id, from, shareMode: mode, fixedPct: mode === "manual" ? Number(pct) || 0 : 0, bearsLoss: isLabor ? false : bearsLoss };
  const problem = from < minDate
    ? (lockedUntil && from <= lockedUntil ? L(`হিসাব ${lockedUntil} পর্যন্ত বন্ধ — এর পরের তারিখ দিন।`, `Books are locked up to ${lockedUntil} — pick a later date.`) : L(`যোগ দিয়েছেন ${partner.joinedAt}-এ — এর আগে নয়।`, `Joined on ${partner.joinedAt} — not before.`))
    : checkRule(partners, rules, planned);
  const nextRule = mine.find((r) => r.from > from);
  const describe = (r: Pick<ShareRule, "shareMode" | "fixedPct" | "bearsLoss">) =>
    `${r.shareMode === "manual" ? L(`লাভের নির্দিষ্ট ${r.fixedPct}%`, `fixed ${r.fixedPct}% of profit`) : L("টাকা × দিন অনুপাতে", "by taka × days")} · ${r.bearsLoss ? L("ক্ষতির ভাগ আছে", "bears loss") : L("ক্ষতির ভাগ নেই", "no loss")}`;

  function save() {
    start(async () => {
      const res = await saveShareRule({ partnerId: partner.id, effectiveFrom: from, shareMode: mode, fixedPct: Number(pct) || 0, bearsLoss, note });
      if (res.error) { toast.error(res.error); return; }
      toast.success(L(`নিয়ম সেভ হলো — ${from} থেকে`, `Rule saved — from ${from}`));
      setOpen(false); setNote(""); router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteShareRule(id);
      if (res.error) toast.error(res.error); else { toast.success(L("নিয়ম মোছা হলো", "Rule removed")); router.refresh(); }
    });
  }
  function retire(date: string | null) {
    start(async () => {
      const res = await retirePartner(partner.id, date);
      if (res.error) toast.error(res.error); else { toast.success(date ? L(`${date} থেকে অবসর`, `Retired from ${date}`) : L("আবার সক্রিয়", "Active again")); router.refresh(); }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-card" aria-label={L("ভাগের নিয়ম", "Share rules")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-muted-foreground" />{L("ভাগের নিয়ম", "Share rules")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {L("প্রতিটি নিয়ম তার তারিখ থেকে পরের নিয়ম পর্যন্ত চলে। আগের দিনগুলো আগের নিয়মেই থাকে।", "Each rule runs from its date until the next one. Earlier days keep the earlier rule.")}
          </p>
        </div>
        {canManage && rulesEnabled && !open && (
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" />{L("ভাগ বদলান", "Change share")}</Button>
        )}
      </div>

      {!rulesEnabled && (
        <p className="px-5 py-3 text-xs text-amber-700 dark:text-amber-400">
          {L("তারিখসহ ভাগের নিয়ম চালু হবে database আপডেটের পরে (migration 20260927090000)। এখন অংশীদারের বর্তমান সেটিং ব্যবহার হচ্ছে।",
             "Dated share rules start after the database update (migration 20260927090000). The partner's current setting is used meanwhile.")}
        </p>
      )}

      {/* ── history ── */}
      {mine.length > 0 && (
        <ol className="divide-y divide-border/50">
          {mine.map((r) => {
            const isCurrent = r.id === current?.id;
            const future = r.from > today;
            const locked = !!lockedUntil && r.from <= lockedUntil;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {L(`${r.from} থেকে`, `From ${r.from}`)}
                    {isCurrent && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-px text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{L("চলছে", "in force")}</span>}
                    {future && <span className="ml-2 rounded-full bg-sky-100 px-2 py-px text-[11px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">{L("আসছে", "upcoming")}</span>}
                    {locked && <span className="ml-2 rounded-full bg-muted px-2 py-px text-[11px] text-muted-foreground">{L("বন্ধ হিসাব", "locked")}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{describe(r)}{r.note ? ` · ${r.note}` : ""}</p>
                </div>
                {canManage && rulesEnabled && r.id !== mine[0].id && !locked && (
                  <button type="button" disabled={pending} onClick={() => remove(r.id)} title={L("মুছুন", "Remove")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* ── change form ── */}
      {open && (
        <div className="space-y-4 border-t border-border/60 bg-muted/20 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-from">{L("কবে থেকে", "Starts on")}</Label>
              <Input id="rule-from" type="date" min={minDate} value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
              <p className="text-[11px] text-muted-foreground">{L("আগের, আজকের বা সামনের তারিখ — যেকোনোটা।", "A past, today's or a future date.")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{L("লাভের ভাগ কীভাবে", "Profit share")}</Label>
              <div className="flex gap-2">
                {(["manual", "auto"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium", mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                    {m === "manual" ? L("নির্দিষ্ট %", "Fixed %") : L("টাকা × দিন", "Taka × days")}
                  </button>
                ))}
              </div>
            </div>
            {mode === "manual" && (
              <div className="space-y-1.5">
                <Label htmlFor="rule-pct">{L("লাভের কত %", "Percent of profit")}</Label>
                <Input id="rule-pct" type="number" min={0} max={100} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} className="w-32" />
              </div>
            )}
            {!isLabor && (
              <label className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 sm:self-end">
                <span className="text-sm">{L("ক্ষতির ভাগ নেবেন", "Bears loss")}</span>
                <input type="checkbox" checked={bearsLoss} onChange={(e) => setBearsLoss(e.target.checked)} className="h-5 w-5" />
              </label>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rule-note">{L("কারণ / নোট (ঐচ্ছিক)", "Reason / note (optional)")}</Label>
              <Textarea id="rule-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <div className={cn("rounded-lg px-3 py-2.5 text-xs leading-relaxed", problem ? "bg-destructive/10 text-destructive" : "bg-primary/[0.06] text-foreground")}>
            {problem ?? (
              <>
                <p className="font-medium">{L(`${from} থেকে ${nextRule ? `${nextRule.from}-এর আগ পর্যন্ত` : "পরবর্তী বদল পর্যন্ত"}: ${describe(planned)}।`,
                  `From ${from} ${nextRule ? `until ${nextRule.from}` : "until the next change"}: ${describe(planned)}.`)}</p>
                <p className="mt-1 text-muted-foreground">
                  {L(`${from}-এর আগের দিনগুলো আগের নিয়মেই থাকবে। যে গরু এই তারিখের আগে কেনা আর পরে বিক্রি হবে, তার লাভ-ক্ষতি দিন হিসেবে ভাগ হবে — আগের দিনগুলো আগের নিয়মে, পরের দিনগুলো নতুন নিয়মে।`,
                     `Days before ${from} keep the earlier rule. An animal bought before this date and sold after it is split by days — the days before at the earlier rule, the days after at the new one.`)}
                  {mode === "manual" && L(" বাকি লাভ অন্য মূলধনীরা টাকা × দিন অনুপাতে পাবেন।", " The rest of the profit goes to the other money partners by taka × days.")}
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>{L("বাতিল", "Cancel")}</Button>
            <Button onClick={save} disabled={pending || !!problem}>
              {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{L("নিয়ম সেভ করুন", "Save rule")}
            </Button>
          </div>
        </div>
      )}

      {/* ── leaving ── */}
      {canManage && rulesEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-3 text-xs">
          {partner.leftAt ? (
            <>
              <span className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{L(`${partner.leftAt} থেকে অবসর — এর পরে কোনো ভাগ নেই, আগের হিসাব থাকছে।`, `Retired from ${partner.leftAt} — no share after it; the history stays.`)}</span>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => retire(null)} className="gap-1.5"><Undo2 className="h-3.5 w-3.5" />{L("আবার সক্রিয় করুন", "Make active again")}</Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">{L("অংশীদার চলে গেলে মুছবেন না — অবসর দিন। আগের ভাগ ঠিক থাকে; টাকা ফেরত দিলে \"তোলা\" হিসেবে লিখুন।",
                "When a partner leaves, do not delete — retire them. Past shares stay right; record any money returned as a withdrawal.")}</span>
              <div className="flex items-center gap-2">
                <Input type="date" min={minDate} value={leaveOn} onChange={(e) => setLeaveOn(e.target.value)} className="h-8 w-40" aria-label={L("অবসরের তারিখ", "Retirement date")} />
                <Button size="sm" variant="outline" disabled={pending || leaveOn < minDate} onClick={() => retire(leaveOn)} className="gap-1.5"><LogOut className="h-3.5 w-3.5" />{L("অবসর দিন", "Retire")}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
