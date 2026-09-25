"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Beef,
  Scale,
  HeartPulse,
  Package,
  Zap,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n/I18nProvider";

type L = { bn: string; en: string };
interface ActionItem {
  label: L;
  desc: L;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

// every target is a real page that opens the right form (checked against the site map)
const ACTION_GROUPS: { group: L; items: ActionItem[] }[] = [
  {
    group: { bn: "গরু", en: "Cattle" },
    items: [
      { label: { bn: "নতুন গরু", en: "Add animal" }, desc: { bn: "ট্যাগ ও জাত দিয়ে গরু যোগ", en: "Register one animal" }, icon: Beef, href: "/dashboard/cattle?open=add" },
      { label: { bn: "ওজন লিখুন", en: "Record weights" }, desc: { bn: "একসাথে অনেক গরুর ওজন", en: "Weigh several animals" }, icon: Scale, href: "/dashboard/cattle?open=bulk-weigh" },
      { label: { bn: "টিকা / চিকিৎসা", en: "Vaccine / treatment" }, desc: { bn: "টিকা, চিকিৎসা বা চেকআপ", en: "Log a vaccine or treatment" }, icon: HeartPulse, href: "/dashboard/health/vaccinations" },
      { label: { bn: "গরু বিক্রি", en: "Sell an animal" }, desc: { bn: "গরুর পাতা থেকে বিক্রি করুন", en: "Sell from the animal's page" }, icon: TrendingUp, href: "/dashboard/cattle" },
    ],
  },
  {
    group: { bn: "খাবার", en: "Feed" },
    items: [
      { label: { bn: "খাবার কেনা", en: "Buy feed" }, desc: { bn: "মেমো থেকে কেনা লিখুন", en: "Enter a purchase memo" }, icon: Package, href: "/dashboard/inventory/purchase" },
      { label: { bn: "মিক্স বানান", en: "Make a mix" }, desc: { bn: "তারিখ অনুযায়ী রেসিপি ও মিক্স", en: "Dated recipe and mix" }, icon: Zap, href: "/dashboard/inventory/mix" },
    ],
  },
  {
    group: { bn: "টাকা", en: "Money" },
    items: [
      { label: { bn: "খরচ লিখুন", en: "Record expense" }, desc: { bn: "খামার, ওষুধ বা অন্য খরচ", en: "Farm, medical or other cost" }, icon: DollarSign, href: "/dashboard/finance" },
      { label: { bn: "অংশীদারের টাকা", en: "Partner money" }, desc: { bn: "জমা বা উত্তোলন", en: "Deposit or withdrawal" }, icon: Users, href: "/dashboard/partners" },
      { label: { bn: "রিপোর্ট", en: "Report" }, desc: { bn: "হিসাব ও খামারের রিপোর্ট", en: "Money and herd report" }, icon: FileText, href: "/dashboard/report" },
    ],
  },
];

export function QuickCreateMenu() {
  const router = useRouter();
  const { locale } = useTranslation();
  const tr = (l: L) => (locale === "bn" ? l.bn : l.en);
  const [open, setOpen] = useState(false);

  const handleAction = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        aria-label="Quick Create Menu"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
        <span className="hidden sm:inline">{locale === "bn" ? "নতুন" : "Create"}</span>
        <ChevronDown className="h-3 w-3 opacity-80 hidden sm:inline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 p-2 rounded-2xl border border-border shadow-xl bg-card animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto"
      >
        <div className="px-2 py-1.5 flex items-center justify-between border-b border-border/40 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
            {locale === "bn" ? "দ্রুত কাজ" : "Quick actions"}
          </span>
        </div>

        {ACTION_GROUPS.map((grp, gi) => (
          <React.Fragment key={grp.group.en}>
            {gi > 0 && <DropdownMenuSeparator className="my-1.5" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground/60 px-2 py-1 uppercase tracking-wider">
                {tr(grp.group)}
              </DropdownMenuLabel>
              {grp.items.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.label.en}
                    onClick={() => handleAction(item.href)}
                    className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-muted/60 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground leading-tight">
                        {tr(item.label)}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {tr(item.desc)}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
