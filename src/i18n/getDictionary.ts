import { cookies } from "next/headers";
import "server-only";

const dictionaries = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  bn: () => import("./dictionaries/bn.json").then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;
export type Dictionary = Awaited<ReturnType<typeof dictionaries.en>>;

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  // If no locale provided, read from cookie
  if (!locale) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    locale = (cookieLocale === "bn" ? "bn" : "en") as Locale;
  }
  
  return dictionaries[locale]();
}
