'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftOpen, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/app/(auth)/login/actions';
import { ENTERPRISE_NAV_CONFIG, canUserAccessNavItem, navLabel } from './nav-config';
import { activeHref } from './site-map';
import { useTranslation } from '@/i18n/I18nProvider';
import { useShell } from '@/components/layout/ShellContext';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { ExtendedUserRole } from '@/constants/roles';
import { BrandMark } from './BrandMark';

interface SidebarCollapsedProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
  className?: string;
}

/** The narrow sidebar: icons with their names on hover, the same menu and role filter as the wide one. */
export function SidebarCollapsed({ isAdmin = true, role = 'owner', business, className }: SidebarCollapsedProps) {
  const { toggleSidebar } = useShell();
  const { locale } = useTranslation();
  const pathname = usePathname() ?? '';
  const current = activeHref(pathname);
  const bizName = business?.name ?? 'Tanvir Agro';
  const groups = ENTERPRISE_NAV_CONFIG
    .map((g) => ({ ...g, items: g.items.filter((i) => canUserAccessNavItem(i, role, isAdmin)) }))
    .filter((g) => g.items.length > 0);

  return (
    <TooltipProvider delay={100}>
      <aside className={cn('flex h-svh w-16 flex-col items-center border-r border-sidebar-border bg-sidebar', className)}>
        <div className="flex h-14 w-full shrink-0 items-center justify-center border-b border-sidebar-border">
          <BrandMark logoUrl={business?.logo_url} name={bizName} size={34} />
        </div>

        <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-3" aria-label={locale === 'bn' ? 'মেনু' : 'Menu'}>
          {groups.map((g, gi) => (
            <div key={g.id} className={cn('flex flex-col items-center gap-1', gi > 0 && 'mt-2 border-t border-sidebar-border/70 pt-3')}>
              {g.items.map((item) => {
                const on = current === item.href || (item.children ?? []).some((c) => c.href === current);
                const Icon = item.icon;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger
                      render={
                        <Link href={item.href} aria-label={navLabel(item, locale)} aria-current={on ? 'page' : undefined}
                          className={cn(
                            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                            on ? 'bg-sidebar-primary/10 text-sidebar-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                          )} />
                      }
                    >
                      {on && <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden />}
                      <Icon className="h-[19px] w-[19px]" />
                    </TooltipTrigger>
                    <TooltipContent side="right">{navLabel(item, locale)}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex w-full flex-col items-center gap-1 border-t border-sidebar-border py-3">
          <button type="button" onClick={toggleSidebar} aria-label={locale === 'bn' ? 'মেনু বড় করুন' : 'Expand sidebar'} title={locale === 'bn' ? 'মেনু বড় করুন (Ctrl+B)' : 'Expand (Ctrl+B)'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
          <form action={logout}>
            <button type="submit" aria-label={locale === 'bn' ? 'লগ আউট' : 'Log out'} title={locale === 'bn' ? 'লগ আউট' : 'Log out'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </aside>
    </TooltipProvider>
  );
}
