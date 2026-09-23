import { cookies } from "next/headers";
import "server-only";
import type { Dictionary, Locale } from "./types";

export type { Dictionary, Locale };

const dictionaries = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  bn: () => import("./dictionaries/bn.json").then((module) => module.default),
};

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  // If no locale provided, read from cookie
  if (!locale) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    locale = (cookieLocale === "bn" ? "bn" : "en") as Locale;
  }
  
  return (await dictionaries[locale]()) as Dictionary;
}
