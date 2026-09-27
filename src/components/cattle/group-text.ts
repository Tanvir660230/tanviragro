/** Words of the "bought / sold together at one price" screens. */
export const GROUP_TEXT = {
  en: {
    // buying several
    p_title: "Buy several at one price", p_sub: "One price for all of them. Each animal gets its own share, so its cost and profit are tracked on its own.",
    date: "Date", total: "Total price (৳)", seller: "Seller / haat", buyer: "Buyer", breed_all: "Breed (all)", note: "Note",
    count: "How many", animals: "Animals", tag: "Tag", gender: "Sex", male: "Male", female: "Female",
    weight: "Weight (kg)", weight_opt: "optional", measured: "Weighed", estimated: "Guessed",
    share: "Share", price: "Price (৳)",
    how: "How the price is shared",
    m_weight: "By weight", m_equal: "Equal", m_manual: "Type each price",
    h_weight: "Heavier animals carry more of the price, in proportion to their weight.",
    h_weight_missing: "Enter every animal's weight to share by weight.",
    h_equal_buy: "Same share each — marked provisional. When every animal has been weighed, re-split by weight from any animal's page.",
    h_equal_sell: "Same share each.",
    h_manual: "Type each animal's price; they must add up to the total.",
    h_estimated: "Some weights are guesses — the split is labelled as based on estimates.",
    sum_ok: "Shares add up to the total", sum_left: "৳{n} left to share", sum_over: "৳{n} over the total",
    extra: "Transport & haat fee (shared the same way)", transport: "Transport (৳)", haat: "Haat fee / hasil (৳)",
    save_buy: "Add {n} animals", cancel: "Cancel",
    ok_buy: "{n} animals added — ৳{total} shared", tag_dup: "Tag {tag} is used twice", tag_taken: "Tag {tag} already exists",
    need_total: "Enter the total price", need_tags: "Every animal needs a tag",
    // selling several
    s_title: "Sell {n} animals", s_title_one: "Sell {tag}", s_sub: "One price for the group. Each animal's share is its sale price, so each has its own profit or loss.",
    sale_weight: "Weight at sale (kg)", last: "last {kg}", cost: "Cost so far", profit: "Profit",
    total_cost: "Total cost", total_profit: "Total profit",
    h_weight_sell: "Weigh each animal at the sale; the price is shared by those weights (how cattle are priced).",
    save_sell: "Record sale", ok_sell: "{n} sold for ৳{total}",
    // linking animals already on record
    l_title: "Bought together", l_sub: "These animals were bought in one deal. Enter what was paid for all of them; each gets its share.",
    l_same_date: "Animals bought together must have the same purchase date. Fix the dates first ({dates}).",
    l_auto: "Best evidence", h_auto: "Uses weight at purchase, else the first weigh-in of all of them, else equal (provisional).",
    save_link: "Save", ok_link: "Linked — ৳{total} shared over {n} animals",
    l_now: "Now", l_new: "New share",
    // the group on an animal's page
    g_title: "Bought together", g_sub: "{n} animals · ৳{total} on {date}", g_seller: "from {seller}",
    g_basis: "Share based on", b_purchase_weight: "weight at purchase", b_purchase_weight_estimated: "guessed weight at purchase",
    b_weigh_in: "weigh-in on {date}", b_equal: "equal shares (provisional)", b_manual: "prices typed by you",
    g_provisional: "No weights yet — the shares are equal for now. Weigh all {n} animals on the same day and re-split.",
    g_better: "All {n} were weighed on {date}. Re-split by those weights for an exact share?",
    g_better_go: "Re-split by weight", g_change: "Change split",
    g_this: "this animal", g_sold: "sold", g_on_farm: "on farm", g_left: "left",
    r_title: "Change how ৳{total} is shared", r_choose: "Share by",
    r_weigh_in: "Weigh-in on {date}", r_purchase: "Weight at purchase", r_none_weights: "No day on which all were weighed yet.",
    r_locked_note: "A sold animal's profit changes with its share.", save_resplit: "Save split", ok_resplit: "Shares updated",
    // a sale of several on an animal's page
    sg_title: "Sold together", sg_sub: "{n} animals · ৳{total} on {date}", sg_this: "This animal's share",
    undo_group: "Undo the whole sale", undo_group_q: "Undo the sale of all {n} animals?", undo_group_note: "All of them go back on the farm and their cancelled health tasks come back.",
    ok_undo: "Sale undone — {n} animals back on the farm",
    failed: "Something went wrong — nothing changed",
  },
  bn: {
    p_title: "একসাথে কয়েকটি গরু কেনা (এক দামে)", p_sub: "সবগুলোর এক দাম। প্রতিটি গরু তার নিজের ভাগ পাবে, তাই প্রত্যেকটির খরচ ও লাভ আলাদা হিসাব হবে।",
    date: "তারিখ", total: "মোট দাম (৳)", seller: "বিক্রেতা / হাট", buyer: "ক্রেতা", breed_all: "জাত (সবার)", note: "নোট",
    count: "কয়টি", animals: "গরু", tag: "ট্যাগ", gender: "লিঙ্গ", male: "ষাঁড়", female: "গাভী",
    weight: "ওজন (কেজি)", weight_opt: "ঐচ্ছিক", measured: "মাপা", estimated: "আন্দাজ",
    share: "ভাগ", price: "দাম (৳)",
    how: "দাম কীভাবে ভাগ হবে",
    m_weight: "ওজন অনুযায়ী", m_equal: "সমান ভাগ", m_manual: "নিজে দাম লিখুন",
    h_weight: "যে গরুর ওজন বেশি, তার ভাগে দাম বেশি — ওজনের অনুপাতে।",
    h_weight_missing: "ওজন অনুযায়ী ভাগ করতে সব গরুর ওজন দিন।",
    h_equal_buy: "সবার সমান ভাগ — অস্থায়ী হিসেবে চিহ্নিত। সবগুলোর ওজন নেওয়া হলে যেকোনো গরুর পাতা থেকে ওজন অনুযায়ী আবার ভাগ করুন।",
    h_equal_sell: "সবার সমান ভাগ।",
    h_manual: "প্রতিটির দাম লিখুন; যোগফল মোট দামের সমান হতে হবে।",
    h_estimated: "কিছু ওজন আন্দাজ — ভাগটি আন্দাজি ওজনে বলে দেখানো হবে।",
    sum_ok: "ভাগগুলোর যোগফল মোট দামের সমান", sum_left: "আরও ৳{n} ভাগ করা বাকি", sum_over: "মোটের চেয়ে ৳{n} বেশি",
    extra: "পরিবহন ও হাসিল (একই নিয়মে ভাগ হবে)", transport: "পরিবহন (৳)", haat: "হাসিল (৳)",
    save_buy: "{n}টি গরু যোগ করুন", cancel: "বাতিল",
    ok_buy: "{n}টি গরু যোগ হলো — ৳{total} ভাগ হলো", tag_dup: "ট্যাগ {tag} দুবার দেওয়া হয়েছে", tag_taken: "ট্যাগ {tag} আগে থেকেই আছে",
    need_total: "মোট দাম লিখুন", need_tags: "প্রতিটি গরুর ট্যাগ দিন",
    s_title: "{n}টি গরু বিক্রি", s_title_one: "{tag} বিক্রি", s_sub: "দলের এক দাম। প্রতিটি গরুর ভাগই তার বিক্রির দাম — তাই প্রত্যেকটির লাভ-ক্ষতি আলাদা।",
    sale_weight: "বিক্রির সময় ওজন (কেজি)", last: "শেষ {kg}", cost: "এ পর্যন্ত খরচ", profit: "লাভ",
    total_cost: "মোট খরচ", total_profit: "মোট লাভ",
    h_weight_sell: "বিক্রির সময় প্রতিটি গরু মাপুন; সেই ওজনের অনুপাতে দাম ভাগ হবে (হাটে যেভাবে দাম হয়)।",
    save_sell: "বিক্রি লিখুন", ok_sell: "{n}টি বিক্রি হলো ৳{total}-তে",
    l_title: "একসাথে কেনা", l_sub: "এই গরুগুলো এক দামে কেনা হয়েছিল। সবগুলোর জন্য মোট কত দেওয়া হয়েছিল লিখুন; প্রত্যেকটি তার ভাগ পাবে।",
    l_same_date: "একসাথে কেনা গরুর কেনার তারিখ একই হতে হবে। আগে তারিখ ঠিক করুন ({dates})।",
    l_auto: "সবচেয়ে ভালো তথ্য", h_auto: "কেনার সময়ের ওজন, না থাকলে সবার প্রথম একদিনের ওজন, তাও না থাকলে সমান (অস্থায়ী)।",
    save_link: "সেভ করুন", ok_link: "যুক্ত হলো — ৳{total} {n}টি গরুতে ভাগ হলো",
    l_now: "এখন", l_new: "নতুন ভাগ",
    g_title: "একসাথে কেনা", g_sub: "{n}টি গরু · ৳{total} · {date}", g_seller: "{seller} থেকে",
    g_basis: "ভাগের ভিত্তি", b_purchase_weight: "কেনার সময়ের ওজন", b_purchase_weight_estimated: "কেনার সময়ের আন্দাজি ওজন",
    b_weigh_in: "{date}-এর ওজন", b_equal: "সমান ভাগ (অস্থায়ী)", b_manual: "আপনার লেখা দাম",
    g_provisional: "এখনো ওজন নেই — আপাতত সমান ভাগ। একই দিনে {n}টিকেই মেপে আবার ভাগ করুন।",
    g_better: "{date}-এ {n}টিকেই মাপা হয়েছে। সেই ওজন অনুযায়ী সঠিক ভাগ করবেন?",
    g_better_go: "ওজন অনুযায়ী ভাগ করুন", g_change: "ভাগ বদলান",
    g_this: "এই গরু", g_sold: "বিক্রিত", g_on_farm: "খামারে", g_left: "নেই",
    r_title: "৳{total} কীভাবে ভাগ হবে", r_choose: "ভাগের ভিত্তি",
    r_weigh_in: "{date}-এর ওজন", r_purchase: "কেনার সময়ের ওজন", r_none_weights: "এখনো এমন দিন নেই যেদিন সবগুলো মাপা হয়েছে।",
    r_locked_note: "বিক্রি হওয়া গরুর ভাগ বদলালে তার লাভও বদলাবে।", save_resplit: "ভাগ সেভ করুন", ok_resplit: "ভাগ বদলানো হলো",
    sg_title: "একসাথে বিক্রি", sg_sub: "{n}টি গরু · ৳{total} · {date}", sg_this: "এই গরুর ভাগ",
    undo_group: "পুরো বিক্রি বাতিল", undo_group_q: "{n}টি গরুর বিক্রিই বাতিল করবেন?", undo_group_note: "সবগুলো খামারে ফিরবে, বাতিল হওয়া স্বাস্থ্য কাজও ফিরবে।",
    ok_undo: "বিক্রি বাতিল — {n}টি গরু খামারে ফিরল",
    failed: "সমস্যা হয়েছে — কিছু বদলায়নি",
  },
} as const;

export type GroupLang = keyof typeof GROUP_TEXT;
export type GroupText = (typeof GROUP_TEXT)[GroupLang];
export const fillG = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
export const takaG = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);

/** The next free tags after the highest numbered one (C007 → C008, C009 …). */
export function nextTags(existing: string[], n: number): string[] {
  let prefix = "C", num = 0, pad = 3;
  for (const tag of existing) {
    const m = tag.match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const v = parseInt(m[2], 10);
    if (v > num) { num = v; prefix = m[1]; pad = m[2].length; }
  }
  const taken = new Set(existing.map((t) => t.toLowerCase()));
  const out: string[] = [];
  for (let k = num + 1; out.length < n; k++) {
    const t = prefix + String(k).padStart(pad, "0");
    if (!taken.has(t.toLowerCase())) out.push(t);
  }
  return out;
}

/** The stored basis of a purchase group in words. */
export function basisLabel(basis: string | null, g: GroupText, fmt: (d: string) => string): string {
  if (!basis) return "—";
  if (basis.startsWith("weigh_in:")) return fillG(g.b_weigh_in, { date: fmt(basis.slice(9)) });
  const k = `b_${basis}` as keyof GroupText;
  return (g[k] as string | undefined) ?? basis;
}
