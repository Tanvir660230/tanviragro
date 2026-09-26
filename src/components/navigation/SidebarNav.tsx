"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { logout } from "@/app/(auth)/login/actions";
import type { ExtendedUserRole } from "@/constants/roles";
import { ENTERPRISE_NAV_CONFIG, canUserAccessNavItem, navGroupLabel, navLabel } from "./nav-config";
import { activeHref } from "./site-map";

const ROLE_LABEL: Record<string, { bn: string; en: string }> = {
  owner: { bn: "মালিক", en: "Owner" }, admin: { bn: "অ্যাডমিন", en: "Admin" }, manager: { bn: "ম্যানেজার", en: "Manager" },
  veterinarian: { bn: "ডাক্তার", en: "Vet" }, staff: { bn: "স্টাফ", en: "Staff" }, worker: { bn: "কর্মী", en: "Worker" }, viewer: { bn: "দর্শক", en: "Viewer" },
};
export const roleLabel = (role: string, locale?: string) => (locale === "bn" ? ROLE_LABEL[role]?.bn : ROLE_LABEL[role]?.en) ?? role;

/**
 * The menu list — the desktop sidebar and the phone menu show the same thing (from the site map),
 * filtered by the viewer's role. The open section lists its pages under it.
 */
export function SidebarNav({ role, isAdmin, onNavigate }: { role: ExtendedUserRole; isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  const current = activeHref(pathname);

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label={locale === "bn" ? "মেনু" : "Menu"}>
      {ENTERPRISE_NAV_CONFIG.map((group) => {
        const items = group.items.filter((i) => canUserAccessNavItem(i, role, isAdmin));
        if (!items.length) return null;
        return (
          <div key={group.id}>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">{navGroupLabel(group, locale)}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const on = current === item.href || (item.children ?? []).some((c) => c.href === current);
                return (
                  <li key={item.id}>
                    <Link href={item.href} onClick={onNavigate} aria-current={on && current === item.href ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9rem] font-medium transition-colors",
                        on ? "bg-sidebar-primary/10 text-sidebar-primary" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}>
                      {on && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden />}
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", on ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground/80")} />
                      <span className="truncate">{navLabel(item, locale)}</span>
                    </Link>
                    {on && item.children && (
                      <ul className="mb-1 ml-[1.35rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                        {item.children.map((c) => (
                          <li key={c.id}>
                            <Link href={c.href} onClick={onNavigate} aria-current={current === c.href ? "page" : undefined}
                              className={cn("block truncate rounded-md px-2.5 py-1.5 text-[0.8rem] transition-colors",
                                current === c.href ? "bg-sidebar-accent font-semibold text-sidebar-foreground" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
                              {navLabel(c, locale)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Who is signed in, their role, and log out — the foot of the sidebar and the phone menu. */
export function SidebarUserCard({ email, role }: { email?: string; role: ExtendedUserRole }) {
  const { locale } = useTranslation();
  const name = (email ?? "").split("@")[0] || (locale === "bn" ? "ব্যবহারকারী" : "User");
  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sm font-bold uppercase text-sidebar-primary ring-1 ring-sidebar-primary/20">
        {name.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">{name}</p>
        <p className="truncate text-xs text-sidebar-foreground/55">{roleLabel(role, locale)}{email ? ` · ${email}` : ""}</p>
      </div>
      <form action={logout}>
        <button type="submit" aria-label={locale === "bn" ? "লগ আউট" : "Log out"} title={locale === "bn" ? "লগ আউট" : "Log out"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
