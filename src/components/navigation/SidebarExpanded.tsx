'use client';

import { PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';
import { useShell } from '@/components/layout/ShellContext';
import type { ExtendedUserRole } from '@/constants/roles';
import { BrandMark } from './BrandMark';
import { SidebarNav, SidebarUserCard } from './SidebarNav';

interface SidebarExpandedProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
  className?: string;
}

/** The desktop sidebar: the farm, the menu (by role), and who is signed in. */
export function SidebarExpanded({ isAdmin = true, role = 'owner', business, userEmail, className }: SidebarExpandedProps) {
  const { locale } = useTranslation();
  const { toggleSidebar } = useShell();
  const bizName = business?.name ?? 'Tanvir Agro';

  return (
    <aside className={cn('flex h-full flex-col border-r border-sidebar-border bg-sidebar', className)}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <BrandMark logoUrl={business?.logo_url} name={bizName} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[0.95rem] font-bold tracking-tight text-sidebar-foreground">{bizName}</p>
          <p className="truncate text-[11px] text-sidebar-foreground/50">{locale === 'bn' ? 'খামার ব্যবস্থাপনা' : 'Farm management'}</p>
        </div>
        <button type="button" onClick={toggleSidebar} title={locale === 'bn' ? 'মেনু ছোট করুন (Ctrl+B)' : 'Collapse (Ctrl+B)'}
          aria-label={locale === 'bn' ? 'মেনু ছোট করুন' : 'Collapse sidebar'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <SidebarNav role={role} isAdmin={isAdmin} />
      <SidebarUserCard email={userEmail} role={role} />
    </aside>
  );
}
