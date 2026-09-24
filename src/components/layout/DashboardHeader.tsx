"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Wrench, Menu, Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShell } from "./ShellContext";
import { GlobalCommandSearch } from "./GlobalCommandSearch";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { NotificationCenter } from "./NotificationCenter";
import { UserProfileMenu } from "./UserProfileMenu";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import type {
  HealthEvent,
  InventoryItem,
  LoanDueAlert,
  InsuranceAlert,
  UnweighedAlert,
} from "@/components/shared/SmartAlertsDropdown";

export interface DashboardHeaderAlerts {
  overdueHealth: HealthEvent[];
  upcomingHealth: HealthEvent[];
  lowStockItems: InventoryItem[];
  loansDue: LoanDueAlert[];
  insuranceExpiring: InsuranceAlert[];
  unweighedCattle: UnweighedAlert[];
}

export interface DashboardHeaderProps {
  business?: { id?: string; name?: string; logo_url?: string | null } | null;
  user?: { email?: string } | null;
  profile?: { full_name?: string | null; avatar_url?: string | null; role?: string | null } | null;
  alerts?: DashboardHeaderAlerts;
  showSearch?: boolean;
  showQuickCreate?: boolean;
  showNotifications?: boolean;
  showUtilityToggle?: boolean;
  showThemeToggle?: boolean;
  showUserMenu?: boolean;
  onToggleSidebar?: () => void;
  onToggleUtility?: () => void;
  isUtilityOpen?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function DashboardHeader({
  business,
  user,
  profile,
  alerts = {
    overdueHealth: [],
    upcomingHealth: [],
    lowStockItems: [],
    loansDue: [],
    insuranceExpiring: [],
    unweighedCattle: [],
  },
  showSearch = true,
  showQuickCreate = true,
  showNotifications = true,
  showUtilityToggle = true,
  showThemeToggle = true,
  showUserMenu = true,
  onToggleSidebar,
  onToggleUtility,
  isUtilityOpen = false,
  className,
  children,
}: DashboardHeaderProps) {
  const {
    setCommandOpen,
    setShortcutsModalOpen,
    toggleUtilityPanel,
    isUtilityOpen: shellUtilityOpen,
    setMobileDrawerOpen,
  } = useShell();

  const bizName = business?.name ?? "Tanvir Agro";
  const bizLogo = business?.logo_url;
  const userEmail = user?.email ?? "";

  const handleUtilityToggle = onToggleUtility || toggleUtilityPanel;
  const handleSidebarToggle = onToggleSidebar || (() => setMobileDrawerOpen(true));
  const utilityActive = isUtilityOpen || shellUtilityOpen;

  return (
    <>
      <header
        role="banner"
        className={cn(
          "sticky top-0 z-40 flex h-14 items-center justify-between gap-2 sm:gap-3 border-b border-border/60 bg-background/80 backdrop-blur-xl px-3 sm:px-4 lg:px-6 shadow-xs transition-all",
          className
        )}
      >
        {/* LEFT: Logo / Brand, Sidebar Toggle, Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-label="Toggle Navigation Drawer"
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>


          <div className="flex items-center gap-2 md:hidden">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 overflow-hidden shrink-0 shadow-xs">
              {bizLogo ? (
                <Image src={bizLogo} alt={bizName} fill sizes="32px" className="object-cover" />
              ) : (
                <span className="text-base leading-none">🌿</span>
              )}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-foreground truncate max-w-[120px]">
              {bizName}
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Enterprise Online</span>
          </div>
        </div>

        {/* CENTER: Global Search Trigger Bar */}
        {showSearch && (
          <div className="flex min-w-0 flex-1 justify-end sm:justify-start max-w-md mx-1 sm:mx-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Search and command palette (Ctrl+K)"
              className="flex w-9 sm:w-full items-center justify-center sm:justify-between gap-2 h-9 px-0 sm:px-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground text-xs font-medium transition-all shadow-2xs group focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="hidden sm:inline truncate">Search cattle, feed, financials, reports...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-background border border-border/70 text-muted-foreground shrink-0 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* RIGHT: Quick Create, Notifications, Tools, Help, Theme, User */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {children}

          {showQuickCreate && <QuickCreateMenu />}

          {showNotifications && (
            <NotificationCenter
              overdueHealth={alerts.overdueHealth}
              upcomingHealth={alerts.upcomingHealth}
              lowStockItems={alerts.lowStockItems}
              loansDue={alerts.loansDue}
              insuranceExpiring={alerts.insuranceExpiring}
              unweighedCattle={alerts.unweighedCattle}
            />
          )}

          {showUtilityToggle && (
            <button
              type="button"
              onClick={() => handleUtilityToggle()}
              aria-label="Toggle Farm Utility Tools (Calculator & Notes)"
              aria-pressed={utilityActive}
              className={cn(
                "hidden sm:flex h-9 w-9 items-center justify-center rounded-xl transition-all border cursor-pointer",
                utilityActive
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title="Farm Utility Tools (Ctrl+J)"
            >
              <Wrench className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            aria-label="Keyboard Shortcuts (Ctrl+/)"
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
            title="Keyboard Shortcuts Guide (Ctrl+/)"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {showThemeToggle && <ThemeToggle compact />}

          <div className="w-px h-4 bg-border/60 mx-0.5 hidden sm:block" />

          {showUserMenu && <UserProfileMenu email={userEmail} profile={profile} />}
        </div>
      </header>

      {/* Global Command Palette Dialog */}
      <GlobalCommandSearch />
    </>
  );
}
