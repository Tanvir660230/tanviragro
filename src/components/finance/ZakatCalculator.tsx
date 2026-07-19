"use client";

import { useState } from "react";
import { Moon, AlertCircle, CheckCircle2, Info, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  // Purchase price passed as default — user should override with current market value
  cattlePurchaseValue: number;
  activeCattleCount: number;
  inventoryValue: number;
  outstandingLoans: number;
  cashBalance: number;
};

function bdt(n: number) {
  return "৳" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

export function ZakatCalculator({
  cattlePurchaseValue,
  activeCattleCount,
  inventoryValue,
  outstandingLoans,
  cashBalance,
}: Props) {
  // Silver nisab: 595g (Hanafi, standard in Bangladesh)
  const [silverPricePerGram, setSilverPricePerGram] = useState("120");

  // Cattle market value — user must enter current market price, not purchase price
  // Pre-filled with purchase price as a floor; Islamic ruling requires market value
  const [cattleValueInput, setCattleValueInput] = useState(
    String(Math.round(cattlePurchaseValue))
  );

  const silvPriceNum = Math.max(1, parseFloat(silverPricePerGram) || 120);
  const nisabAmount  = Math.round(595 * silvPriceNum);

  const cattleValueNum    = Math.max(0, parseFloat(cattleValueInput) || 0);
  const isUsingPurchasePrice = cattleValueNum === Math.round(cattlePurchaseValue);

  const zakatableWealth = Math.max(
    0,
    cattleValueNum + inventoryValue + cashBalance - outstandingLoans
  );
  const isAboveNisab = zakatableWealth >= nisabAmount;
  const zakatDue     = isAboveNisab ? zakatableWealth * 0.025 : 0;
  const shortfall    = nisabAmount - zakatableWealth;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card p-5 space-y-5 print:hidden">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex-shrink-0">
          <Moon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="font-semibold text-base">যাকাত ক্যালকুলেটর</h2>
          <p className="text-xs text-muted-foreground">ব্যবসায়িক সম্পদের উপর যাকাতের হিসাব (আমওয়ালুত তিজারাহ)</p>
        </div>
      </div>

      {/* Nisab */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          নিসাব (৫৯৫ গ্রাম রূপা — হানাফি মাজহাব)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">৳/গ্রাম</span>
            <Input
              type="number"
              min="1"
              step="5"
              value={silverPricePerGram}
              onChange={(e) => setSilverPricePerGram(e.target.value)}
              className="w-24 text-center"
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">= নিসাব</span>
            <span className="font-bold tabular-nums">{bdt(nisabAmount)}</span>
          </div>
        </div>
      </div>

      {/* Asset breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          সম্পদের বিভাজন
        </p>

        <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">

          {/* Cattle — editable, must be market value */}
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  গরুর বর্তমান বাজার মূল্য
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({activeCattleCount}টি গরু)
                  </span>
                </p>
                {isUsingPurchasePrice && activeCattleCount > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    ক্রয়মূল্য দেখাচ্ছে — বর্তমান বাজার মূল্য লিখুন
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Pencil className="h-3 w-3 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={cattleValueInput}
                  onChange={(e) => setCattleValueInput(e.target.value)}
                  className="w-36 text-right h-8 text-sm font-semibold"
                />
              </div>
            </div>
            {cattlePurchaseValue > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                ক্রয়মূল্য: {bdt(cattlePurchaseValue)} (যাকাতে বাজার মূল্য ব্যবহার করুন)
              </p>
            )}
          </div>

          {/* Inventory */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">ইনভেন্টরি মূল্য (খাদ্য, ওষুধ ইত্যাদি)</span>
            <span className="text-sm font-semibold tabular-nums">{bdt(inventoryValue)}</span>
          </div>

          {/* Cash */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">আনুমানিক নগদ ব্যালেন্স</span>
            <span className="text-sm font-semibold tabular-nums">{bdt(cashBalance)}</span>
          </div>

          {/* Loans */}
          {outstandingLoans > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-muted-foreground">বাদ: বকেয়া ঋণ</span>
              <span className="text-sm font-semibold tabular-nums text-destructive">
                −{bdt(outstandingLoans)}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
            <span className="text-sm font-bold">মোট যাকাতযোগ্য সম্পদ</span>
            <span className="text-sm font-bold tabular-nums">{bdt(zakatableWealth)}</span>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className={cn(
        "rounded-xl border p-4",
        isAboveNisab
          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          : "bg-muted/30 border-border/60"
      )}>
        {isAboveNisab ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                যাকাত প্রযোজ্য
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                নিসাব ({bdt(nisabAmount)}) এর উপরে — ২.৫% হারে যাকাত ফরজ।
              </p>
              <div className="mt-3 flex items-end gap-6">
                <div>
                  <p className="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    {bdt(zakatDue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">প্রদেয় যাকাত (২.৫%)</p>
                </div>
                <div className="text-xs text-muted-foreground pb-0.5">
                  = {bdt(zakatableWealth)} × ২.৫%
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">যাকাত প্রযোজ্য নয়</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                সম্পদ ({bdt(zakatableWealth)}) নিসাব ({bdt(nisabAmount)}) এর নিচে।
              </p>
              <p className="text-sm mt-1.5">
                আরও{" "}
                <span className="font-bold text-foreground">{bdt(shortfall)}</span>{" "}
                <span className="text-muted-foreground">যোগ হলে যাকাত প্রযোজ্য হবে।</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-start gap-2 leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
          <p>
            <strong className="text-foreground">গরুর মূল্য:</strong> ইসলামি বিধান অনুযায়ী ব্যবসায়িক গরুর যাকাত
            ক্রয়মূল্যে নয়, <strong>বর্তমান বাজার মূল্যে</strong> হিসাব করতে হবে। উপরে সঠিক বাজার মূল্য লিখুন।
          </p>
        </div>
        <div className="flex items-start gap-2 leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">হাওল:</strong> বছরের শুরু ও শেষে সম্পদ নিসাবের উপরে থাকলে
            (এক চন্দ্রবছর = ৩৫৪ দিন) যাকাত ফরজ। সঠিক পরিমাণের জন্য বিজ্ঞ আলেমের পরামর্শ নিন।
          </p>
        </div>
      </div>
    </div>
  );
}
