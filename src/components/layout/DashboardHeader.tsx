"use client";

import React from "react";
import { Wrench, Menu, Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShell } from "./ShellContext";
import { useTranslation } from "@/i18n/I18nProvider";
import { GlobalCommandSearch } from "./GlobalCommandSearch";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { NotificationCenter } from "./NotificationCenter";
import { UserProfileMenu } from "./UserProfileMenu";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { BrandMark } from "@/components/navigation/BrandMark";
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
  const { locale } = useTranslation();
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
          "sticky top-0 z-40 flex h-14 items-center justify-between gap-2 sm:gap-3 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 px-2.5 sm:px-4 lg:px-6",
          className
        )}
      >
        {/* LEFT: Logo / Brand, Sidebar Toggle, Status */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-label={locale === "bn" ? "মেনু খুলুন" : "Open menu"}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* phones: the farm, since the sidebar (which names it on a computer) is hidden */}
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <BrandMark logoUrl={bizLogo} name={bizName} size={30} />
            <span className="truncate text-[0.95rem] font-bold tracking-tight text-foreground max-w-[34vw]">{bizName}</span>
          </div>

        </div>

        {/* CENTER: Global Search Trigger Bar */}
        {showSearch && (
          <div className="flex min-w-0 flex-1 justify-end md:justify-start md:max-w-md mx-0.5 sm:mx-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Search and command palette (Ctrl+K)"
              className="flex w-10 md:w-full items-center justify-center md:justify-between gap-2 h-10 md:h-9 px-0 md:px-3 rounded-xl md:border md:border-border/70 md:bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground text-sm md:text-xs font-medium transition-all group focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="h-[18px] w-[18px] md:h-3.5 md:w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="hidden md:inline truncate">{locale === "bn" ? "গরু, পাতা বা কাজ খুঁজুন…" : "Search cattle, pages or actions…"}</span>
              </div>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-background border border-border/70 text-muted-foreground shrink-0 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* RIGHT: Quick Create, Notifications, Tools, Help, Theme, User */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
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

          {/* on phones the theme is in the profile menu */}
          {showThemeToggle && <div className="hidden sm:block"><ThemeToggle compact /></div>}

          <div className="w-px h-4 bg-border/60 mx-0.5 hidden sm:block" />

          {showUserMenu && <UserProfileMenu email={userEmail} profile={profile} />}
        </div>
      </header>

      {/* Global Command Palette Dialog */}
      <GlobalCommandSearch />
    </>
  );
}
