"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/getDictionary";

export function ClientDate({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  if (!mounted) {
    return <span className="text-transparent">00 Xxxxx 0000</span>; // Invisible placeholder to prevent layout shift
  }

  const dateStr = new Date().toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return <span>{dateStr}</span>;
}
