"use client";

import { useTranslation } from "@/i18n/I18nProvider";
import { setLocale } from "@/i18n/actions";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const { locale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const toggleLanguage = () => {
    const nextLocale = locale === "en" ? "bn" : "en";
    startTransition(async () => {
      await setLocale(nextLocale);
    });
  };

  return (
    <button
      onClick={toggleLanguage}
      disabled={isPending}
      className="flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 gap-1"
      aria-label={locale === "en" ? "Switch to Bengali" : "Switch to English"}
      title={locale === "en" ? "Switch to Bengali" : "Switch to English"}
    >
      {locale === "en" ? (
        <><span className="text-xs opacity-60">বাং</span><span className="hidden sm:inline">বাংলা</span></>
      ) : (
        <><span className="text-xs opacity-60">EN</span><span className="hidden sm:inline">English</span></>
      )}
    </button>
  );
}
