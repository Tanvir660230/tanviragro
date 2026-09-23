import React from 'react';
import {
  LayoutDashboard,
  Beef,
  Package,
  Landmark,
  BookOpen,
  Users,
  Store,
  FileText,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  LifeBuoy,
  HeartPulse,
} from 'lucide-react';
import { ExtendedUserRole, PERMISSIONS } from '@/constants/roles';

export interface NavItemDef {
  id: string;
  labelKey?: string;
  defaultLabel: string;
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
  collapsible?: boolean;
  defaultOpen?: boolean;
  isQuickAccess?: boolean;
  items: NavItemDef[];
}

export const ENTERPRISE_NAV_CONFIG: NavGroupDef[] = [
  {
    id: 'core',
    defaultGroupLabel: 'Core',
    collapsible: false,
    defaultOpen: true,
    items: [
      {
        id: 'dashboard',
        labelKey: 'dashboard',
        defaultLabel: 'Overview',
        href: '/dashboard',
        icon: LayoutDashboard,
        keywords: ['home', 'stats', 'kpi', 'overview', 'analytics', 'summary'],
      },
    ],
  },
  {
    id: 'operations',
    defaultGroupLabel: 'Operations',
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id: 'cattle',
        labelKey: 'cattle',
        defaultLabel: 'Cattle Management',
        href: '/dashboard/cattle',
        icon: Beef,
        requiredPermission: PERMISSIONS.CATTLE_VIEW,
        keywords: ['cow', 'bull', 'cattle', 'livestock', 'tag', 'weight', 'vaccine', 'breeding', 'qurbani'],
      },
      {
        id: 'health',
        labelKey: 'health_ehr',
        defaultLabel: 'Health & Veterinary',
        href: '/dashboard/health',
        icon: HeartPulse,
        requiredPermission: PERMISSIONS.CATTLE_VIEW,
        keywords: ['health', 'ehr', 'vaccine', 'vaccination', 'disease', 'treatment', 'quarantine'],
      },
      {
        id: 'breeding',
        defaultLabel: 'Breeding & Reproduction',
        href: '/dashboard/breeding',
        icon: Users,
        requiredPermission: PERMISSIONS.CATTLE_VIEW,
      },
      {
        id: 'inventory',
        labelKey: 'inventory',
        defaultLabel: 'Feed & Inventory',
        href: '/dashboard/inventory',
        icon: Package,
        requiredPermission: PERMISSIONS.INVENTORY_VIEW,
      },
    ],
  },
  {
    id: 'commerce',
    defaultGroupLabel: 'Commerce',
    collapsible: true,
    items: [
      {
        id: 'commerce',
        defaultLabel: 'Commerce & Trading',
        href: '/dashboard/commerce',
        icon: ShoppingCart,
      },
      {
        id: 'vendors',
        defaultLabel: 'Vendors',
        href: '/dashboard/vendors',
        icon: Store,
      },
    ],
  },
  {
    id: 'finance',
    defaultGroupLabel: 'Finance',
    collapsible: true,
    items: [
      {
        id: 'finance',
        defaultLabel: 'Finance & Analytics',
        href: '/dashboard/finance',
        icon: Landmark,
      },
      {
        id: 'accounting',
        defaultLabel: 'Accounting',
        href: '/dashboard/accounting',
        icon: BookOpen,
      },
      {
        id: 'partners',
        labelKey: 'partners',
        defaultLabel: 'Partners & Equity',
        href: '/dashboard/partners',
        icon: Users,
        keywords: ['investor', 'partner', 'equity', 'shares', 'dividend'],
      },
    ],
  },
  {
    id: 'insights',
    defaultGroupLabel: 'Insights',
    collapsible: true,
    items: [
      {
        id: 'reports',
        defaultLabel: 'Reports',
        href: '/dashboard/report',
        icon: FileText,
        requiredPermission: PERMISSIONS.REPORTS_VIEW,
      },
      {
        id: 'ai',
        defaultLabel: 'AI & Intelligence',
        href: '/dashboard/ai',
        icon: Sparkles,
        adminOnly: true,
      },
    ],
  },
  {
    id: 'administration',
    defaultGroupLabel: 'Administration',
    collapsible: true,
    items: [
      {
        id: 'settings',
        defaultLabel: 'Administration & Setup',
        href: '/dashboard/settings',
        icon: Settings,
        adminOnly: true,
      },
      {
        id: 'compliance',
        defaultLabel: 'Compliance',
        href: '/dashboard/compliance',
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: 'support',
    defaultGroupLabel: 'Support',
    collapsible: true,
    items: [
      {
        id: 'help',
        defaultLabel: 'Support',
        href: '/dashboard/help',
        icon: LifeBuoy,
      },
    ],
  },
];

export function isNavActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
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

