'use client';

import Link from 'next/link';
import { PanelLeftOpen, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/app/(auth)/login/actions';
import { ENTERPRISE_NAV_CONFIG, isNavActive, navLabel } from './nav-config';
import { useTranslation } from '@/i18n/I18nProvider';
import { useShell } from '@/components/layout/ShellContext';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ExtendedUserRole } from '@/constants/roles';

interface SidebarCollapsedProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
  className?: string;
}

export function SidebarCollapsed({
  isAdmin = true,
  role = 'owner',
  business,
  userEmail,
  className,
}: SidebarCollapsedProps) {
  const { toggleSidebar } = useShell();
  const { locale } = useTranslation();
  const bizName = business?.name ?? 'Tanvir Agro';

  return (
    <TooltipProvider delay={100}>
      <aside
        className={cn(
          'h-svh w-16 flex flex-col items-center bg-sidebar border-r border-sidebar-border py-4',
          className
        )}
      >
        <div className="pb-4 border-b border-sidebar-border/50 w-full px-2 flex justify-center">
            <span className="text-xs font-black uppercase text-sidebar-foreground">
                {bizName.slice(0, 2)}
            </span>
        </div>

        <nav className="flex-1 w-full space-y-2 py-4 px-2">
            {ENTERPRISE_NAV_CONFIG.flatMap(g => g.items).map(item => {
                const active = isNavActive(item.href, typeof window !== 'undefined' ? window.location.pathname : '');
                const Icon = item.icon;
                return (
                    <Tooltip key={item.id}>
                        <TooltipTrigger>
                            <Link
                                href={item.href}
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                                    active 
                                        ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                )}
                            >
                                <Icon className="h-5 w-5" />
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {navLabel(item, locale)}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </nav>

        <div className="pt-4 border-t border-sidebar-border/50 w-full px-2 flex flex-col items-center gap-2">
            <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent"
                aria-label="Expand"
            >
                <PanelLeftOpen className="h-5 w-5" />
            </button>
            <form action={logout}>
                <button type="submit" className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-destructive">
                    <LogOut className="h-5 w-5" />
                </button>
            </form>
        </div>
      </aside>
    </TooltipProvider>
  );
}
