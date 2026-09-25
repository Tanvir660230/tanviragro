"use client";

import { WIZARD_TEMPLATES, type WizardTemplate } from "@/lib/validation/cattle-wizard";
import { Sparkles, Beef, Milk, Baby } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useL } from "@/i18n/text";

interface Props {
  onSelect: (template: WizardTemplate) => void;
}

export function WizardTemplateSelector({ onSelect }: Props) {
  const L = useL();
  const getIcon = (id: string) => {
    switch (id) {
      case "fattening_bull":
        return <Beef className="h-4 w-4 text-amber-500" />;
      case "qurbani_prime":
        return <Sparkles className="h-4 w-4 text-emerald-500" />;
      case "dairy_heifer":
        return <Milk className="h-4 w-4 text-blue-500" />;
      case "farm_born_calf":
        return <Baby className="h-4 w-4 text-purple-500" />;
      default:
        return <Beef className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{L("দ্রুত পূরণ", "Quick fill")}</span>
        </div>
        <Badge variant="outline" className="text-[10px] bg-background/50">
          {L("চাপলে নিজে পূরণ হবে", "Click to auto-populate")}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {WIZARD_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onSelect(tmpl)}
            className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/50 text-left transition-all group"
          >
            <div className="flex items-center gap-1.5 w-full">
              {getIcon(tmpl.id)}
              <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {tmpl.name}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
              {tmpl.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
