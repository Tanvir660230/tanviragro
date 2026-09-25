"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./ShellContext";
import { X, Command } from "lucide-react";

export function AppShortcuts() {
  const router = useRouter();
  const {
    toggleSidebar,
    toggleUtilityPanel,
    setCommandOpen,
    isShortcutsModalOpen,
    setShortcutsModalOpen,
  } = useShell();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing inside an input/textarea
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      // Meta (⌘ / Ctrl) key combos
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setCommandOpen(true);
        } else if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          toggleSidebar();
        } else if (e.key.toLowerCase() === "j") {
          e.preventDefault();
          toggleUtilityPanel();
        } else if (e.key === "/") {
          e.preventDefault();
          setShortcutsModalOpen(true);
        }
      }

      // Alt Quick Jumps
      if (e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          router.push("/dashboard");
        } else if (e.key === "2") {
          e.preventDefault();
          router.push("/dashboard/cattle");
        } else if (e.key === "3") {
          e.preventDefault();
          router.push("/dashboard/inventory");
        } else if (e.key === "4") {
          e.preventDefault();
          router.push("/dashboard/finance");
        } else if (e.key === "5") {
          e.preventDefault();
          router.push("/dashboard/partners");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, toggleSidebar, toggleUtilityPanel, setCommandOpen, setShortcutsModalOpen]);

  if (!isShortcutsModalOpen) return null;

  const shortcutsList = [
    { key: "⌘ K / Ctrl+K", desc: "Omni-search & Command Palette" },
    { key: "⌘ B / Ctrl+B", desc: "Toggle Sidebar rail" },
    { key: "⌘ J / Ctrl+J", desc: "Toggle Right Utility Panel (Calc & Notes)" },
    { key: "⌘ / / Ctrl+/", desc: "Show Keyboard Shortcuts Guide" },
    { key: "Alt + 1", desc: "Jump to Overview Dashboard" },
    { key: "Alt + 2", desc: "Jump to Cattle Registry" },
    { key: "Alt + 3", desc: "Jump to Feed & Inventory" },
    { key: "Alt + 4", desc: "Jump to Financial Ledger" },
    { key: "Alt + 5", desc: "Jump to Partner Syndication" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
          <div className="flex items-center gap-2">
            <Command className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {shortcutsList.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs"
            >
              <span className="text-muted-foreground">{sc.desc}</span>
              <kbd className="px-2 py-1 bg-background border border-border rounded font-mono font-bold text-foreground">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
