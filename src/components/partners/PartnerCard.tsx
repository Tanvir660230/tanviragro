"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, Wrench, ChevronRight, Trash2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Partner, PartnerTransaction, PartnerType } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { bdt, avatarColor, initials, type PartnerAccountSummary } from "@/lib/partners/calculations";
import { deletePartner } from "@/app/dashboard/(app)/partners/actions";
import { EditPartnerDialog } from "@/components/partners/modals/EditPartnerDialog";
import { Badge, QuickStat, TYPE_CONFIG, TXN_ICON, TXN_LABEL, TXN_TEXT, TXN_SIGN } from "@/components/partners/partner-ui";
import { toast } from "sonner";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";

export interface CattleValuation {
  activeCattleCount: number;
  marketPricePerKg: number;
  marketPriceDate: string | null;
  totalEstimatedValue: number;
  totalActiveCostBasis: number;
  totalUnrealizedGain: number;
  hasMarketPrice: boolean;
  rows: Array<{
    id: string;
    daysInPen: number;
    estimatedWeight: number;
    weightSource: "weighed" | "estimated";
    estimatedMarketValue: number;
    costBasis: number;
    unrealizedGain: number;
  }>;
}

export function PartnerCard({
  partner: p,
  transactions,
  acc,
  sharePct,
  t,
}: {
  partner: Partner;
  transactions: PartnerTransaction[];
  acc: PartnerAccountSummary;
  netInvestment: number;
  totalInvested: number;
  totalBusinessValue: number;
  sharePct: number;
  cattleValuation: CattleValuation;
  t: Dictionary;
}) {
  const L = useL();
  const { locale } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deletePartner(p.id);
      if (result?.error) toast.error(result.error);
      else toast.success(L(`${p.name} সরানো হলো`, `${p.name} removed`));
    });
  }

  const type = (p.partner_type ?? "capital") as PartnerType;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.capital;
  const isLoss = acc.pendingLoss > 0;
  const hasPending = acc.pendingProfit + acc.pendingLoss > 0;
  const pendingAmt = isLoss ? acc.pendingLoss : acc.pendingProfit;
  const months = acc.months;
  const cliff = p.cliff_months ?? 0;
  const cliffPassed = months >= cliff;
  const vestedMonths = cliffPassed ? months : 0;

  const avColor = avatarColor(p.name);
  const initStr = initials(p.name);
  const roi =
    acc.totalInvested > 0
      ? ((acc.equity - acc.totalInvested) / acc.totalInvested) * 100
      : null;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden shadow-card card-interactive flex flex-col">
      <div className={cn("h-1.5 w-full flex-shrink-0", avColor)} />
      <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start gap-3">
          <Link href={`/dashboard/partners/${p.id}`} className="flex-shrink-0 mt-0.5">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm select-none",
              avColor
            )}>
              {initStr}
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <Link
              href={`/dashboard/partners/${p.id}`}
              className="text-[15px] font-bold text-foreground hover:text-primary transition-colors leading-snug"
            >
              {p.name}
            </Link>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge className={cfg.cls}>{cfg.icon}{cfg.label(t)}</Badge>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Layers className="h-3 w-3" />{sharePct.toFixed(1)}%
              </Badge>
              {hasPending && (
                <Badge className={isLoss
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                }>
                  <Clock className="h-3 w-3" />
                  {isLoss ? L("ক্ষতি বাকি", "Loss due") : L("লাভ পাওনা", "Profit due")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {L("যোগ", "Joined")} {p.joined_at.slice(0, 7)}
              {" · "}{L(`${months} মাস`, `${months}mo active`)}
            </p>
          </div>

          <div className="shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 text-xs border border-destructive/30 rounded-lg px-2 py-1 bg-destructive/5">
                <span className="text-destructive font-medium">{t.partners.delete_confirm}</span>
                <button onClick={handleDelete} disabled={isDeleting} className="text-destructive font-bold hover:underline">
                  {t.partners.confirm_yes}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:underline">
                  {t.partners.confirm_no}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <EditPartnerDialog partner={p} transactions={transactions} t={t} />
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Key metrics row ── */}
        <div className="grid grid-cols-3 gap-2">
          {type !== "labor" ? (
            <QuickStat label={L("জমা", "Invested")} value={bdt(acc.totalInvested)} />
          ) : (
            <QuickStat label={L("শ্রমের মূল্য", "Labor Value")} value={bdt(acc.laborValue)} />
          )}
          <QuickStat
            label={L("মূলধন", "Equity")}
            value={(acc.equity >= 0 ? "" : "−") + bdt(acc.equity)}
            color={acc.equity >= 0 ? "green" : "red"}
          />
          {roi !== null ? (
            <QuickStat
              label="ROI"
              value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
              color={roi >= 0 ? "green" : "red"}
            />
          ) : (
            <QuickStat label={L("ভাগ", "Share")} value={`${sharePct.toFixed(1)}%`} />
          )}
        </div>
        {/* ── Status row (pending + vesting inline) ── */}
        {(hasPending || (type !== "capital" && p.labor_value_monthly && p.labor_value_monthly > 0)) && (
          <div className="flex flex-wrap gap-2">
            {hasPending && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                isLoss
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              )}>
                <Clock className="h-3 w-3" />
                {isLoss ? L("ক্ষতি বাকি", "Loss due") : L("লাভ পাওনা", "Profit due")}: {bdt(pendingAmt)}
              </span>
            )}
            {type !== "capital" && p.labor_value_monthly && p.labor_value_monthly > 0 && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                cliffPassed
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              )}>
                <Wrench className="h-3 w-3" />
                {cliffPassed ? L(`${vestedMonths} মাস যোগ হয়েছে`, `${vestedMonths}mo vested`) : L(`অপেক্ষা: ${months}/${cliff} মাস`, `Cliff: ${months}/${cliff}mo`)}
              </span>
            )}
          </div>
        )}

        {/* ── Recent transactions ── */}
        {transactions.length > 0 ? (
          <div className="rounded-xl bg-muted/30 border border-border/40 overflow-hidden">
            {transactions.slice(0, 3).map((txn, i) => (
              <div key={txn.id} className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs",
                i > 0 && "border-t border-border/30"
              )}>
                <span className="flex-shrink-0">{TXN_ICON[txn.type]}</span>
                <span className="flex-1 text-muted-foreground truncate">{TXN_LABEL(t)[txn.type]}</span>
                <span className={cn("font-bold tabular-nums", TXN_TEXT[txn.type])}>
                  {TXN_SIGN[txn.type]}{bdt(txn.amount)}
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0 w-12 text-right">
                  {new Date(txn.recorded_at + "T00:00:00").toLocaleDateString(locale === "bn" ? "bn-BD-u-nu-latn" : "en-US", {
                    month: "short", day: "numeric",
                  })}
                </span>
              </div>
            ))}
            {transactions.length > 3 && (
              <div className="px-3 py-1.5 border-t border-border/30 bg-muted/20">
                <Link href={`/dashboard/partners/${p.id}`} className="text-[11px] text-primary hover:underline font-medium">
                  {L(`আরও ${transactions.length - 3}টি →`, `+${transactions.length - 3} more →`)}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/20 border border-dashed border-border/50 px-3 py-3 text-center">
            <p className="text-xs text-muted-foreground">{L("এখনো কোনো লেনদেন নেই", "No transactions yet")}</p>
          </div>
        )}

        {p.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border/50 pl-2">{p.notes}</p>
        )}

        <Link
          href={`/dashboard/partners/${p.id}`}
          className="mt-auto flex items-center justify-between w-full rounded-xl border border-border/60 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-all group"
        >
          <span>{L("পুরো প্রোফাইল ও লেনদেন", "Full profile & transactions")}</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
