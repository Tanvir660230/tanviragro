import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/finance/PrintButton";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getServerClient } from "@/lib/supabase/cached";
import { getAccountingData } from "@/lib/accounting/engine";
import { loadHolderData } from "@/lib/accounting/cash-holder-data";
import { buildHolderBook, holderStatement, HOLDER_KIND_LABEL, OPENING_KEY } from "@/lib/accounting/cash-holders";
import { CASH_CATEGORY_LABEL } from "@/lib/accounting/cash-ledger";
import { getL } from "@/i18n/server-text";
import { fmtDay } from "@/lib/format";
import { todayDhaka } from "@/lib/dates";

export const metadata: Metadata = { title: "কার কাছে টাকা — হিসাব" };

const taka = (n: number) => `${n < -0.004 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

/**
 * One holder's whole statement (no lines left out), to print or save as PDF and give to them —
 * e.g. at the end of the month: "this is what the books say you hold, and why".
 */
export default async function HolderStatementPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requirePagePermission(PERMISSIONS.FINANCE_VIEW);
  const L = await getL();
  const { id } = await props.params;
  const { from, to } = await props.searchParams;
  const supabase = await getServerClient();
  const [acc, data] = await Promise.all([getAccountingData(supabase), loadHolderData(supabase, ctx.businessId)]);
  if (!data.enabled) notFound();
  const holder = data.holders.find((h) => h.id === id);
  if (!holder) notFound();

  const input = { rows: acc.cashLedger, openingCash: acc.openingCash, ...data };
  const all = holderStatement(input, id);
  const today = todayDhaka();
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null;
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
  const before = start ? all.filter((l) => l.date < start) : [];
  const lines = all.filter((l) => (!start || l.date >= start) && l.date <= end);
  const opening = before.length ? before[before.length - 1].balance : 0;
  const closing = lines.length ? lines[lines.length - 1].balance : opening;
  const moneyIn = lines.filter((l) => l.signed > 0).reduce((s, l) => s + l.signed, 0);
  const moneyOut = lines.filter((l) => l.signed < 0).reduce((s, l) => s - l.signed, 0);
  const now = buildHolderBook(input).holders.find((h) => h.holder.id === id)?.balance ?? 0;
  const locale = ctx.locale;
  const label = (l: (typeof lines)[number]) =>
    l.category === "Opening" ? L("শুরুর নগদ", "Opening cash")
    : l.category === "Handover" ? `${L("হাতবদল", "Handover")} ${l.description}`
    : L(CASH_CATEGORY_LABEL[l.category].bn, CASH_CATEGORY_LABEL[l.category].en);

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/dashboard/finance?tab=holders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />{L("কার কাছে টাকা", "Who has the cash")}
        </Link>
        <form className="flex flex-wrap items-end gap-2 text-xs text-muted-foreground">
          <label className="grid gap-1">{L("থেকে", "From")}<input type="date" name="from" defaultValue={start ?? ""} max={today} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          <label className="grid gap-1">{L("পর্যন্ত", "To")}<input type="date" name="to" defaultValue={end} max={today} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          <button type="submit" className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">{L("দেখুন", "Show")}</button>
          <PrintButton />
        </form>
      </div>

      <header className="rounded-xl border border-border bg-card p-5 shadow-card print:border-0 print:p-0 print:shadow-none">
        <p className="text-xs text-muted-foreground">{ctx.business.name} · {L("কার কাছে টাকা — হিসাব বিবরণী", "Cash holder statement")}</p>
        <h1 className="mt-1 text-xl font-bold">{holder.name} <span className="text-sm font-normal text-muted-foreground">· {L(HOLDER_KIND_LABEL[holder.kind].bn, HOLDER_KIND_LABEL[holder.kind].en)}</span></h1>
        <p className="text-xs text-muted-foreground">{start ? `${fmtDay(start, locale)} – ` : L("শুরু থেকে ", "From the start to ")}{fmtDay(end, locale)} · {L(`ছাপা ${fmtDay(today, locale)}`, `printed ${fmtDay(today, locale)}`)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">{L("শুরুতে ছিল", "Brought forward")}</dt><dd className="font-semibold tabular-nums">{taka(opening)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{L("এসেছে", "In")}</dt><dd className="font-semibold tabular-nums">{taka(moneyIn)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{L("গেছে", "Out")}</dt><dd className="font-semibold tabular-nums">{taka(moneyOut)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{L("শেষে আছে", "Balance")}</dt><dd className="text-lg font-bold tabular-nums">{taka(closing)}</dd></div>
        </dl>
        {end === today && Math.abs(now - closing) >= 0.5 && <p className="mt-2 text-xs text-muted-foreground">{L(`আজ পর্যন্ত মোট ${taka(now)}`, `${taka(now)} up to today`)}</p>}
      </header>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{L("তারিখ", "Date")}</th>
            <th className="py-2 pr-3 font-medium">{L("বিবরণ", "Details")}</th>
            <th className="py-2 pr-3 text-right font-medium">{L("এসেছে", "In")}</th>
            <th className="py-2 pr-3 text-right font-medium">{L("গেছে", "Out")}</th>
            <th className="py-2 text-right font-medium">{L("থাকল", "Balance")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{L("এই সময়ে কোনো লেনদেন নেই", "No entries in this period")}</td></tr>}
          {lines.map((l) => (
            <tr key={l.key} className="border-b border-border/60 align-top print:break-inside-avoid">
              <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums text-muted-foreground">{l.key === OPENING_KEY ? L("শুরুতে", "Start") : fmtDay(l.date, locale)}</td>
              <td className="py-1.5 pr-3">
                {label(l)}
                {l.category !== "Handover" && l.key !== OPENING_KEY && <span className="block text-xs text-muted-foreground">{l.description}</span>}
                {l.whole != null && <span className="block text-xs text-muted-foreground">{L(`পুরো ${taka(l.whole)} এর মধ্যে এঁর ভাগ`, `their part of ${taka(l.whole)}`)}</span>}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{l.signed > 0 ? taka(l.signed) : ""}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{l.signed < 0 ? taka(l.signed) : ""}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{taka(l.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hidden pt-8 text-xs text-muted-foreground print:block">{L("স্বাক্ষর: ______________________", "Signature: ______________________")}</p>
    </div>
  );
}
