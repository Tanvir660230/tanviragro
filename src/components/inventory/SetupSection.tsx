"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";

export function SetupSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const tr = t.inventory.setup;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{tr.heading}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">— {tr.subtitle}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{open ? tr.hide : tr.show}</span>
          {open
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-8">
          {children}
        </div>
      )}
    </div>
  );
}
