"use client";

import React from "react";
import { ShellProvider, useShell } from "./ShellContext";
import { RightUtilityPanel } from "./RightUtilityPanel";
import { AppShortcuts } from "./AppShortcuts";
import { PageVisitTracker } from "@/hooks/use-page-tracking";
import { ScrollRestoration } from "@/hooks/use-scroll-restoration";
import { PageTransition } from "./PageTransition";
import { cn } from "@/lib/utils";

interface AppShellInnerProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  bottomNav?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function AppShellInner({
  children,
  sidebar,
  header,
  bottomNav,
  footer,
  className,
}: AppShellInnerProps) {
  const { isSidebarCollapsed } = useShell();

  return (
    <div
      className={cn(
        "flex min-h-svh bg-background text-foreground relative antialiased selection:bg-primary/20 selection:text-primary",
        className
      )}
    >
      <AppShortcuts />
      <PageVisitTracker />
      <ScrollRestoration />

      {/* Skip to main content accessibility link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-primary-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar rail / expanded */}
      {sidebar && (
        <div
          className={cn(
            "hidden md:block sticky top-0 h-svh shrink-0 transition-all duration-200 z-30",
            isSidebarCollapsed ? "w-16" : "w-56 lg:w-64"
          )}
        >
          {sidebar}
        </div>
      )}

      {/* Main app body */}
      <div className="flex flex-1 flex-col min-w-0">
        {header}
        <div className="flex flex-1 items-start min-w-0">
          <main id="main-content" className="flex-1 min-w-0">
            <PageTransition>{children}</PageTransition>
          </main>
          <RightUtilityPanel />
        </div>
        {footer && <footer className="shrink-0">{footer}</footer>}
      </div>

      {/* Mobile bottom navigation */}
      {bottomNav}
    </div>
  );
}

export function AppShell(props: AppShellInnerProps) {
  return (
    <ShellProvider>
      <AppShellInner {...props} />
    </ShellProvider>
  );
}
