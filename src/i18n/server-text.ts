import { cookies } from "next/headers";

/** Server side of `L("বাংলা", "English")` (see ./text.ts): reads the viewer's language cookie. */
export async function getL(): Promise<(bn: string, en: string) => string> {
  const bn = (await cookies()).get("NEXT_LOCALE")?.value === "bn";
  return (b, e) => (bn ? b : e);
}

/** "bn" | "en" for the viewer (dates, number formats). */
export async function getLocale(): Promise<"bn" | "en"> {
  return (await cookies()).get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
}
