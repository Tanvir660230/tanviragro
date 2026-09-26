"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useL } from "@/i18n/text";
import type { MoneyCheck, MoneyModel } from "@/lib/money/money-model";
import { taka } from "./MoneyToday";

/**
 * What would make a figure on this page wrong — found by the money model, shown before anyone
 * has to notice a mismatch. Only the problems are listed; with none, one quiet line.
 */
export function MoneyChecks({ checks }: { checks: MoneyModel["checks"] }) {
  const L = useL();
  const problems = checks.filter((c) => !c.ok);

  if (problems.length === 0) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {L("হিসাব মিলছে — খাতা সমান, partner আর হিসাবের ফল এক, বাজারদর ও ওজন হালনাগাদ", "The books agree — balanced, partners and accounts give one result, price and weights up to date")}
      </p>
    );
  }

  const text = (c: MoneyCheck): { msg: string; href: string; action: string } => {
    switch (c.key) {
      case "books": return { msg: L(`খাতা মিলছে না (${taka(c.amount ?? 0)} পার্থক্য) — কোনো লেনদেন অর্ধেক লেখা হয়েছে`, `The books are off by ${taka(c.amount ?? 0)} — an entry is half recorded`), href: "/dashboard/accounting", action: L("হিসাব দেখুন", "Open accounts") };
      case "engines": return { msg: L(`partner পাতার ফল আর হিসাবের ফলে ${taka(c.amount ?? 0)} পার্থক্য`, `Partners and accounts differ by ${taka(c.amount ?? 0)}`), href: "/dashboard/partners", action: L("partner দেখুন", "Open partners") };
      case "price": return { msg: c.count == null ? L("বাজারদর দেওয়া নেই — গরুর দাম খরচে ধরা হচ্ছে", "No market price — cattle are counted at cost") : L(`বাজারদর ${c.count} দিন পুরনো — গরুর দাম আর লাভের হিসাব এর ওপর`, `The market price is ${c.count} days old — cattle values lean on it`), href: "#market-price", action: L("দাম দিন", "Set the price") };
      case "weights": return { msg: L(`${c.count}টি গরু অনেক দিন মাপা হয়নি — এদের দাম আন্দাজ`, `${c.count} animals not weighed lately — their value is a guess`), href: "/dashboard/cattle", action: L("ওজন দিন", "Weigh") };
      case "stock": return { msg: L(`স্টক শূন্যের নিচে (${taka(c.amount ?? 0)}) — কেনার চেয়ে বেশি খাওয়ানো লেখা হয়েছে; কোনো কেনা লেখা বাকি`, `Stock is below zero (${taka(c.amount ?? 0)}) — more fed than bought; a purchase is missing`), href: "/dashboard/inventory", action: L("স্টক দেখুন", "Open stock") };
      case "cash": return { msg: L(`নগদ শূন্যের নিচে (−${taka(c.amount ?? 0)}) — কোনো টাকা আসা লেখা হয়নি`, `Cash is below zero (−${taka(c.amount ?? 0)}) — money that came in is not recorded`), href: "?tab=cash", action: L("নগদ বিবরণী", "Cash statement") };
    }
  };

  return (
    <section className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/20" aria-label={L("হিসাব যাচাই", "Checks")}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" aria-hidden />{L(`${problems.length}টি জিনিস ঠিক করলে হিসাব পুরো নির্ভুল হবে`, `${problems.length} thing(s) to fix for exact figures`)}
      </p>
      <ul className="mt-1.5 space-y-1 text-xs">
        {problems.map((c) => {
          const t = text(c);
          return (
            <li key={c.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-amber-900 dark:text-amber-200">• {t.msg}</span>
              <Link href={t.href} className="shrink-0 font-medium text-primary hover:underline">{t.action}</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
