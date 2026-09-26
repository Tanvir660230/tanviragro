"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, Beef, ChevronDown, ChevronRight, Info, Scale, Sparkles, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Partner } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import { useL } from "@/i18n/text";
import { todayDhaka } from "@/lib/dates";
import { avatarColor, initials } from "@/lib/partners/calculations";
import { partnerTypeLabel } from "@/lib/partners/labels";
import type { FarmPosition, PartnerPosition } from "@/lib/partners/position";
import { EmptyState } from "./partner-ui";
import { AddPartnerDialog } from "./modals/AddPartnerDialog";
import { AddTransactionDialog } from "./modals/AddTransactionDialog";
import { DeclareDistributionModal } from "./modals/DeclareDistributionModal";
import { CyclesPanel } from "./CyclesPanel";
import { AnimalResultsTable } from "./AnimalResultsTable";

// ── formatting ────────────────────────────────────────────────────────────────
const taka = (n: number) => `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const signed = (n: number) => (Math.round(n) === 0 ? "৳0" : `${n > 0 ? "+" : "−"}${taka(n)}`);
const tone = (n: number) => (Math.round(n) > 0 ? "text-emerald-600 dark:text-emerald-400" : Math.round(n) < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground");
const pct = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;

interface Props {
  farm: FarmPosition;
  positions: PartnerPosition[];
  partners: Partner[];
  /** the farm's cash now (the entry form checks withdrawals against it) */
  cash: number;
  /** migration 20260927100000: cycles, advances, partner loans */
  cyclesEnabled: boolean;
  cycleNotes: Record<string, string | null>;
  canManage: boolean;
}

export function PartnerDashboard({ farm, positions, partners, cash, cyclesEnabled, cycleNotes, canManage }: Props) {
  const feePct = farm.feePctToday;
  const L = useL();
  const { t, locale } = useTranslation();
  const today = todayDhaka();
  const [distOpen, setDistOpen] = useState(false);
  const [showAnimals, setShowAnimals] = useState(false);

  const sold = farm.animals.filter((a) => a.status !== "active");
  const onFarm = farm.animals.filter((a) => a.status === "active");
  const netCapital = farm.capitalIn - farm.capitalOut;
  const distributable = positions.reduce((s, p) => s + p.distributable, 0);
  const current = positions.filter((p) => p.terms.active);
  const former = positions.filter((p) => !p.terms.active);
  const fixed = current.filter((p) => p.terms.shareMode === "manual");
  const noLoss = current.filter((p) => !p.terms.bearsLoss);
  const upcoming = positions.filter((p) => p.nextChange);

  return (
    <div className="space-y-5">
      {/* ── actions ── */}
      <div className="flex flex-wrap gap-2">
        <AddPartnerDialog today={today} t={t} />
        {partners.length > 0 && <AddTransactionDialog partners={partners} positions={positions} cash={cash} today={today} t={t} moneyTypesEnabled={cyclesEnabled} />}
        {distributable > 0.5 && (
          <Button variant="outline" onClick={() => setDistOpen(true)} className="gap-1.5">
            <Banknote className="h-4 w-4" />{L(`লাভ বণ্টন (${taka(distributable)})`, `Pay out profit (${taka(distributable)})`)}
          </Button>
        )}
      </div>

      {partners.length === 0 ? <EmptyState t={t} /> : (
        <>
          {/* ── 1. the farm's position ── */}
          <section className="rounded-xl border border-border bg-card shadow-card" aria-label={L("খামারের অবস্থা", "Farm position")}>
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">{L("খামারের অবস্থা আজ", "The farm today")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sold.length === 0
                  ? L("এখনো কোনো গরু বিক্রি হয়নি — তাই পাকা লাভ বা ক্ষতি কিছুই নেই। খাবার, মজুরি, বিদ্যুৎ সবই গরুর খরচের অংশ, ক্ষতি নয়।",
                      "No animal has been sold yet — so there is no final profit or loss. Feed, wages and electricity are part of what the cattle cost, not a loss.")
                  : L(`${sold.length}টি গরু খামার ছেড়েছে; সেগুলোর ফল পাকা।`, `${sold.length} animal(s) have left the farm; their result is final.`)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
              <Tile icon={Users} label={L("খাটানো মূলধন", "Capital in the farm")} value={taka(netCapital)}
                note={L(`${positions.filter((p) => p.netCapital > 0).length} জনের জমা − তোলা`, `${positions.filter((p) => p.netCapital > 0).length} partners, in − out`)} />
              <Tile icon={Beef} label={L("গরুর মোট খরচ", "Cattle full cost")} value={taka(farm.herdCost)}
                note={L(`${onFarm.length}টি গরু · কেনা + খাবার + ডাক্তার + চলতি খরচ`, `${onFarm.length} head · bought + feed + vet + running costs`)} />
              <Tile icon={Scale} label={L("গরুর আজকের দাম", "Cattle value today")} value={taka(farm.herdValue)}
                note={farm.marketPricePerKg ? L(`ওজন × ৳${farm.marketPricePerKg}/কেজি (আনুমানিক)`, `weight × ৳${farm.marketPricePerKg}/kg (estimate)`) : L("বাজারদর নেই — খরচ ধরা হয়েছে", "no market price — counted at cost")} />
              <Tile icon={farm.total >= 0 ? TrendingUp : TrendingDown} label={L("আজ বিক্রি করলে ফল", "Result if sold today")} value={signed(farm.total)} valueCls={tone(farm.total)}
                note={L(`পাকা ${signed(farm.realized)} · আনুমানিক ${signed(farm.estimate)}${farm.marketPricePerKg ? ` · দাম ±১০% হলে ${signed(farm.realized + farm.estimateRange.low)} থেকে ${signed(farm.realized + farm.estimateRange.high)}` : ""}`,
                         `final ${signed(farm.realized)} · estimate ${signed(farm.estimate)}${farm.marketPricePerKg ? ` · at price ±10%: ${signed(farm.realized + farm.estimateRange.low)} to ${signed(farm.realized + farm.estimateRange.high)}` : ""}`)} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-2.5 text-xs text-muted-foreground">
              <span>{L(`চলতি খরচ মোট ${taka(farm.runningCosts)} — প্রতি গরু প্রতি দিন ${taka(farm.costPerHeadDay)}, যত দিন খামারে তত ভাগ`,
                       `Running costs ${taka(farm.runningCosts)} in all — ${taka(farm.costPerHeadDay)} per head per day, by days on the farm`)}</span>
              <button type="button" onClick={() => setShowAnimals((v) => !v)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {showAnimals ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{L("প্রতিটি গরুর হিসাব", "Each animal")}
              </button>
            </div>
            {showAnimals && <AnimalResultsTable animals={farm.animals} />}
          </section>

          {/* ── cycles ── */}
          <CyclesPanel cycles={farm.cycles} notes={cycleNotes} names={Object.fromEntries(positions.map((p) => [p.id, p.name]))}
            openCycleFrom={farm.openCycleFrom} openRealized={farm.openRealized} estimate={farm.estimate} today={today} enabled={cyclesEnabled} canManage={canManage} />

          {/* ── 2. how it is split ── */}
          <section className="rounded-xl border border-primary/20 bg-primary/[0.03] px-5 py-4 text-sm" aria-label={L("ভাগের নিয়ম", "How it is split")}>
            <p className="flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4 text-primary" aria-hidden />{L("ভাগের নিয়ম", "How it is split")}</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {feePct > 0 && <li>• {L(`লাভ থেকে আগে ${feePct}% ম্যানেজমেন্ট ফি।`, `A ${feePct}% management fee comes off profit first.`)}</li>}
              {fixed.map((p) => <li key={p.id}>• {L(`${p.name} লাভের নির্দিষ্ট ${pct(p.terms.fixedPct)} পান${p.terms.bearsLoss ? "" : ", ক্ষতির ভাগ নেই"}।`, `${p.name} takes a fixed ${pct(p.terms.fixedPct)} of profit${p.terms.bearsLoss ? "" : " and bears no loss"}.`)}</li>)}
              <li>• {L("বাকি লাভ মূলধনীদের মধ্যে টাকা × দিন অনুপাতে — যার টাকা যত বেশি দিন খামারে, তার ভাগ তত বেশি। পরে যোগ দিলে, টাকা আসার দিন থেকে ভাগ শুরু।",
                       "The rest of the profit goes to the money partners by taka × days — money in the farm longer earns more; a later partner shares from the day their money came in.")}</li>
              <li>• {L(`ক্ষতি হলে পুরো ক্ষতি বহন করেন ক্ষতির ভাগীদাররা, একই টাকা × দিন অনুপাতে${noLoss.length ? ` (${noLoss.map((p) => p.name).join(", ")} ক্ষতি বহন করেন না)` : ""}।`,
                       `A loss is carried in full by the partners who bear loss, by the same taka × days${noLoss.length ? ` (${noLoss.map((p) => p.name).join(", ")} bear no loss)` : ""}.`)}</li>
              <li>• {L("বিক্রি হওয়া গরুর লাভ পাকা — শুধু সেটাই বণ্টন করা যায়। খামারে থাকা গরুর ফল আনুমানিক, বাজারদর ও ওজনের সাথে বদলায়।",
                       "Profit from animals sold is final — only that can be paid out. The result on animals still on the farm is an estimate and moves with price and weight.")}</li>
              <li>• {L("নিয়ম বদলালে (যেমন ৫০% → ৪০%) বদলের তারিখের আগের দিনগুলো আগের নিয়মে, পরের দিনগুলো নতুন নিয়মে ভাগ হয় — অংশীদারের প্রোফাইলে “ভাগের নিয়ম”।",
                       "When a rule changes (e.g. 50% → 40%) the days before the change keep the old rule and the days after use the new one — “Share rules” on the partner's profile.")}</li>
              {upcoming.map((p) => p.nextChange && (
                <li key={`next-${p.id}`} className="font-medium text-sky-700 dark:text-sky-400">• {L(
                  `${p.name}: ${p.nextChange.from} থেকে ${p.nextChange.shareMode === "manual" ? `লাভের ${pct(p.nextChange.fixedPct)}` : "টাকা × দিন"}${p.nextChange.bearsLoss ? "" : ", ক্ষতির ভাগ নেই"}।`,
                  `${p.name}: from ${p.nextChange.from} ${p.nextChange.shareMode === "manual" ? `${pct(p.nextChange.fixedPct)} of profit` : "taka × days"}${p.nextChange.bearsLoss ? "" : ", no loss"}.`)}</li>
              ))}
            </ul>
          </section>

          {/* ── 3. each partner ── */}
          <section className="rounded-xl border border-border bg-card shadow-card" aria-label={L("অংশীদারদের হিসাব", "Partners")}>
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">{L("অংশীদারদের হিসাব", "Partners")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{L("আজ সব গরু বাজারদরে বিক্রি হলে কে কত পেতেন", "What each would have if every animal were sold today")}</p>
            </div>
            <ul className="divide-y divide-border/60">
              {[...current, ...former].map((p, i) => {
                const share = p.realizedShare + p.estimateShare;
                return (
                  <li key={p.id}>
                    {i === current.length && former.length > 0 && (
                      <p className="bg-muted/40 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{L("আগের অংশীদার (অবসর)", "Former partners (retired)")}</p>
                    )}
                    <Link href={`/dashboard/partners/${p.id}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white", avatarColor(p.name))}>{initials(p.name)}</div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {partnerTypeLabel(p.partnerType, locale)}
                            {p.terms.shareMode === "manual" ? L(` · নির্দিষ্ট ${pct(p.terms.fixedPct)}`, ` · fixed ${pct(p.terms.fixedPct)}`) : ""}
                            {!p.terms.bearsLoss ? L(" · ক্ষতি নেই", " · no loss") : ""}
                            {p.leftAt ? L(` · ${p.leftAt} থেকে অবসর`, ` · retired ${p.leftAt}`) : ""}
                            {p.nextChange ? L(` · ${p.nextChange.from} থেকে বদল`, ` · changes ${p.nextChange.from}`) : ""}
                          </p>
                        </div>
                      </div>
                      <Cell label={L("মূলধন", "Capital")} value={p.netCapital > 0 ? taka(p.netCapital) : "—"} />
                      <Cell label={L("লাভের ভাগ", "Profit share")} value={pct(p.profitPct)} sub={p.terms.bearsLoss ? L(`ক্ষতির ভাগ ${pct(p.lossPct)}`, `loss share ${pct(p.lossPct)}`) : undefined} />
                      <Cell label={L("আজ বিক্রি করলে ভাগ", "Share if sold today")} value={signed(share)} valueCls={tone(share)}
                        sub={p.realizedShare !== 0 ? L(`পাকা ${signed(p.realizedShare)}`, `final ${signed(p.realizedShare)}`) : L("আনুমানিক", "estimate")} />
                      <Cell label={L("মোট পাওনা", "Account value")} value={(p.balance < 0 ? "−" : "") + taka(p.balance)} valueCls={p.balance < 0 ? "text-red-600 dark:text-red-400" : undefined}
                        sub={[
                          p.balance < 0 ? L("খামারের কাছে দেনা", "owes the farm") : null,
                          p.advanceOutstanding > 0.5 ? L(`অগ্রিম বাকি ${taka(p.advanceOutstanding)} (পরের লাভ থেকে কাটা যাবে)`, `advance ${taka(p.advanceOutstanding)} (off the next profit)`) : null,
                          p.advanceOutstanding <= 0.5 && p.profitReceived > 0 ? L(`লাভ পেয়েছেন ${taka(p.profitReceived)}`, `profit paid ${taka(p.profitReceived)}`) : null,
                          p.loanBalance > 0.5 ? L(`খামারের কাছে ধার ${taka(p.loanBalance)}`, `lent to the farm ${taka(p.loanBalance)}`) : null,
                        ].filter(Boolean).join(" · ") || undefined} />
                      <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {farm.fee > 0 && (
              <p className="border-t border-border/60 px-5 py-2.5 text-xs text-muted-foreground">{L(`ম্যানেজমেন্ট ফি: ${taka(farm.fee)}`, `Management fee: ${taka(farm.fee)}`)}</p>
            )}
            {Math.abs(farm.unallocated) >= 1 && (
              <p className="border-t border-border/60 px-5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                {L(`${signed(farm.unallocated)} কারও ভাগে যায়নি — ভাগের সেটিং দেখুন।`, `${signed(farm.unallocated)} could not be allocated — check the share settings.`)}
              </p>
            )}
          </section>

          {!farm.herdValued && onFarm.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {L("কিছু গরুর দাম জানা নেই (বাজারদর বা ওজন নেই) — সেগুলো খরচে ধরা হয়েছে। টাকা-পয়সা পাতায় বাজারদর দিন, গরু ওজন করুন।",
                 "Some animals have no value (no market price or weight) — they count at cost. Enter the market price on the Money page and weigh the cattle.")}
            </p>
          )}
        </>
      )}

      {distOpen && (
        <DeclareDistributionModal
          entries={positions.filter((p) => p.distributable > 0.5).map((p) => ({ id: p.id, name: p.name, distributable: p.distributable }))}
          today={today}
          t={t}
          onClose={() => setDistOpen(false)}
        />
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, note, valueCls }: { icon: React.ElementType; label: string; value: string; note: string; valueCls?: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums tracking-tight", valueCls)}>{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

function Cell({ label, value, sub, valueCls }: { label: string; value: string; sub?: string; valueCls?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="text-right sm:text-left">
        <p className={cn("text-sm font-semibold tabular-nums", valueCls)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
