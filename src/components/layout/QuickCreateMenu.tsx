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

interface ActionItem {
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const ACTION_GROUPS: { group: string; items: ActionItem[] }[] = [
  {
    group: "Livestock Operations",
    items: [
      { label: "Add Animal", desc: "Register single cattle with tag & breed", icon: Beef, href: "/dashboard/cattle?open=add" },
      { label: "Log Weight Update", desc: "Record batch weighing & ADG check", icon: Scale, href: "/dashboard/cattle?open=bulk-weigh" },
      { label: "Health / Vaccination", desc: "Log treatment, vaccine or checkup", icon: HeartPulse, href: "/dashboard/cattle" },
    ],
  },
  {
    group: "Feed & Inventory",
    items: [
      { label: "Receive Feed / Stock In", desc: "Procure feed supplies or raw goods", icon: Package, href: "/dashboard/inventory?open=add" },
      { label: "Daily Feed Log", desc: "Record batch feed consumption", icon: Zap, href: "/dashboard/inventory" },
    ],
  },
  {
    group: "Financials & Partners",
    items: [
      { label: "Record Expense", desc: "Log farm, feed or medical cost", icon: DollarSign, href: "/dashboard/finance" },
      { label: "Record Income / Sale", desc: "Log animal sale or manure revenue", icon: TrendingUp, href: "/dashboard/finance" },
      { label: "Partner Transaction", desc: "Deposit or equity disbursement", icon: Users, href: "/dashboard/partners" },
      { label: "Generate Report", desc: "Export financial or herd summary", icon: FileText, href: "/dashboard/report" },
    ],
  },
];

export function QuickCreateMenu() {
  const router = useRouter();
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
        <span className="hidden sm:inline">Create</span>
        <ChevronDown className="h-3 w-3 opacity-80 hidden sm:inline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 p-2 rounded-2xl border border-border shadow-xl bg-card animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto"
      >
        <div className="px-2 py-1.5 flex items-center justify-between border-b border-border/40 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
            Quick Actions
          </span>
          <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-mono">
            Ctrl+J
          </span>
        </div>

        {ACTION_GROUPS.map((grp, gi) => (
          <React.Fragment key={grp.group}>
            {gi > 0 && <DropdownMenuSeparator className="my-1.5" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground/60 px-2 py-1 uppercase tracking-wider">
                {grp.group}
              </DropdownMenuLabel>
              {grp.items.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={() => handleAction(item.href)}
                    className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-muted/60 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {item.desc}
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
