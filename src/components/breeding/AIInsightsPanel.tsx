import { AlertTriangle, CheckCircle, Dna, Baby, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type IType = "warning" | "success" | "info";

interface Props {
  heatCount: number;
  conceptionRate: number;
  totalAttempts: number;
  overdue: number;
  upcoming7d: number;
  repeaters: number;
  lowSemen: { bull_name: string; straws_in_stock: number }[];
}

export function AIInsightsPanel({ heatCount, conceptionRate, totalAttempts, overdue, upcoming7d, repeaters, lowSemen }: Props) {
  const ins: { t: IType; icon: any; title: string; desc: string }[] = [];

  if (heatCount > 0) ins.push({ t: "warning", icon: Flame, title: `${heatCount} Animals Currently in Heat`, desc: "Optimal insemination window is open. AM/PM rule: cows detected AM → breed PM; detected PM → breed next AM." });
  if (totalAttempts > 3) {
    if (conceptionRate < 50) ins.push({ t: "warning", icon: AlertTriangle, title: `Low Conception Rate — ${conceptionRate}%`, desc: "Below the 50-60% industry benchmark. Review technician technique, semen motility, and heat detection accuracy." });
    else if (conceptionRate >= 60) ins.push({ t: "success", icon: CheckCircle, title: `Excellent Rate — ${conceptionRate}%`, desc: "Above the 60% benchmark. Your breeding protocols are performing well." });
  }
  if (repeaters > 0) ins.push({ t: "warning", icon: AlertTriangle, title: `${repeaters} Repeat Breeding Cases`, desc: "Animals requiring 3+ inseminations. Schedule systematic veterinary evaluation for hidden reproductive pathology." });
  if (overdue > 0) ins.push({ t: "warning", icon: Baby, title: `${overdue} Overdue Calvings`, desc: "Past expected calving date. Immediate veterinary assessment and monitoring recommended." });
  if (lowSemen.length > 0) ins.push({ t: "warning", icon: Dna, title: "Semen Stock Running Critical", desc: `${lowSemen.map(s => `${s.bull_name} (${s.straws_in_stock} straws)`).join(", ")} — reorder immediately to avoid service gap.` });
  if (upcoming7d > 0) ins.push({ t: "info", icon: Baby, title: `${upcoming7d} Calvings Expected This Week`, desc: "Prepare maternity pen, colostrum kit, ear tags, and ensure veterinary availability." });
  if (ins.length === 0) ins.push({ t: "success", icon: CheckCircle, title: "All Systems Nominal", desc: "No critical breeding alerts. Your herd is on track with reproductive health benchmarks." });

  const bg: Record<IType, string> = {
    warning: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50",
    success: "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50",
    info: "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50",
  };
  const ic: Record<IType, string> = {
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-emerald-600 dark:text-emerald-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <div className="space-y-3">
      {ins.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className={`p-4 rounded-2xl border ${bg[item.t]} flex items-start gap-4`}>
            <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-background/80 shadow-xs ${ic[item.t]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <Badge variant={item.t === "warning" ? "warning" : "default"} className="text-[10px]">
                  {item.t === "warning" ? "Action Needed" : item.t === "success" ? "On Track" : "Info"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
