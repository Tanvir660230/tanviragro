import { Suspense } from "react";
import type { Metadata } from "next";
import { AppSidebarWrapper } from "@/components/shared/AppSidebarWrapper";
import { BottomNavWrapper } from "@/components/shared/BottomNavWrapper";
import { TopBar } from "@/components/shared/TopBar";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { OfflineBanner } from "@/components/shared/OfflineBanner";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | Tanvir Agro",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh bg-background relative">
      {/* Skip navigation for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <Suspense fallback={
        <div className="hidden md:flex h-svh md:w-48 lg:w-56 flex-col bg-sidebar border-r border-sidebar-border/60 sticky top-0 shrink-0">
          <div className="h-14 border-b border-sidebar-border/50 animate-shimmer overflow-hidden" />
          <div className="flex-1 p-3 space-y-2 pt-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded-lg animate-shimmer overflow-hidden" />)}
          </div>
        </div>
      }>
        <AppSidebarWrapper />
      </Suspense>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <Suspense fallback={<div className="h-14 border-b border-border bg-card animate-pulse shrink-0" />}>
          <TopBar />
        </Suspense>
        <main id="main-content" className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          <Suspense fallback={<div className="h-5 w-48 rounded bg-muted/40 animate-pulse mb-4" />}>
            <Breadcrumb />
          </Suspense>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <Suspense fallback={
        <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar/95 border-t border-sidebar-border/60 flex items-center justify-around h-14">
          {[...Array(5)].map((_, i) => <div key={i} className="h-8 w-10 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      }>
        <BottomNavWrapper />
      </Suspense>

      {/* Realtime: auto-refresh Server Components when DB changes */}
      <RealtimeRefresher />

      {/* Offline queue banner */}
      <OfflineBanner />

    </div>
  );
}
