"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Auto", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // Smooth color transitions when theme changes
    const style = document.documentElement.style;
    style.transition = "background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease";
    return () => { style.transition = ""; };
  }, []);

  if (!mounted) {
    if (compact) return <div className="h-8 w-8" />;
    return <div className="h-9 w-24 rounded-lg bg-muted p-1" />;
  }

  if (compact) {
    // Single icon button that cycles through themes
    const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[1];
    const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length];
    const Icon = current.icon;
    return (
      <button
        onClick={() => setTheme(next.value)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title={`Switch to ${next.label} mode`}
        aria-label="Toggle theme"
      >
        <Icon className="h-[18px] w-[18px] transition-transform duration-300" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            theme === value
              ? "bg-background text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
