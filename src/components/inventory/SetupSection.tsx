"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";

export function SetupSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const tr = t.inventory.setup;

  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-card transition-all">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-muted text-muted-foreground">
            <Settings2 className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground">{tr.heading}</span>
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">— {tr.subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
          <span>{open ? tr.hide : tr.show}</span>
          {open
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/70 p-5 space-y-8 bg-muted/5">
          {children}
        </div>
      )}
    </div>
  );
}
