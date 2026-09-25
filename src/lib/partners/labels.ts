/** Display names of partner and partner-transaction types (one place for every partner page). */
const TXN: Record<string, { bn: string; en: string }> = {
  investment: { bn: "মূলধন জমা", en: "Capital in" },
  withdrawal: { bn: "টাকা তোলা", en: "Withdrawal" },
  profit: { bn: "লাভের ভাগ", en: "Profit distribution" },
  loss_allocation: { bn: "ক্ষতির ভাগ", en: "Loss allocation" },
};
const PARTNER: Record<string, { bn: string; en: string }> = {
  capital: { bn: "মূলধন অংশীদার", en: "Capital partner" },
  labor: { bn: "শ্রম অংশীদার", en: "Labor partner" },
  hybrid: { bn: "মূলধন + শ্রম", en: "Capital + labor" },
};

const pick = (m: Record<string, { bn: string; en: string }>, k: string, locale: string | undefined) =>
  m[k] ? (locale === "bn" ? m[k].bn : m[k].en) : k.replace(/_/g, " ");

export const partnerTxnLabel = (type: string, locale: string | undefined) => pick(TXN, type, locale);
export const partnerTypeLabel = (type: string, locale: string | undefined) => pick(PARTNER, type, locale);
