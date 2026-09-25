"use client";

import { useTranslation } from "./I18nProvider";

/**
 * `<Tr bn="বাংলা" en="English" />` — text in the viewer's language, usable inside shared
 * components that render on both the server and the client (see ./text.ts for `L()`).
 */
export function Tr({ bn, en }: { bn: string; en: string }) {
  const { locale } = useTranslation();
  return <>{locale === "bn" ? bn : en}</>;
}
