"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";

/** `icon` is a rendered element (<Receipt />): a component function cannot cross from a server page to this client component. */
export type MoneyTab = { value: string; bn: string; en: string; icon: React.ReactNode; count?: number; content: React.ReactNode };

/** The Money page's sections; the open one is kept in the URL (?tab=) so a link or reload lands on it. */
export function MoneyTabs({ tabs }: { tabs: MoneyTab[] }) {
  const L = useL();
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("tab");
  const [active, setActive] = useState(tabs.some((t) => t.value === fromUrl) ? fromUrl! : tabs[0].value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (fromUrl && tabs.some((t) => t.value === fromUrl)) setActive(fromUrl); }, [fromUrl, tabs]);

  function open(v: string) {
    setActive(v);
    const q = new URLSearchParams(params.toString());
    if (v === tabs[0].value) q.delete("tab"); else q.set("tab", v);
    router.replace(`?${q.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={L("টাকা-পয়সার অংশ", "Money sections")} className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 scrollbar-none">
        {tabs.map(({ value, bn, en, icon, count }) => (
          <button key={value} type="button" role="tab" aria-selected={active === value} onClick={() => open(value)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <span className="[&>svg]:h-4 [&>svg]:w-4" aria-hidden>{icon}</span>{L(bn, en)}
            {count != null && count > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.value} role="tabpanel" hidden={active !== t.value}>{active === t.value && t.content}</div>
      ))}
    </div>
  );
}
