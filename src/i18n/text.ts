import { useMemo } from "react";
import { useTranslation } from "./I18nProvider";

/**
 * Page text in both languages, side by side: `L("বাংলা", "English")`.
 * The same idea as the site map's `{ bn, en }` labels — one place per string, no key lookup.
 * Server components use `getL()` from "@/i18n/server-text"; shared server/client pieces `<Tr>`.
 */
export type Lx = (bn: string, en: string) => string;

export const makeL = (locale: string | undefined): Lx => (bn, en) => (locale === "bn" ? bn : en);

/** Stable per language, so it can sit in hook dependency lists. */
export function useL(): Lx {
  const { locale } = useTranslation();
  return useMemo(() => makeL(locale), [locale]);
}
