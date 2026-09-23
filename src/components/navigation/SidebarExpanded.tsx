'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';
import { logout } from '@/app/(auth)/login/actions';
import {
  ENTERPRISE_NAV_CONFIG,
  isNavActive,
} from './nav-config';
import { ExtendedUserRole, ROLE_BADGE_STYLE } from '@/constants/roles';
import { useShell } from '@/components/layout/ShellContext';

interface SidebarExpandedProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
  className?: string;
}

export function SidebarExpanded({
  isAdmin = true,
  role = 'owner',
  business,
  userEmail,
  className,
}: SidebarExpandedProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const roleBadgeStyle = ROLE_BADGE_STYLE[role] || ROLE_BADGE_STYLE.viewer;
  const bizName = business?.name ?? 'Tanvir Agro';

  return (
    <aside className={cn('flex flex-col h-full bg-sidebar border-r border-sidebar-border', className)}>
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-sm font-bold text-sidebar-foreground">{bizName}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {ENTERPRISE_NAV_CONFIG.map((group) => (
          <div key={group.id} className="space-y-1">
            {group.defaultGroupLabel && (
              <h2 className="px-2 text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-wider">
                {group.defaultGroupLabel}
              </h2>
            )}
            {group.items.map((item) => {
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm',
                    active 
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.defaultLabel}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-3 border-t border-sidebar-border/40">
        <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sidebar-foreground truncate">
                {userEmail || 'System User'}
            </span>
          <form action={logout}>
            <button type="submit" className="p-1.5 text-sidebar-foreground/50 hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
