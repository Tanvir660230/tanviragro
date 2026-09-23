"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, Languages, Sun, Moon, Monitor } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { useTranslation } from "@/i18n/I18nProvider";
import { setLocale } from "@/i18n/actions";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function UserMenu({
  email,
  profile,
}: {
  email: string;
  profile?: { full_name?: string | null; avatar_url?: string | null } | null;
}) {
  const getSmartNameFromEmail = (mail: string) => {
    const prefix = mail.split("@")[0];
    return prefix
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const { t, locale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [langPending, startLangTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const nameToUse = profile?.full_name || getSmartNameFromEmail(email);
  const initials = nameToUse.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const toggleLanguage = () => {
    const next = locale === "en" ? "bn" : "en";
    startLangTransition(async () => { await setLocale(next); });
  };

  const THEME_OPTIONS = [
    { value: "light",  label: "Light",  icon: Sun },
    { value: "system", label: "Auto",   icon: Monitor },
    { value: "dark",   label: "Dark",   icon: Moon },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer hover:bg-muted/60 transition-all px-1.5 py-1"
        aria-label="User menu"
      >
        <Avatar className="h-7 w-7 shrink-0 border border-border/60 shadow-xs">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={nameToUse} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden lg:flex flex-col items-start text-left">
          <span className="text-xs sm:text-sm font-semibold text-foreground max-w-[120px] truncate leading-tight">
            {nameToUse}
          </span>
          <span className="text-[11px] text-muted-foreground max-w-[120px] truncate leading-tight">
            {email}
          </span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl border border-border/80 shadow-floating">
        {/* Identity */}
        <div className="flex items-center gap-3 p-2 pb-3">
          <Avatar className="h-9 w-9 border border-border/60 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={nameToUse} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate leading-tight">{nameToUse}</span>
            <span className="text-xs text-muted-foreground truncate mt-0.5">{email}</span>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Settings */}
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={() => router.push("/dashboard/settings")}
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-xs sm:text-sm">{t.sidebar.settings}</span>
        </DropdownMenuItem>

        {/* Language */}
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer rounded-xl py-2"
          onClick={toggleLanguage}
          disabled={langPending}
        >
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-xs sm:text-sm">
            {locale === "en" ? "বাংলায় দেখুন" : "Switch to English"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Theme selector */}
        {mounted && (
          <div className="px-2 py-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">Appearance</p>
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/40">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all",
                    theme === value
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          className="gap-2.5 text-destructive focus:text-destructive cursor-pointer rounded-xl py-2"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium text-xs sm:text-sm">{t.common.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
