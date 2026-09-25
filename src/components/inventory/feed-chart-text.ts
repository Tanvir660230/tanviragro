/** Feeding chart page text (Bangla / English); plain module so the server page can read it too. */
export const FEED_CHART_TEXT = {
  en: {
    title: "Feeding chart", sub: "How much each weight of animal eats per day. Feed in use comes off the stock every day by this chart; a count adjusts any difference.",
    recipes: "Recipes (mix)", feeds: "Feeds", has_chart: "Chart from {date}", no_chart: "No chart", in_use: "In use",
    current: "Current chart · from {date}", none_yet: "No chart yet for this feed — add the weight rows below.",
    from: "Weight from (kg)", to: "to (kg)", amount: "Amount per day", type: "Type", per_head: "{unit} per animal", pct: "% of weight",
    open_end: "and above", add_row: "Add weight row", standard: "Fill standard chart", standard_note: "Standard: concentrate 1.5 % / 2 % / 1.5 % of weight; roughage from dry-matter need. Edit to your farm.",
    starts: "Applies from", notes: "Note (optional)", save: "Save chart", saved: "Chart saved",
    version_note: "Saving creates a new version from this date. Earlier days keep the chart they had, and days already deducted are not changed; the count settles them.",
    preview: "Today by this chart", animal: "Animal", weight: "Weight", band: "Row", per_day: "Per day", total: "Farm total per day",
    est_weight: "estimated", no_weight: "no weight — lightest row used", lasts: "Stock lasts ≈ {days} days", ingredients: "Ingredients per day",
    history: "Versions", delete: "Delete", confirm_delete: "Delete this chart version? The earlier version applies again.", deleted: "Version deleted",
    pick: "Choose a feed or recipe on the left.", no_animals: "No animals on the farm today.",
    err_rows: "Each row needs an amount, and every row except the last needs a 'to' weight larger than its 'from'.",
    pct_needs_kg: "% of weight needs the item's kg per {unit} — set it on the item, or use an amount per animal.",
  },
  bn: {
    title: "খাবারের চার্ট", sub: "কোন ওজনের গরু দিনে কতটা খায়। চালু খাবার এই চার্ট অনুযায়ী প্রতিদিন নিজে স্টক থেকে কাটা হয়; গুনে দিলে পার্থক্য মিলে যায়।",
    recipes: "রেসিপি (মিক্স)", feeds: "খাবার", has_chart: "চার্ট {date} থেকে", no_chart: "চার্ট নেই", in_use: "চালু",
    current: "বর্তমান চার্ট · {date} থেকে", none_yet: "এই খাবারের চার্ট এখনো নেই — নিচে ওজনের সারি যোগ করুন।",
    from: "ওজন থেকে (kg)", to: "পর্যন্ত (kg)", amount: "দিনে পরিমাণ", type: "ধরন", per_head: "প্রতি গরু {unit}", pct: "ওজনের %",
    open_end: "এবং বেশি", add_row: "ওজনের সারি যোগ করুন", standard: "স্ট্যান্ডার্ড চার্ট বসান", standard_note: "স্ট্যান্ডার্ড: দানাদার ওজনের 1.5% / 2% / 1.5%; খড়-ঘাস শুকনো অংশের চাহিদা থেকে। আপনার খামার অনুযায়ী বদলে নিন।",
    starts: "কবে থেকে প্রযোজ্য", notes: "নোট (ঐচ্ছিক)", save: "চার্ট সেভ করুন", saved: "চার্ট সেভ হলো",
    version_note: "সেভ করলে এই তারিখ থেকে নতুন সংস্করণ হয়। আগের দিনগুলো আগের চার্টেই থাকে, আর যেদিনের কাটা হয়ে গেছে তা বদলায় না; গোনার সময় মিলে যায়।",
    preview: "আজ এই চার্টে", animal: "গরু", weight: "ওজন", band: "সারি", per_day: "দিনে", total: "খামারে দিনে মোট",
    est_weight: "আনুমানিক", no_weight: "ওজন নেই — সবচেয়ে ছোট সারি ধরা হয়েছে", lasts: "স্টক চলবে ≈ {days} দিন", ingredients: "উপকরণ, দিনে",
    history: "সংস্করণ", delete: "মুছুন", confirm_delete: "এই চার্ট সংস্করণ মুছবেন? আগের সংস্করণ আবার প্রযোজ্য হবে।", deleted: "সংস্করণ মুছে ফেলা হলো",
    pick: "বাম দিক থেকে একটি খাবার বা রেসিপি বাছুন।", no_animals: "আজ খামারে কোনো গরু নেই।",
    err_rows: "প্রতিটি সারিতে পরিমাণ দিন, আর শেষটা ছাড়া প্রতিটি সারির 'পর্যন্ত' ওজন 'থেকে'-র চেয়ে বেশি দিন।",
    pct_needs_kg: "ওজনের % দিতে হলে আইটেমে প্রতি {unit} কত kg তা দিতে হবে — না হলে প্রতি গরু পরিমাণ দিন।",
  },
} as const;
export type FeedChartLang = keyof typeof FEED_CHART_TEXT;
