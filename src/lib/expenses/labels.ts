/**
 * Display names of expense categories and types (the stored value stays as it is — a key such
 * as "doctor_fee" or an old free-text name such as "Rent"). One place for every page and form.
 */
const CATEGORY_BN: Record<string, string> = {
  rent: "ভাড়া", salary: "বেতন", utilities: "বিদ্যুৎ-পানি", utility: "বিদ্যুৎ-পানি", insurance: "বীমা", other: "অন্যান্য",
  feed: "খাবার", medicine: "ওষুধ", labour: "মজুরি", labor: "মজুরি", transport: "পরিবহন", veterinary: "ডাক্তার",
  doctor_fee: "ডাক্তারের ফি", infrastructure: "অবকাঠামো", equipment: "যন্ত্রপাতি", vehicle: "গাড়ি", land: "জমি",
  repair: "মেরামত", general: "সাধারণ", roughage: "খড়/ঘাস",
};

const key = (c: string) => c.trim().toLowerCase().replace(/[\s-]+/g, "_");
const pretty = (c: string) => c.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

export function costCategoryLabel(category: string | null | undefined, locale: string | undefined): string {
  if (!category) return "—";
  return locale === "bn" ? CATEGORY_BN[key(category)] ?? category : pretty(category);
}

export function costTypeLabel(type: string | null | undefined, locale: string | undefined): string {
  if (type === "fixed") return locale === "bn" ? "নির্দিষ্ট" : "Fixed";
  if (type === "variable") return locale === "bn" ? "পরিবর্তনশীল" : "Variable";
  return type ?? "—";
}
