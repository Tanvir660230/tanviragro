"use client";

import { ArrowDownLeft, ArrowUpRight, Beef, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { CASH_CATEGORY_LABEL, type CashCategory } from "@/lib/accounting/cash-ledger";
import { EXPENSE_LABEL, type MoneyModel } from "@/lib/money/money-model";
import { signed, taka, tone } from "./MoneyToday";

/** The chosen period: what the farm spent (by kind), what came in and went out, and what the cattle made. */
export function PeriodOverview({ m }: { m: MoneyModel }) {
  const L = useL();
  const p = m.period;
  const maxLine = Math.max(1, ...p.expenseLines.map((l) => l.amount));
  const label = (c: string) => { const x = CASH_CATEGORY_LABEL[c as CashCategory]; return x ? L(x.bn, x.en) : c; };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        {/* running costs by kind */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-3" aria-label={L("চলতি খরচ", "Running costs")}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />{L("চলতি খরচ", "Running costs")}</h3>
            <span className="text-lg font-bold tabular-nums">{taka(p.running)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{L("গরু রাখার খরচ — বিক্রির সময় গরুর দামের সাথে হিসাব হয়, আলাদা ক্ষতি নয়", "What keeping the cattle cost — counted against them when they are sold, not a separate loss")}</p>
          {p.expenseLines.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{L("এই সময়ে কোনো খরচ নেই।", "No costs in this period.")}</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {p.expenseLines.map((l) => (
                <li key={l.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{L(EXPENSE_LABEL[l.key].bn, EXPENSE_LABEL[l.key].en)}</span>
                    <span className="shrink-0 tabular-nums">{taka(l.amount)} <span className="text-xs text-muted-foreground">{p.running > 0 ? `${Math.round((l.amount / p.running) * 100)}%` : ""}</span></span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (Math.max(0, l.amount) / maxLine) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
            {p.depreciation > 0.5 && <span>{L(`সম্পদের ক্ষয় (অবচয়): ${taka(p.depreciation)}`, `Depreciation: ${taka(p.depreciation)}`)}</span>}
            {p.assetsBought > 0.5 && <span>{L(`সম্পদ কেনা (খরচ নয়): ${taka(p.assetsBought)}`, `Assets bought (not a cost): ${taka(p.assetsBought)}`)}</span>}
            {p.cattleBought > 0.5 && <span>{L(`গরু কেনা: ${taka(p.cattleBought)}`, `Cattle bought: ${taka(p.cattleBought)}`)}</span>}
            {p.cattleOwnCosts > 0.5 && <span>{L(`নির্দিষ্ট গরুর নিজের খরচ (ডাক্তার ইত্যাদি): ${taka(p.cattleOwnCosts)}`, `Costs put on one animal (vet etc.): ${taka(p.cattleOwnCosts)}`)}</span>}
          </div>
        </section>

        <div className="space-y-4 lg:col-span-2">
          {/* what the cattle made */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-card" aria-label={L("গরু থেকে ফল", "Result from cattle")}>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Beef className="h-4 w-4 text-muted-foreground" aria-hidden />{L("গরু থেকে লাভ-ক্ষতি", "Profit or loss from cattle")}</h3>
            {p.result.animals === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{L("এই সময়ে কোনো গরু বিক্রি হয়নি বা মারা যায়নি — তাই পাকা লাভ-ক্ষতি নেই। খামারে থাকা গরুর আনুমানিক ফল উপরে।", "No animal was sold or died in this period — so no final profit or loss. The estimate for the herd is above.")}</p>
            ) : (
              <div className="mt-2 space-y-1 text-sm">
                <p className="flex justify-between"><span className="text-muted-foreground">{L(`${p.result.animals}টি গরু বিক্রি/মৃত`, `${p.result.animals} sold or dead`)}</span><span className="tabular-nums">{taka(p.result.sales)}</span></p>
                <p className="flex justify-between font-semibold"><span>{L("পাকা ফল (সব খরচ বাদে)", "Final result (after every cost)")}</span><span className={cn("tabular-nums", tone(p.result.result))}>{signed(p.result.result)}</span></p>
              </div>
            )}
          </section>

          {/* cash in and out */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-card" aria-label={L("টাকা আসা-যাওয়া", "Cash in and out")}>
            <h3 className="text-sm font-semibold">{L("টাকা আসা-যাওয়া", "Cash in and out")}</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-500/[0.07] px-2 py-2">
                <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><ArrowDownLeft className="h-3 w-3" aria-hidden />{L("এসেছে", "In")}</p>
                <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{taka(p.cash.totalIn)}</p>
              </div>
              <div className="rounded-lg bg-red-500/[0.07] px-2 py-2">
                <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><ArrowUpRight className="h-3 w-3" aria-hidden />{L("গেছে", "Out")}</p>
                <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">{taka(p.cash.totalOut)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-2 py-2">
                <p className="text-[11px] text-muted-foreground">{L("নিট", "Net")}</p>
                <p className={cn("text-sm font-bold tabular-nums", tone(p.cash.net))}>{signed(p.cash.net)}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {[...p.cash.moneyIn.map((x) => ({ ...x, dir: "in" as const })), ...p.cash.moneyOut.map((x) => ({ ...x, dir: "out" as const }))].map((x) => (
                <li key={`${x.dir}-${x.category}`} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{x.dir === "in" ? "↓" : "↑"} {label(x.category)}</span>
                  <span className={cn("tabular-nums", x.dir === "in" ? "text-emerald-700 dark:text-emerald-400" : "")}>{taka(x.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
