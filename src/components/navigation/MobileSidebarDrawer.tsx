"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";
import type { ExtendedUserRole } from "@/constants/roles";
import { useShell } from "@/components/layout/ShellContext";
import { BrandMark } from "./BrandMark";
import { SidebarNav, SidebarUserCard } from "./SidebarNav";

interface MobileSidebarDrawerProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
}

/** The phone menu (☰): the same menu as the desktop sidebar, in a drawer. */
export function MobileSidebarDrawer({ isAdmin = true, role = "owner", business, userEmail }: MobileSidebarDrawerProps) {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  const { isMobileDrawerOpen, setMobileDrawerOpen } = useShell();
  const close = () => setMobileDrawerOpen(false);
  const bizName = business?.name ?? "Tanvir Agro";

  // close on navigation and on Escape
  useEffect(() => { setMobileDrawerOpen(false); }, [pathname, setMobileDrawerOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMobileDrawerOpen]);

  if (!isMobileDrawerOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={locale === "bn" ? "মেনু" : "Menu"} className="fixed inset-0 z-[60] flex md:hidden">
      <button type="button" aria-label={locale === "bn" ? "বন্ধ করুন" : "Close"} onClick={close} className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150" />
      <aside className="relative flex h-full w-[84%] max-w-[320px] flex-col bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200 safe-bottom">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
          <BrandMark logoUrl={business?.logo_url} name={bizName} size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-base font-bold tracking-tight text-sidebar-foreground">{bizName}</p>
            <p className="truncate text-xs text-sidebar-foreground/50">{locale === "bn" ? "খামার ব্যবস্থাপনা" : "Farm management"}</p>
          </div>
          <button type="button" onClick={close} aria-label={locale === "bn" ? "বন্ধ করুন" : "Close"}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>
        <SidebarNav role={role} isAdmin={isAdmin} onNavigate={close} />
        <SidebarUserCard email={userEmail} role={role} />
      </aside>
    </div>
  );
}
