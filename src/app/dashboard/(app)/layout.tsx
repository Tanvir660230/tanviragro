import { Suspense } from "react";
import type { Metadata } from "next";
import { AppSidebarWrapper } from "@/components/shared/AppSidebarWrapper";
import { BottomNavWrapper } from "@/components/shared/BottomNavWrapper";
import { TopBar } from "@/components/shared/TopBar";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { AppShell } from "@/components/layout/AppShell";
import { FeedAutoSync } from "@/components/shared/FeedAutoSync";
import { SectionSubNav } from "@/components/navigation/SectionSubNav";

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
    <AppShell
      sidebar={
        <Suspense
          fallback={
            <div className="hidden md:flex h-svh md:w-52 lg:w-60 flex-col bg-sidebar border-r border-sidebar-border/60 sticky top-0 shrink-0">
              <div className="h-14 border-b border-sidebar-border/50 animate-shimmer overflow-hidden" />
              <div className="flex-1 p-3 space-y-2 pt-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-9 rounded-xl animate-shimmer overflow-hidden" />
                ))}
              </div>
            </div>
          }
        >
          <AppSidebarWrapper />
        </Suspense>
      }
      header={
        <Suspense
          fallback={
            <div className="h-14 border-b border-border/60 bg-background/80 backdrop-blur-md animate-shimmer shrink-0" />
          }
        >
          <TopBar />
        </Suspense>
      }
      bottomNav={
        <Suspense
          fallback={
            <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border/60 flex items-center justify-around h-14 safe-bottom">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 w-10 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          }
        >
          <BottomNavWrapper />
        </Suspense>
      }
    >
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20 sm:pt-6 sm:pb-16 space-y-6">
        <Suspense
          fallback={<div className="h-5 w-44 rounded-lg bg-muted/40 animate-shimmer mb-4" />}
        >
          <Breadcrumb />
        </Suspense>
        {/* the section's pages (from the site map) — the same on every page of a section */}
        <SectionSubNav />
        {children}
      </div>

      {/* Feed in use: post the automatic daily deduction when a day is due */}
      <Suspense fallback={null}>
        <FeedAutoSync />
      </Suspense>

      {/* Realtime auto-refresher when Supabase DB changes */}
      <RealtimeRefresher />

      {/* Offline sync queue banner */}
      <OfflineBanner />
    </AppShell>
  );
}

