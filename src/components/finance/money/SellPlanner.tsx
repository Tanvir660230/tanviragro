"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import type { MoneyModel } from "@/lib/money/money-model";
import { WEIGH_EVERY_DAYS } from "@/lib/home/home-model";   // the same weighing rule as the homepage
import { signed, taka, tone } from "./MoneyToday";

/**
 * "What if I sell these, at this price, in N days?" — from the central figures: each animal's full
 * cost so far (lib/partners/position.ts), its weight and measured growth (home model), and the
 * farm's running cost per head per day. Growth is only projected from a measured rate.
 */
export function SellPlanner({ animals, costPerHeadDay, defaultPrice }: { animals: MoneyModel["animals"]; costPerHeadDay: number; defaultPrice: number | null }) {
  const L = useL();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(animals.map((a) => a.id)));
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : "");
  const [days, setDays] = useState("0");

  const p = Number(price) || 0;
  const d = Math.max(0, Math.floor(Number(days) || 0));
  const rows = useMemo(() => animals.map((a) => {
    const growth = a.adgKg != null && a.adgKg > 0 ? a.adgKg * d : 0;
    const weight = a.weightKg != null ? a.weightKg + growth : null;
    const value = weight != null && p > 0 ? weight * p : null;
    const cost = a.fullCost + costPerHeadDay * d;
    return { ...a, weight, value, cost, result: value != null ? value - cost : null, projected: d > 0 && a.adgKg != null && a.adgKg > 0 };
  }), [animals, d, p, costPerHeadDay]);
  const chosen = rows.filter((r) => picked.has(r.id));
  // only animals with a value count: an animal without a weight (or with no price set) would add its cost with no price
  const priced = chosen.filter((r) => r.value != null);
  const unpriced = chosen.length - priced.length;
  const total = priced.reduce((s, r) => ({ value: s.value + r.value!, cost: s.cost + r.cost, result: s.result + r.result! }), { value: 0, cost: 0, result: 0 });
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="rounded-xl border border-border bg-card shadow-card" aria-label={L("বিক্রির আগে হিসাব", "Before you sell")}>
      <div className="border-b border-border/60 px-5 py-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Calculator className="h-4 w-4 text-muted-foreground" aria-hidden />{L("বিক্রির আগে হিসাব", "Before you sell")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {L(`গরু বেছে দাম আর কত দিন পরে বিক্রি দিন। ওজন বাড়ে মাপা হারে; খরচ বাড়ে প্রতি গরু প্রতি দিন ${taka(costPerHeadDay)} (খামারের গড় চলতি খরচ)।`,
             `Pick animals, a price and how many days from now. Weight grows at the measured rate; cost grows ${taka(costPerHeadDay)} per head per day (the farm's average running cost).`)}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 px-5 py-3">
        <label className="grid gap-1 text-xs text-muted-foreground">{L("দাম (৳/কেজি জীবন্ত ওজন)", "Price (৳/kg live weight)")}
          <input type="number" min={0} step={5} value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">{L("কত দিন পরে", "In how many days")}
          <input type="number" min={0} step={1} value={days} onChange={(e) => setDays(e.target.value)} className="h-9 w-24 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <div className="ml-auto text-right">
          <p className="text-[11px] text-muted-foreground">{L(`${priced.length}টি গরু · দাম ${taka(total.value)} · খরচ ${taka(total.cost)}`, `${priced.length} animals · value ${taka(total.value)} · cost ${taka(total.cost)}`)}</p>
          {p > 0
            ? <p className={cn("text-lg font-bold tabular-nums", tone(total.result))}>{signed(total.result)}</p>
            : <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{L("দাম দিন", "Enter a price")}</p>}
          {p > 0 && unpriced > 0 && <p className="text-[10px] text-amber-700 dark:text-amber-400">{L(`${unpriced}টির ওজন নেই — হিসাবে ধরা হয়নি`, `${unpriced} without a weight — not counted`)}</p>}
        </div>
      </div>
      <div className="overflow-x-auto border-t border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2"><input type="checkbox" aria-label={L("সব", "All")} checked={picked.size === animals.length} onChange={(e) => setPicked(e.target.checked ? new Set(animals.map((a) => a.id)) : new Set())} /></th>
              <th className="px-3 py-2 text-left font-medium">{L("গরু", "Animal")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("ওজন", "Weight")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("দাম", "Value")}</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">{L("মোট খরচ", "Full cost")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("ফল", "Result")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => (
              <tr key={r.id} className={cn(!picked.has(r.id) && "opacity-50")}>
                <td className="px-3 py-2"><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.tag} /></td>
                <td className="px-3 py-2 font-medium">{r.tag}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.weight != null ? `${Math.round(r.weight)} ${L("কেজি", "kg")}` : "—"}
                  {r.weight != null && (r.daysSinceWeighed == null || r.daysSinceWeighed > WEIGH_EVERY_DAYS) && (
                    <span className="block text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      {r.daysSinceWeighed == null ? L("কখনো মাপা হয়নি", "never weighed") : L(`${r.daysSinceWeighed} দিন আগে মাপা`, `weighed ${r.daysSinceWeighed} days ago`)}
                    </span>
                  )}
                  {r.weight != null && <span className="block text-[10px] text-muted-foreground">{r.projected ? L("মাপা হারে বাড়বে", "at measured growth") : r.weightBasis === "measured" ? L("মাপা", "measured") : r.weightBasis === "projected" ? L("মাপা + বৃদ্ধি", "measured + growth") : L("আনুমানিক", "estimated")}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.value != null ? taka(r.value) : "—"}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{taka(r.cost)}</td>
                <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", r.result != null ? tone(r.result) : "text-muted-foreground")}>{r.result != null ? signed(r.result) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((r) => d > 0 && (r.adgKg == null || r.adgKg <= 0)) && (
        <p className="border-t border-border/60 px-5 py-2.5 text-[11px] text-amber-700 dark:text-amber-400">{L("কিছু গরুর বৃদ্ধির হার মাপা নেই — সেগুলোর ওজন আজকের মতোই ধরা হয়েছে। নিয়মিত ওজন মাপুন।", "Some animals have no measured growth — their weight is kept at today's. Weigh them regularly.")}</p>
      )}
    </section>
  );
}
