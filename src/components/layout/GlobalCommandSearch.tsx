"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Beef, LayoutDashboard, Package, BarChart3, Settings,
  Plus, Scale, Zap, DollarSign, Store, Users, FileText, Clock, X, ArrowRight, Sparkles
} from "lucide-react";
import { useShell } from "./ShellContext";
import { createClient } from "@/lib/supabase/client";

interface Entry {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  keywords: string[];
  badge?: string;
}

const PAGES: Entry[] = [
  { id: "p-1", title: "Dashboard Overview", subtitle: "Live KPIs & farm metrics", category: "pages", icon: LayoutDashboard, href: "/dashboard", keywords: ["home","main"] },
  { id: "p-2", title: "Cattle Registry", subtitle: "Animal records, tags & weights", category: "livestock", icon: Beef, href: "/dashboard/cattle", keywords: ["cow","bull","cattle"] },
  { id: "p-3", title: "Feed & Inventory", subtitle: "Stock levels & consumption", category: "inventory", icon: Package, href: "/dashboard/inventory", keywords: ["feed","stock","ration"] },
  { id: "p-4", title: "Financial Ledger", subtitle: "Expenses, income & cash flow", category: "finance", icon: BarChart3, href: "/dashboard/finance", keywords: ["profit","loss","expense"] },
  { id: "p-5", title: "Partners & Investors", subtitle: "Syndication shares & payouts", category: "finance", icon: Users, href: "/dashboard/partners", keywords: ["investor","partner"] },
  { id: "p-6", title: "Vendors & Suppliers", subtitle: "Feed vendors & suppliers", category: "inventory", icon: Store, href: "/dashboard/vendors", keywords: ["supplier","vendor"] },
  { id: "p-7", title: "Enterprise Reports", subtitle: "Analytics & export engine", category: "reports", icon: FileText, href: "/dashboard/report", keywords: ["report","export"] },
  { id: "p-8", title: "Settings & Setup", subtitle: "Farm config & security", category: "pages", icon: Settings, href: "/dashboard/settings", keywords: ["setting","config"] },
  { id: "p-9", title: "Commerce Hub", subtitle: "Purchases, sales & logistics", category: "commerce", icon: Store, href: "/dashboard/commerce", keywords: ["commerce","purchase","sale","invoice"] },
  { id: "p-10", title: "Compliance & Protocols", subtitle: "Biosecurity & audit trail", category: "compliance", icon: FileText, href: "/dashboard/compliance", keywords: ["compliance","protocol","audit"] },
  { id: "p-11", title: "Notifications & Alerts", subtitle: "Push alerts & reminders", category: "pages", icon: Clock, href: "/dashboard/notifications", keywords: ["notifications","alerts","push"] },
  { id: "p-12", title: "Operations Dashboard", subtitle: "Daily tasks & workflows", category: "pages", icon: Clock, href: "/dashboard/operations", keywords: ["operations","daily","workflow"] },
  { id: "p-13", title: "Accounting & Ledger", subtitle: "General ledger & financial statements", category: "finance", icon: FileText, href: "/dashboard/accounting", keywords: ["accounting","ledger","journal","balance sheet"] },
  { id: "a-1", title: "Register Cattle", subtitle: "Add animal tag & breed", category: "actions", icon: Plus, href: "/dashboard/cattle?open=add", keywords: ["new cow","add cattle"], badge: "Create" },
  { id: "a-2", title: "Log Weight Update", subtitle: "Batch weight measurement", category: "actions", icon: Scale, href: "/dashboard/cattle?open=bulk-weigh", keywords: ["weight","scale"], badge: "Action" },
  { id: "a-3", title: "Receive Feed Stock", subtitle: "Record feed procurement", category: "actions", icon: Plus, href: "/dashboard/inventory?open=add", keywords: ["feed in","stock"], badge: "Create" },
  { id: "a-4", title: "Daily Feed Deduction", subtitle: "Log ration consumption", category: "actions", icon: Zap, href: "/dashboard/inventory", keywords: ["daily feed","ration"], badge: "Action" },
  { id: "a-5", title: "Record Expense", subtitle: "Log farm or medical cost", category: "actions", icon: DollarSign, href: "/dashboard/finance", keywords: ["expense","cost"], badge: "Finance" },
];

export function GlobalCommandSearch() {
  const { isCommandOpen, setCommandOpen } = useShell();
  const [query, setQuery] = useState("");
  const [cattle, setCattle] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("tanvir_recent_searches_v2");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) setRecent(JSON.parse(s).slice(0, 5));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isCommandOpen) return;
    async function loadCattle() {
      try {
        const { data } = await createClient().from("cattle").select("id, tag_id, status, breed").limit(20);
        if (data) {
          setCattle(data.map((c) => ({
            id: `c-${c.id}`,
            title: `Cattle #${c.tag_id}`,
            subtitle: `${c.breed || "Cross"} • ${c.status || "active"}`,
            category: "livestock",
            icon: Beef,
            href: `/dashboard/cattle?selected=${c.id}`,
            keywords: [c.tag_id, c.breed || "", "cow"],
            badge: (c.status || "ACTIVE").toUpperCase(),
          })));
        }
      } catch {}
    }
    loadCattle();
  }, [isCommandOpen]);

  useEffect(() => {
    if (isCommandOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandOpen]);

  const allItems = useMemo(() => [...PAGES, ...cattle], [cattle]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 10);
    return allItems.filter((it) => it.title.toLowerCase().includes(q) || it.keywords.some((k) => k.toLowerCase().includes(q)));
  }, [allItems, query]);

  const selectItem = useCallback((it: Entry) => {
    if (query.trim()) {
      try {
        const next = [query.trim(), ...recent.filter((r) => r.toLowerCase() !== query.trim().toLowerCase())].slice(0, 5);
        setRecent(next);
        localStorage.setItem("tanvir_recent_searches_v2", JSON.stringify(next));
      } catch {}
    }
    setCommandOpen(false);
    router.push(it.href);
  }, [query, recent, router, setCommandOpen]);

  useEffect(() => {
    if (!isCommandOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setCommandOpen(false); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((p) => (p < items.length - 1 ? p + 1 : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((p) => (p > 0 ? p - 1 : items.length - 1)); }
      else if (e.key === "Enter" && items[selectedIdx]) { e.preventDefault(); selectItem(items[selectedIdx]); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isCommandOpen, items, selectedIdx, selectItem, setCommandOpen]);

  if (!isCommandOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 px-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) setCommandOpen(false); }}
    >
      <div className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[75vh]">
        <div className="flex items-center px-4 py-3 border-b border-border/60 bg-muted/20">
          <Search className="h-4 w-4 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search pages, cattle tags, inventory, finances... (↑↓ to navigate)"
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && <button onClick={() => setQuery("")} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="h-3.5 w-3.5" /></button>}
        </div>

        {!query && recent.length > 0 && (
          <div className="px-4 py-2 border-b border-border/40 bg-muted/10 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-muted-foreground/60 flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" /> Recent:</span>
            {recent.map((r, i) => (
              <button key={i} onClick={() => { setQuery(r); setSelectedIdx(0); }} className="px-2 py-0.5 rounded-full bg-muted text-foreground/80 hover:text-foreground text-xs font-medium shrink-0">
                {r}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Sparkles className="h-6 w-6 mx-auto mb-1 opacity-40 animate-pulse" />
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            items.map((it, idx) => {
              const Icon = it.icon;
              const active = idx === selectedIdx;
              return (
                <div
                  key={it.id}
                  onClick={() => selectItem(it)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate leading-tight">{it.title}</span>
                        {it.badge && <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/40">{it.badge}</span>}
                      </div>
                      {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
                    </div>
                  </div>
                  <ArrowRight className={`h-3.5 w-3.5 ml-2 ${active ? "text-primary" : "text-muted-foreground/30"}`} />
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span><kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px]">↑↓</kbd> Move  <kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px] ml-2">↵</kbd> Select  <kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px] ml-2">Esc</kbd> Exit</span>
          <span className="hidden sm:inline text-[11px]">Tanvir Agro Command</span>
        </div>
      </div>
    </div>
  );
}
