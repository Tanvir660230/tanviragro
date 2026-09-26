"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  User,
  Settings,
  Keyboard,
  Languages,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { useTranslation } from "@/i18n/I18nProvider";
import { setLocale } from "@/i18n/actions";
import { useShell } from "./ShellContext";
import { cn } from "@/lib/utils";

export interface UserProfileMenuProps {
  email: string;
  profile?: {
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
  } | null;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", bn: "হালকা", icon: Sun },
  { value: "system", label: "Auto", bn: "অটো", icon: Monitor },
  { value: "dark", label: "Dark", bn: "গাঢ়", icon: Moon },
] as const;

export function UserProfileMenu({ email, profile }: UserProfileMenuProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { setShortcutsModalOpen } = useShell();
  const [langPending, startLangTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const getSmartName = (mail: string) => {
    const prefix = mail.split("@")[0];
    return prefix.split(/[._-]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  };

  const nameToUse = profile?.full_name || getSmartName(email || "user@tanviragro.com");
  const roleToUse = profile?.role || (locale === "bn" ? "খামার প্রশাসক" : "Farm admin");
  const initials = nameToUse.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const toggleLanguage = () => {
    const next = locale === "en" ? "bn" : "en";
    startLangTransition(async () => { await setLocale(next); });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer hover:bg-muted/60 transition-all px-1.5 py-1"
        aria-label="User profile and system menu"
      >
        <Avatar className="h-7 w-7 shrink-0 border border-border/60 shadow-xs">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={nameToUse} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden xl:flex flex-col items-start text-left">
          <span className="text-xs font-semibold text-foreground max-w-[110px] truncate leading-tight">
            {nameToUse}
          </span>
          <span className="text-[10px] text-muted-foreground max-w-[110px] truncate leading-tight">
            {roleToUse}
          </span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 p-2 rounded-2xl border border-border shadow-2xl bg-card animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center gap-3 p-2 pb-3 border-b border-border/40 mb-1">
          <Avatar className="h-9 w-9 border border-border/60 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={nameToUse} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold truncate leading-tight text-foreground">{nameToUse}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {roleToUse}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate mt-0.5">{email}</span>
          </div>
        </div>

        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={() => router.push("/dashboard")}
        >
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{locale === "bn" ? "হোম" : "Home"}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={() => router.push("/dashboard/settings")}
        >
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{locale === "bn" ? "প্রোফাইল ও অ্যাকাউন্ট" : "Profile & account"}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={() => router.push("/dashboard/settings")}
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t.sidebar.settings}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={() => setShortcutsModalOpen(true)}
        >
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{locale === "bn" ? "কীবোর্ড শর্টকাট" : "Keyboard shortcuts"}</span>
          <kbd className="ml-auto text-[10px] font-mono text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
            Ctrl+/
          </kbd>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={toggleLanguage}
          disabled={langPending}
        >
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {locale === "en" ? "বাংলায় দেখুন" : "Switch to English"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5" />

        {mounted && (
          <div className="px-2 py-1.5">
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
              {locale === "bn" ? "রং" : "Theme"}
            </p>
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/40">
              {THEME_OPTIONS.map(({ value, label, bn, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-medium transition-all",
                    theme === value
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[11px]">{locale === "bn" ? bn : label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem
          className="gap-2.5 text-destructive focus:text-destructive cursor-pointer rounded-xl py-2"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          <span className="font-semibold text-sm">{t.common.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
