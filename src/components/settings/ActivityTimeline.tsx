"use client";

import { useState, useMemo } from "react";
import {
  Clock,
  Plus,
  ArrowRight,
  DollarSign,
  Package,
  Stethoscope,
  Syringe,
  Landmark,
  CreditCard,
  Search,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";

export interface ActivityItem {
  id: string;
  type: "cattle_add" | "cattle_sold" | "cost_add" | "inventory_purchase" | "medical_treatment" | "health_event" | "partner_txn" | "loan";
  title: string;
  description: string;
  date: string;
  color: string;
}

const ICON_MAP = {
  cattle_add: Plus,
  cattle_sold: ArrowRight,
  cost_add: DollarSign,
  inventory_purchase: Package,
  medical_treatment: Stethoscope,
  health_event: Syringe,
  partner_txn: Landmark,
  loan: CreditCard,
};

const CATEGORIES = [
  { id: "all", label: "All Events", bn: "সব" },
  { id: "cattle", label: "Cattle & Sales", bn: "গরু ও বিক্রি", types: ["cattle_add", "cattle_sold"] },
  { id: "finance", label: "Costs & Loans", bn: "খরচ ও ঋণ", types: ["cost_add", "loan"] },
  { id: "inventory", label: "Feed & Supplies", bn: "খাবার ও স্টক", types: ["inventory_purchase"] },
  { id: "health", label: "Health & Vaccines", bn: "স্বাস্থ্য ও টিকা", types: ["medical_treatment", "health_event"] },
  { id: "partner", label: "Partners", bn: "অংশীদার", types: ["partner_txn"] },
];

const SHOW_LIMIT = 25;

const dhakaDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });

function groupByDay(activities: ActivityItem[], L: (bn: string, en: string) => string, locale: string | undefined) {
  const todayKey = dhakaDayFmt.format(new Date());
  const yesterdayKey = dhakaDayFmt.format(new Date(Date.now() - 86400000));

  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const act of activities) {
    const d = new Date(act.date);
    const key = dhakaDayFmt.format(d);
    const label =
      key === todayKey
        ? L("আজ", "Today")
        : key === yesterdayKey
          ? L("গতকাল", "Yesterday")
          : d.toLocaleDateString(locale === "bn" ? "bn-BD-u-nu-latn" : "en-US", { timeZone: "Asia/Dhaka", month: "long", day: "numeric", year: "numeric" });

    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(act);
    else groups.push({ key, label, items: [act] });
  }
  return groups;
}

export function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const L = useL();
  const { locale } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    return activities.filter((act) => {
      // Category filter
      if (activeCategory !== "all") {
        const cat = CATEGORIES.find((c) => c.id === activeCategory);
        if (cat?.types && !cat.types.includes(act.type)) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = act.title.toLowerCase().includes(q);
        const matchesDesc = act.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [activities, activeCategory, searchQuery]);

  const displayed = showAll ? filtered : filtered.slice(0, SHOW_LIMIT);
  const groups = groupByDay(displayed, L, locale);

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={L("কাজ, গরুর ট্যাগ, অংশীদার বা টাকা খুঁজুন…", "Search events, cow tag, partner, amount...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {L(cat.bn, cat.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Timeline List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center bg-muted/10">
          <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">{L("কিছু পাওয়া যায়নি", "No events match your criteria")}</p>
          <p className="text-xs text-muted-foreground mt-1">{L("খোঁজা মুছে \"সব\" বাছাই করুন।", "Try resetting search keywords or selecting all event categories.")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {L(`${group.items.length}টি`, `${group.items.length} ${group.items.length === 1 ? "event" : "events"}`)}
                </span>
              </div>

              <div className="relative space-y-3 pl-9">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border/60" />
                {group.items.map((act) => {
                  const Icon = ICON_MAP[act.type] || Clock;
                  const dt = new Date(act.date);
                  return (
                    <div key={act.id} className="relative group">
                      <div
                        className={cn(
                          "absolute -left-9 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-sm transition-transform group-hover:scale-110",
                          act.color
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-sm font-semibold text-foreground leading-snug">{act.title}</h4>
                          <time className="mt-0.5 flex shrink-0 items-center gap-1 text-[11px] font-mono text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {dt.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </div>
                        <p className="mt-1 break-words text-xs text-muted-foreground leading-relaxed">{act.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!showAll && filtered.length > SHOW_LIMIT && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(true)}
                className="text-xs font-medium"
              >
                {L(`আরও ${filtered.length - SHOW_LIMIT}টি দেখান`, `Show ${filtered.length - SHOW_LIMIT} more events`)}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
