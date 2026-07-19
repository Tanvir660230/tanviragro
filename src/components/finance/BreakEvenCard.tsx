import { fmtBDT } from "@/lib/format";
import { Target, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";

interface Props {
  netPL: number;
  avgGrossMarginPerHead: number | null;
  unrealizedInvestment: number;
}

export function BreakEvenCard({ netPL, avgGrossMarginPerHead, unrealizedInvestment }: Props) {
  const { t } = useTranslation();
  const bec = t.cattle_details.break_even_card;

  const totalNetPL = netPL - unrealizedInvestment;
  const isAlreadyProfitable = totalNetPL >= 0;

  if (isAlreadyProfitable) {
    return (
      <div className="flex items-center gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-5 border border-emerald-200/60 dark:ring-emerald-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {bec.already_profitable}
          </p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
            {bec.in_the_green.replace("{{amount}}", fmtBDT(Math.abs(totalNetPL)))}
          </p>
        </div>
      </div>
    );
  }

  const deficit = Math.abs(totalNetPL);
  const cattleNeeded =
    avgGrossMarginPerHead && avgGrossMarginPerHead >= 100
      ? Math.ceil(deficit / avgGrossMarginPerHead)
      : null;

  return (
    <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{bec.title}</p>
          <p className="text-xs text-muted-foreground">{bec.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{bec.still_to_recover}</p>
          <p className="text-base font-bold text-destructive tabular-nums mt-0.5">{fmtBDT(deficit)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{bec.cattle_to_sell}</p>
          <p className="text-base font-bold text-foreground tabular-nums mt-0.5">
            {cattleNeeded !== null ? `~${cattleNeeded}` : "—"}
          </p>
        </div>
      </div>

      {avgGrossMarginPerHead && (
        <p className="text-xs text-muted-foreground">
          {bec.at_avg_margin.replace("{{amount}}", fmtBDT(avgGrossMarginPerHead))}
        </p>
      )}
    </div>
  );
}
