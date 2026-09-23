"use client";

import React, { useEffect } from "react";
import { SidebarExpanded } from "@/components/navigation/SidebarExpanded";
import { SidebarCollapsed } from "@/components/navigation/SidebarCollapsed";
import { MobileSidebarDrawer } from "@/components/navigation/MobileSidebarDrawer";
import { useShell } from "@/components/layout/ShellContext";
import { ExtendedUserRole } from "@/constants/roles";

export interface AppSidebarProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
}

export function AppSidebar({
  isAdmin = true,
  role = "owner",
  business,
  userEmail,
}: AppSidebarProps) {
  const { isSidebarCollapsed, toggleSidebar } = useShell();

  // Global hotkey: Ctrl+B or Cmd+B to toggle sidebar collapsed mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <div className="hidden md:flex sticky top-0 h-svh shrink-0 z-30">
        {isSidebarCollapsed ? (
          <SidebarCollapsed
            isAdmin={isAdmin}
            role={role}
            business={business}
            userEmail={userEmail}
          />
        ) : (
          <SidebarExpanded
            isAdmin={isAdmin}
            role={role}
            business={business}
            userEmail={userEmail}
          />
        )}
      </div>

      {/* Mobile Screen Drawer */}
      <MobileSidebarDrawer
        isAdmin={isAdmin}
        role={role}
        business={business}
        userEmail={userEmail}
      />
    </>
  );
}

