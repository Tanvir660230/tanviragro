"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Beef,
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  Search,
  ChevronRight,
  TrendingUp,
  Store,
  Users,
  Plus,
  Scale,
  Zap,
  DollarSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

const PAGES = [
  { label: "Dashboard",  description: "Overview & stats",      icon: <LayoutDashboard className="h-4 w-4" />, href: "/dashboard",            keywords: ["home","main","overview"] },
  { label: "Livestock",  description: "Manage all cattle",     icon: <Beef className="h-4 w-4" />,           href: "/dashboard/cattle",      keywords: ["cattle","cow","animal"] },
  { label: "Inventory",  description: "Feed & supplies",       icon: <Package className="h-4 w-4" />,        href: "/dashboard/inventory",   keywords: ["feed","stock","supply"] },
  { label: "Finance",    description: "P&L, costs, analytics", icon: <BarChart3 className="h-4 w-4" />,      href: "/dashboard/finance",     keywords: ["pl","profit","loss","cost"] },
  { label: "Vendors",    description: "Supplier management",   icon: <Store className="h-4 w-4" />,          href: "/dashboard/vendors",     keywords: ["supplier","vendor"] },
  { label: "Partners",   description: "Investor ledger",       icon: <Users className="h-4 w-4" />,          href: "/dashboard/partners",    keywords: ["investor","partner"] },
  { label: "Settings",   description: "Account & business",    icon: <Settings className="h-4 w-4" />,       href: "/dashboard/settings",    keywords: ["account","profile","theme"] },
];

const ACTIONS = [
  { label: "Add Cattle",           description: "Register a new animal",              icon: <Plus className="h-4 w-4" />,      href: "/dashboard/cattle?open=add",        keywords: ["new cow","register animal"] },
  { label: "Bulk Weigh Cattle",    description: "Record weights for multiple cattle", icon: <Scale className="h-4 w-4" />,     href: "/dashboard/cattle?open=bulk-weigh", keywords: ["weight","bulk","weigh"] },
  { label: "Add Feed Item",        description: "Add a new inventory item",           icon: <Plus className="h-4 w-4" />,      href: "/dashboard/inventory?open=add",     keywords: ["new item","new stock"] },
  { label: "Daily Feed Deduction", description: "Log today's feed consumption",       icon: <Zap className="h-4 w-4" />,       href: "/dashboard/inventory",              keywords: ["daily","deduct","consumption"] },
  { label: "Add Cost Entry",       description: "Record a fixed or variable cost",    icon: <DollarSign className="h-4 w-4" />,href: "/dashboard/finance",                keywords: ["cost","expense","fixed","variable"] },
  { label: "Budget Forecast",      description: "View 30-day cash & production plan", icon: <TrendingUp className="h-4 w-4" />,href: "/dashboard/finance",                keywords: ["budget","forecast","plan"] },
];

function matchQuery(q: string, label: string, description: string, keywords: string[]) {
  return (
    label.toLowerCase().includes(q) ||
    description.toLowerCase().includes(q) ||
    keywords.some((k) => k.toLowerCase().includes(q))
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [cattleList, setCattleList] = useState<CattleResult[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  // Lazy-fetch cattle once on first open
  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      const supabase = createClient();
      supabase
        .from("cattle")
        .select("id, tag_id, status")
        .is("deleted_at", null)
        .order("tag_id", { ascending: true })
        .then(({ data }) => {
          if (data) setCattleList(data as CattleResult[]);
        });
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const filteredActions = useMemo(() => q
    ? ACTIONS.filter((a) => matchQuery(q, a.label, a.description, a.keywords))
    : ACTIONS, [q]);

  const filteredCattle = useMemo(() => q
    ? cattleList.filter((c) => c.tag_id.toLowerCase().includes(q))
    : [], [q, cattleList]);

  const filteredPages = useMemo(() => q
    ? PAGES.filter((p) => matchQuery(q, p.label, p.description, p.keywords))
    : PAGES, [q]);

  // Flat list for keyboard navigation (actions â†' cattle â†' pages)
  const navItems = useMemo<NavItem[]>(() => [
    ...filteredActions.map((a) => ({ kind: "go" as const, label: a.label, description: a.description, icon: a.icon, href: a.href })),
    ...filteredCattle.map((c) => ({ kind: "cattle" as const, c })),
    ...filteredPages.map((p) => ({ kind: "go" as const, label: p.label, description: p.description, icon: p.icon, href: p.href })),
  ], [filteredActions, filteredCattle, filteredPages]);

  // Section base indices for rendering
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
      if (item.kind === "go") router.push(item.href);
      else router.push(`/dashboard/cattle/${item.c.id}`);
      close();
    },
     
    [navItems, router, close]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, navItems.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter")     { executeAt(selected); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, navItems.length, selected, executeAt]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;

  const ItemRow = ({ item, navIdx }: { item: NavItem; navIdx: number }) => {
    const active = selected === navIdx;
    const base = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`;
    const iconCls = `shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground"}`;
    const chevronCls = `h-3.5 w-3.5 shrink-0 ${active ? "text-primary-foreground/50" : "text-muted-foreground/50"}`;

    if (item.kind === "cattle") {
      const { c } = item;
      return (
        <button className={base} onClick={() => executeAt(navIdx)} onMouseEnter={() => setSelected(navIdx)}>
          <span className={iconCls}><Beef className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-none">Cattle #{c.tag_id}</p>
            <p className={cn("mt-0.5 text-xs capitalize", active ? "text-primary-foreground/70" : (STATUS_COLOR[c.status] ?? "text-muted-foreground"))}>
              {c.status}
            </p>
          </div>
          <ChevronRight className={chevronCls} />
        </button>
      );
    }

    return (
      <button className={base} onClick={() => executeAt(navIdx)} onMouseEnter={() => setSelected(navIdx)}>
        <span className={iconCls}>{item.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-none">{item.label}</p>
          <p className={cn("mt-0.5 text-xs", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {item.description}
          </p>
        </div>
        <ChevronRight className={chevronCls} />
      </button>
    );
  };

  const hasResults = navItems.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-card shadow-floating border border-border/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cattle tag, navigate, or run action…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {!hasResults ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found</p>
          ) : (
            <>
              {filteredActions.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Actions
                  </p>
                  {filteredActions.map((a, i) => (
                    <ItemRow
                      key={a.href + a.label}
                      item={{ kind: "go", label: a.label, description: a.description, icon: a.icon, href: a.href }}
                      navIdx={actionBase + i}
                    />
                  ))}
                </div>
              )}

              {filteredCattle.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cattle
                  </p>
                  {filteredCattle.map((c, i) => (
                    <ItemRow
                      key={c.id}
                      item={{ kind: "cattle", c }}
                      navIdx={cattleBase + i}
                    />
                  ))}
                </div>
              )}

              {filteredPages.length > 0 && (
                <div>
                  <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pages
                  </p>
                  {filteredPages.map((p, i) => (
                    <ItemRow
                      key={p.href}
                      item={{ kind: "go", label: p.label, description: p.description, icon: p.icon, href: p.href }}
                      navIdx={pageBase + i}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span><kbd className="font-mono">&uarr;&darr;</kbd> Navigate</span>
          <span><kbd className="font-mono">&crarr;</kbd> Go</span>
          <span><kbd className="font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
