"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Beef,
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  ChevronRight,
  TrendingUp,
  Store,
  Scale,
  Users,
  Plus,
  Zap,
  DollarSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/i18n/I18nProvider";

interface CattleResult {
  id: string;
  tag_id: string;
  status: "active" | "sold" | "dead";
}

type NavItem =
  | { kind: "go"; label: string; description: string; icon: React.ReactNode; href: string }
  | { kind: "cattle"; c: CattleResult };

const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400",
  sold: "text-amber-600 dark:text-amber-400",
  dead: "text-muted-foreground",
};

// Static metadata — icons, hrefs, keywords never change
const PAGES_META = [
  { tLabel: "pg_dashboard", tDesc: "pg_dashboard_d", href: "/dashboard",            keywords: ["home","main","overview"],                  icon: <LayoutDashboard className="h-4 w-4" /> },
  { tLabel: "pg_cattle",    tDesc: "pg_cattle_d",    href: "/dashboard/cattle",      keywords: ["cattle","cow","animal","goru"],             icon: <Beef className="h-4 w-4" /> },
  { tLabel: "pg_inventory", tDesc: "pg_inventory_d", href: "/dashboard/inventory",   keywords: ["feed","stock","supply","inventory"],        icon: <Package className="h-4 w-4" /> },
  { tLabel: "pg_finance",   tDesc: "pg_finance_d",   href: "/dashboard/finance",     keywords: ["pl","profit","loss","cost","finance"],      icon: <BarChart3 className="h-4 w-4" /> },
  { tLabel: "pg_vendors",   tDesc: "pg_vendors_d",   href: "/dashboard/vendors",     keywords: ["supplier","vendor"],                       icon: <Store className="h-4 w-4" /> },
  { tLabel: "pg_partners",  tDesc: "pg_partners_d",  href: "/dashboard/partners",    keywords: ["investor","partner"],                      icon: <Users className="h-4 w-4" /> },
  { tLabel: "pg_settings",  tDesc: "pg_settings_d",  href: "/dashboard/settings",    keywords: ["account","profile","theme","settings"],    icon: <Settings className="h-4 w-4" /> },
] as const;

const ACTIONS_META = [
  { tLabel: "ac_add_cattle",  tDesc: "ac_add_cattle_d",  href: "/dashboard/cattle?open=add",        keywords: ["new cow","register animal","add cattle"],      icon: <Plus className="h-4 w-4" /> },
  { tLabel: "ac_bulk_weigh",  tDesc: "ac_bulk_weigh_d",  href: "/dashboard/cattle?open=bulk-weigh", keywords: ["weight","bulk","weigh"],                        icon: <Scale className="h-4 w-4" /> },
  { tLabel: "ac_add_feed",    tDesc: "ac_add_feed_d",    href: "/dashboard/inventory?open=add",     keywords: ["new item","new stock","feed"],                  icon: <Plus className="h-4 w-4" /> },
  { tLabel: "ac_daily_feed",  tDesc: "ac_daily_feed_d",  href: "/dashboard/inventory",              keywords: ["daily","deduct","consumption"],                 icon: <Zap className="h-4 w-4" /> },
  { tLabel: "ac_add_cost",    tDesc: "ac_add_cost_d",    href: "/dashboard/finance",                keywords: ["cost","expense","fixed","variable"],            icon: <DollarSign className="h-4 w-4" /> },
  { tLabel: "ac_forecast",    tDesc: "ac_forecast_d",    href: "/dashboard/finance",                keywords: ["budget","forecast","plan"],                     icon: <TrendingUp className="h-4 w-4" /> },
] as const;

function matchQuery(q: string, label: string, description: string, keywords: readonly string[]) {
  return (
    label.toLowerCase().includes(q) ||
    description.toLowerCase().includes(q) ||
    keywords.some((k) => k.toLowerCase().includes(q))
  );
}

const RECENT_KEY = "tanvir_agro_recent_cattle";
const MAX_RECENT = 5;

function getRecentCattle(): { id: string; tag_id: string }[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function trackRecentCattle(id: string, tag_id: string) {
  try {
    const recent = getRecentCattle().filter(c => c.id !== id);
    recent.unshift({ id, tag_id });
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

export function SearchBox() {
  const { t } = useTranslation();
  const s = t.search;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [cattleList, setCattleList] = useState<CattleResult[]>([]);
  const [recentCattle, setRecentCattle] = useState<{ id: string; tag_id: string }[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const PAGES = useMemo(() => PAGES_META.map((p) => ({
    label: s[p.tLabel as keyof typeof s] as string,
    description: s[p.tDesc as keyof typeof s] as string,
    href: p.href,
    keywords: p.keywords,
    icon: p.icon,
  })), [s]);

  const ACTIONS = useMemo(() => ACTIONS_META.map((a) => ({
    label: s[a.tLabel as keyof typeof s] as string,
    description: s[a.tDesc as keyof typeof s] as string,
    href: a.href,
    keywords: a.keywords,
    icon: a.icon,
  })), [s]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecentCattle(getRecentCattle());
      if (!fetchedRef.current) {
        fetchedRef.current = true;
        const supabase = createClient();
        supabase
          .from("cattle")
          .select("id, tag_id, status")
          .order("tag_id", { ascending: true })
          .then(({ data }) => {
            if (data) setCattleList(data as CattleResult[]);
          });
      }
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const filteredActions = useMemo(() =>
    q ? ACTIONS.filter((a) => matchQuery(q, a.label, a.description, a.keywords)) : ACTIONS,
    [q, ACTIONS]
  );
  const filteredCattle = useMemo(() =>
    q ? cattleList.filter((c) => c.tag_id.toLowerCase().includes(q)) : [],
    [q, cattleList]
  );
  const filteredPages = useMemo(() =>
    q ? PAGES.filter((p) => matchQuery(q, p.label, p.description, p.keywords)) : PAGES,
    [q, PAGES]
  );

  const navItems = useMemo<NavItem[]>(() => [
    ...filteredActions.map((a) => ({ kind: "go" as const, label: a.label, description: a.description, icon: a.icon, href: a.href })),
    ...filteredCattle.map((c) => ({ kind: "cattle" as const, c })),
    ...filteredPages.map((p) => ({ kind: "go" as const, label: p.label, description: p.description, icon: p.icon, href: p.href })),
  ], [filteredActions, filteredCattle, filteredPages]);

  const actionBase = 0;
  const cattleBase = filteredActions.length;
  const pageBase = filteredActions.length + filteredCattle.length;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelected(0); }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  const executeAt = useCallback(
    (idx: number) => {
      const item = navItems[idx];
      if (!item) return;
      if (item.kind === "go") {
        router.push(item.href);
      } else {
        trackRecentCattle(item.c.id, item.c.tag_id);
        router.push(`/dashboard/cattle/${item.c.id}`);
      }
      close();
    },
    [navItems, router, close]
  );

  // Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((sel) => Math.min(sel + 1, navItems.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((sel) => Math.max(sel - 1, 0)); }
      if (e.key === "Enter")     { executeAt(selected); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, navItems.length, selected, executeAt]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, close]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const hasResults = navItems.length > 0;

  const ItemRow = ({ item, navIdx }: { item: NavItem; navIdx: number }) => {
    const active = selected === navIdx;
    const base = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`;
    const iconCls = `shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground"}`;
    const chevronCls = `h-3.5 w-3.5 shrink-0 ${active ? "text-primary-foreground/50" : "text-muted-foreground/50"}`;

    if (item.kind === "cattle") {
      const { c } = item;
      return (
        <div
          className={`${active ? "bg-primary/5 dark:bg-primary/10" : ""} rounded-lg`}
          onMouseEnter={() => setSelected(navIdx)}
        >
          <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted`} onClick={() => executeAt(navIdx)}>
            <span className="shrink-0 text-muted-foreground"><Beef className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-none">#{c.tag_id}</p>
              <p className={`mt-0.5 text-xs capitalize ${STATUS_COLOR[c.status] ?? "text-muted-foreground"}`}>
                {c.status}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          </button>
          {c.status === "active" && (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 pb-2 pt-0 text-left text-xs text-primary hover:text-primary/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                trackRecentCattle(c.id, c.tag_id);
                close();
                router.push(`/dashboard/cattle/${c.id}?tab=overview`);
              }}
            >
              <Scale className="h-3 w-3" />
              ওজন লগ করুন →
            </button>
          )}
        </div>
      );
    }

    return (
      <button className={base} onClick={() => executeAt(navIdx)} onMouseEnter={() => setSelected(navIdx)}>
        <span className={iconCls}>{item.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-none">{item.label}</p>
          <p className={`mt-0.5 text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {item.description}
          </p>
        </div>
        <ChevronRight className={chevronCls} />
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        className="group w-full h-10 flex items-center gap-3 rounded-xl border border-border bg-card px-4 text-sm shadow-card hover:shadow-md hover:border-primary/25 transition-all duration-150"
        onClick={() => setOpen(true)}
        aria-label={s.placeholder}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
        <span className="flex-1 text-left text-muted-foreground/70 text-[13px]">
          {s.placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <kbd className="rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground/50">
            Ctrl
          </kbd>
          <kbd className="rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-xs leading-none text-muted-foreground/50">
            K
          </kbd>
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-full md:min-w-[460px] rounded-xl bg-card border border-border shadow-2xl overflow-hidden z-50">
          {/* Active search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <Search className="h-[18px] w-[18px] shrink-0 text-primary/60" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.input_placeholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
            />
            <kbd className="rounded-lg border border-border/60 bg-muted/60 px-2 py-1 text-xs font-mono text-muted-foreground/60 leading-none">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto p-2">
            {/* Recent cattle — shown when no query and have history */}
            {!q && recentCattle.length > 0 && (
              <section className="mb-2 border-b border-border/50 pb-2">
                <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground/50">
                  Recent
                </p>
                {recentCattle.map((rc, i) => {
                  const cattle = cattleList.find(c => c.id === rc.id) ?? { id: rc.id, tag_id: rc.tag_id, status: "active" as const };
                  return (
                    <ItemRow key={rc.id} item={{ kind: "cattle", c: cattle }} navIdx={i} />
                  );
                })}
              </section>
            )}

            {!hasResults ? (
              <div className="py-10 text-center">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/60">{s.no_results}</p>
              </div>
            ) : (
              <>
                {filteredActions.length > 0 && (
                  <section className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground/50">
                      {s.section_actions}
                    </p>
                    {filteredActions.map((a, i) => (
                      <ItemRow
                        key={a.href + a.label}
                        item={{ kind: "go", label: a.label, description: a.description, icon: a.icon, href: a.href }}
                        navIdx={actionBase + i}
                      />
                    ))}
                  </section>
                )}
                {filteredCattle.length > 0 && (
                  <section className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground/50">
                      {s.section_cattle}
                    </p>
                    {filteredCattle.map((c, i) => (
                      <ItemRow key={c.id} item={{ kind: "cattle", c }} navIdx={cattleBase + i} />
                    ))}
                  </section>
                )}
                {filteredPages.length > 0 && (
                  <section>
                    <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground/50">
                      {s.section_pages}
                    </p>
                    {filteredPages.map((p, i) => (
                      <ItemRow
                        key={p.href}
                        item={{ kind: "go", label: p.label, description: p.description, icon: p.icon, href: p.href }}
                        navIdx={pageBase + i}
                      />
                    ))}
                  </section>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 px-4 py-2 flex items-center gap-4 bg-muted/20">
            {([["↑↓", s.kbd_navigate], ["↵", s.kbd_open], ["Esc", s.kbd_close]] as [string, string][]).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                <kbd className="font-mono rounded border border-border/50 bg-background/60 px-1.5 py-0.5 text-xs leading-none">{key}</kbd>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
