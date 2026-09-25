import React from 'react';
import { ExtendedUserRole } from '@/constants/roles';
import { SITE, GROUP_LABELS, tr, type Label } from './site-map';

export interface NavItemDef {
  id: string;
  labelKey?: string;
  defaultLabel: string;
  /** Bangla / English label from the site map */
  label?: Label;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'neutral';
  adminOnly?: boolean;
  requiredPermission?: any;
  requiredRoles?: ExtendedUserRole[];
  keywords?: string[];
  children?: NavItemDef[];
}

export interface NavGroupDef {
  id: string;
  groupLabelKey?: string;
  defaultGroupLabel?: string;
  groupLabel?: Label;
  collapsible?: boolean;
  defaultOpen?: boolean;
  isQuickAccess?: boolean;
  items: NavItemDef[];
}

/** The sidebar, built from THE site map (site-map.ts): the same sections everywhere. */
export const ENTERPRISE_NAV_CONFIG: NavGroupDef[] = (["daily", "money", "system"] as const).map((g) => ({
  id: g,
  defaultGroupLabel: GROUP_LABELS[g].en,
  groupLabel: GROUP_LABELS[g],
  collapsible: false,
  defaultOpen: true,
  items: SITE.filter((s) => s.group === g).map((s) => ({
    id: s.id,
    defaultLabel: s.label.en,
    label: s.label,
    href: s.href,
    icon: s.icon,
    adminOnly: s.adminOnly,
    requiredPermission: s.requiredPermission,
    keywords: s.keywords,
    children: s.pages.length > 1
      ? s.pages.map((p) => ({ id: `${s.id}:${p.href}`, defaultLabel: p.label.en, label: p.label, href: p.href, icon: p.icon, keywords: p.keywords }))
      : undefined,
  })),
}));

/** Label in the viewer's language (site-map label first). */
export function navLabel(item: Pick<NavItemDef, 'label' | 'defaultLabel'>, locale: string | undefined): string {
  return item.label ? tr(item.label, locale) : item.defaultLabel;
}
export function navGroupLabel(group: Pick<NavGroupDef, 'groupLabel' | 'defaultGroupLabel'>, locale: string | undefined): string {
  return group.groupLabel ? tr(group.groupLabel, locale) : group.defaultGroupLabel ?? '';
}

export function isNavActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export function getAllNavHrefs(groups: NavGroupDef[]): string[] {
  return groups.flatMap(g => g.items.map(i => i.href));
}

export function canUserAccessNavItem(
  item: NavItemDef,
  role: ExtendedUserRole = 'owner',
  isAdmin: boolean = true
): boolean {
  if (role === 'owner' || role === 'admin' || isAdmin) return true;
  if (item.requiredRoles && !item.requiredRoles.includes(role)) return false;
  if (item.adminOnly && !isAdmin && role !== 'manager') return false;
  return true;
}
